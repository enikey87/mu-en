/* ============================================================
   РАСПОЗНАВАНИЕ МЫЧАНИЯ «муууу» — чистая математика без DOM.

   Мычание — это громкий, протяжный, ровный низкий голос с гласной «у»:
   энергия прижата к низам (F1 ≈ 300 Гц, F2 ≈ 700 Гц), тон держится
   в «бычьем» диапазоне. Каждый кадр звука описывается набором признаков
   (analyzeFrame), а накопитель MooTracker решает, тянул ли человек
   «мууу» достаточно долго и громко.

   Модуль не знает про Web Audio: тот же код работает в микрофонном
   детекторе (src/moo-detector.ts) и в оффлайн-пробнике
   (scripts/moo-probe.ts), где сигналы синтезируются на месте.
   ============================================================ */

export interface MooConfig {
  /** калибровка фонового шума, мс */
  calibrateMs: number
  /** дольше этого срока одну попытку не слушаем, мс */
  listenMs: number
  /** сколько нужно тянуть «мууу», мс */
  minSustainMs: number
  /** пауза внутри мычания, которая ещё не рвёт отрезок, мс */
  maxGapMs: number
  /** «громко» = фоновый шум + margin, дБ */
  loudMarginDb: number
  /** тише этого мычать бессмысленно, dBFS */
  minLoudDb: number
  /** выше этого порога поднимать планку нельзя, dBFS */
  maxLoudDb: number
  /** диапазон основного тона: бык и ребёнок, Гц */
  f0Min: number
  f0Max: number
  /** минимальная «звонкость» автокорреляции, 0..1 */
  minClarity: number
  /** верхняя граница спектрального центроида гласной «у», Гц */
  maxCentroid: number
  /** верхняя граница второй форманты «у», Гц */
  maxF2: number
  /** доля энергии низа (150–1000 Гц) от полосы 150–4000 Гц */
  minLowShare: number
}

export const MOO_CONFIG: MooConfig = {
  calibrateMs: 400,
  listenMs: 4200,
  minSustainMs: 800,
  maxGapMs: 110,
  loudMarginDb: 12,
  minLoudDb: -45,
  maxLoudDb: -14,
  f0Min: 70,
  f0Max: 460,
  minClarity: 0.55,
  maxCentroid: 850,
  maxF2: 1300,
  minLowShare: 0.5,
}

/** Что удалось разглядеть в одном кадре звука. */
export interface MooFrame {
  /** громкость, dBFS */
  db: number
  /** основной тон, Гц; 0 — не найден */
  f0: number
  /** звонкость автокорреляции, 0..1 */
  clarity: number
  /** спектральный центроид, Гц */
  centroid: number
  /** горб в области первой форманты, Гц */
  f1: number
  /** горб в области второй форманты, Гц */
  f2: number
  /** доля энергии низа, 0..1 */
  lowShare: number
  /** кадр похож на «у» (без учёта громкости — её знает накопитель) */
  moo: boolean
}

export type MooFailReason = 'quiet' | 'short' | 'not-moo' | 'timeout'

export type MooVerdict = { ok: true; durationMs: number } | { ok: false; reason: MooFailReason }

/** Живые показатели для му-метра. */
export interface MooLive {
  /** нормализованная громкость, 0..1 */
  level: number
  loud: boolean
  moo: boolean
  /** прогресс текущего мычания к minSustainMs, 0..1 */
  progress: number
  calibrating: boolean
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Громкость кадра в dBFS. */
export function rmsDb(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    sum += v * v
  }
  const rms = Math.sqrt(sum / (samples.length || 1))
  return 20 * Math.log10(Math.max(rms, 1e-6))
}

/** Простое усредняющее прореживание — для тона ниже 500 Гц этого достаточно. */
function decimate(samples: Float32Array, factor: number): Float32Array {
  const n = Math.floor(samples.length / factor)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    const base = i * factor
    for (let k = 0; k < factor; k++) sum += samples[base + k]
    out[i] = sum / factor
  }
  return out
}

/** Основной тон по нормализованной автокорреляции. */
export function estimatePitch(
  samples: Float32Array,
  sampleRate: number,
  f0Min: number,
  f0Max: number,
): { f0: number; clarity: number } {
  const n = samples.length
  const minLag = Math.max(2, Math.floor(sampleRate / f0Max))
  const maxLag = Math.min(Math.floor(sampleRate / f0Min), Math.floor(n / 2))
  if (maxLag <= minLag) return { f0: 0, clarity: 0 }

  let mean = 0
  for (let i = 0; i < n; i++) mean += samples[i]
  mean /= n
  const x = new Float32Array(n)
  let energy = 0
  for (let i = 0; i < n; i++) {
    const v = samples[i] - mean
    x[i] = v
    energy += v * v
  }
  if (energy < 1e-9) return { f0: 0, clarity: 0 }

  const corr = new Float32Array(maxLag + 2)
  let bestLag = 0
  let bestCorr = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0
    let e1 = 0
    let e2 = 0
    for (let i = 0; i + lag < n; i++) {
      const a = x[i]
      const b = x[i + lag]
      num += a * b
      e1 += a * a
      e2 += b * b
    }
    const c = num / Math.sqrt(e1 * e2 + 1e-12)
    corr[lag] = c
    if (c > bestCorr) {
      bestCorr = c
      bestLag = lag
    }
  }
  if (!bestLag) return { f0: 0, clarity: bestCorr }

  // параболическая поправка: пик корреляции редко попадает точно в отсчёт
  const c0 = corr[bestLag - 1]
  const c1 = corr[bestLag]
  const c2 = corr[bestLag + 1]
  const denom = c0 - 2 * c1 + c2
  const delta = denom !== 0 ? (0.5 * (c0 - c2)) / denom : 0
  const lag = bestLag + (delta > 0.5 ? 0.5 : delta < -0.5 ? -0.5 : delta)
  return { f0: sampleRate / lag, clarity: bestCorr }
}

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>()
function getTwiddles(len: number): { cos: Float64Array; sin: Float64Array } {
  let t = twiddles.get(len)
  if (!t) {
    const half = len >> 1
    const cos = new Float64Array(half)
    const sin = new Float64Array(half)
    for (let i = 0; i < half; i++) {
      const a = (-2 * Math.PI * i) / len
      cos[i] = Math.cos(a)
      sin[i] = Math.sin(a)
    }
    t = { cos, sin }
    twiddles.set(len, t)
  }
  return t
}

/** Итеративное БПФ на месте (radix-2). */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const { cos, sin } = getTwiddles(len)
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k]
        const wi = sin[k]
        const a = i + k
        const b = a + half
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] = re[a] + xr
        im[a] = im[a] + xi
      }
    }
  }
}

/** Спектральные признаки кадра: центроид, доля низа и горбы формант. */
export function spectrumFeatures(
  samples: Float32Array,
  sampleRate: number,
  fftSize = 2048,
): { centroid: number; lowShare: number; f1: number; f2: number } {
  const n = Math.min(fftSize, samples.length)
  if (n < 256) return { centroid: 0, lowShare: 0, f1: 0, f2: 0 }
  const start = Math.max(0, samples.length - n)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // окно Ханна: иначе пики формант размазываются в шум
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
    re[i] = samples[start + i] * w
  }
  fftInPlace(re, im)

  const binHz = sampleRate / n
  let total = 0
  let low = 0
  let centNum = 0
  let f1 = 0
  let f2 = 0
  let f1mag = 0
  let f2mag = 0
  for (let k = 1; k < n >> 1; k++) {
    const f = k * binHz
    if (f < 150 || f > 4000) continue
    const mag = Math.hypot(re[k], im[k])
    total += mag
    centNum += f * mag
    if (f <= 1000) low += mag
    if (f <= 550 && mag > f1mag) {
      f1mag = mag
      f1 = f
    }
    if (f >= 500 && f <= 1600 && mag > f2mag) {
      f2mag = mag
      f2 = f
    }
  }
  return {
    centroid: total > 0 ? centNum / total : 0,
    lowShare: total > 0 ? low / total : 0,
    f1,
    f2,
  }
}

/** Разбор одного кадра звука: громкость, тон, гласная «у». */
export function analyzeFrame(
  samples: Float32Array,
  sampleRate: number,
  cfg: MooConfig = MOO_CONFIG,
): MooFrame {
  const db = rmsDb(samples)
  // 12 кГц хватает для тона 70–460 Гц, а считается вчетверо быстрее
  const reduced = decimate(samples, 4)
  const { f0, clarity } = estimatePitch(reduced, sampleRate / 4, cfg.f0Min, cfg.f0Max)
  const { centroid, lowShare, f1, f2 } = spectrumFeatures(samples, sampleRate)

  const voiced = clarity >= cfg.minClarity && f0 >= cfg.f0Min && f0 <= cfg.f0Max
  const vowelU =
    centroid > 0 &&
    centroid <= cfg.maxCentroid &&
    (f2 === 0 || f2 <= cfg.maxF2) &&
    lowShare >= cfg.minLowShare

  return { db, f0, clarity, centroid, f1, f2, lowShare, moo: voiced && vowelU }
}

/**
 * Накопитель: кормим его кадрами с метками времени, он сам калибрует фон,
 * следит за непрерывным «мууу» и выдаёт вердикт.
 */
export class MooTracker {
  private readonly cfg: MooConfig
  private readonly frameWindowMs: number

  private readonly ambient: number[] = []
  private calibrating = true
  private threshold = 0
  private loudFrames = 0
  private mooFrames = 0
  private maxDb = -Infinity
  private runStart = -1
  private lastMoo = -1
  private bestRunMs = 0
  private verdict: MooVerdict | null = null

  private lastLevelDb = -Infinity
  private lastLoud = false
  private lastMooFlag = false

  constructor(cfg: MooConfig = MOO_CONFIG, frameWindowMs = 85) {
    this.cfg = cfg
    this.frameWindowMs = frameWindowMs
  }

  /** Порог «громко», дБ — после калибровки. */
  get loudThreshold(): number {
    return this.threshold
  }

  push(frame: MooFrame, tMs: number): void {
    if (this.verdict) return
    this.lastLevelDb = frame.db
    this.lastLoud = false
    this.lastMooFlag = false

    if (this.calibrating) {
      // мычание — не фон: если начали мычать сразу, порог не задирается
      if (!frame.moo) this.ambient.push(frame.db)
      if (tMs >= this.cfg.calibrateMs) {
        this.calibrating = false
        this.threshold = this.pickThreshold()
      }
      return
    }

    const loud = frame.db >= this.threshold
    const moo = loud && frame.moo
    this.lastLoud = loud
    this.lastMooFlag = moo
    if (frame.db > this.maxDb) this.maxDb = frame.db
    if (loud) this.loudFrames++
    if (moo) {
      this.mooFrames++
      if (this.runStart < 0) this.runStart = tMs
      this.lastMoo = tMs
    } else if (this.runStart >= 0 && tMs - this.lastMoo > this.cfg.maxGapMs) {
      // мычание прервалось дольше, чем на вдох — отрезок закрывается
      this.runStart = -1
    }

    const runMs = this.currentRunMs()
    if (runMs > this.bestRunMs) this.bestRunMs = runMs
    if (runMs >= this.cfg.minSustainMs) {
      this.verdict = { ok: true, durationMs: Math.round(runMs) }
      return
    }
    if (tMs >= this.cfg.listenMs) this.finish()
  }

  result(): MooVerdict | null {
    return this.verdict
  }

  live(): MooLive {
    return {
      // шкала от -55 dBFS (тишина) до -10 dBFS (крик)
      level: clamp01((this.lastLevelDb + 55) / 45),
      loud: !this.calibrating && this.lastLoud,
      moo: !this.calibrating && this.lastMooFlag,
      progress: clamp01(this.currentRunMs() / this.cfg.minSustainMs),
      calibrating: this.calibrating,
    }
  }

  /**
   * Длина текущего отрезка. Метки времени — начало окна анализа, поэтому
   * кадр «мууу» подтверждает ещё и следующие frameWindowMs звука.
   */
  private currentRunMs(): number {
    if (this.runStart < 0) return 0
    return this.lastMoo - this.runStart + this.frameWindowMs
  }

  /** Медиана фона: случайный кашель не должен задирать порог. */
  private pickThreshold(): number {
    if (!this.ambient.length) return this.cfg.minLoudDb
    const sorted = [...this.ambient].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const wanted = median + this.cfg.loudMarginDb
    return Math.min(Math.max(wanted, this.cfg.minLoudDb), this.cfg.maxLoudDb)
  }

  /** Время вышло: понять, чего именно не хватило, чтобы подсказать. */
  private finish(): void {
    const enoughLoud = this.loudFrames > 0 && this.maxDb >= this.threshold + 3
    const mooShare = this.loudFrames > 0 ? this.mooFrames / this.loudFrames : 0
    let reason: MooFailReason
    if (!enoughLoud) reason = 'quiet'
    else if (this.mooFrames < 4 || mooShare < 0.2) reason = 'not-moo'
    else if (this.bestRunMs < this.cfg.minSustainMs) reason = 'short'
    else reason = 'timeout'
    this.verdict = { ok: false, reason }
  }
}
