/* ============================================================
   МИКРОФОННЫЙ ДЕТЕКТОР «муууу».

   Тонкая обвязка вокруг src/moo-core.ts: берёт микрофон, гоняет кадры
   звука через анализ и отдаёт наружу живые показатели (для му-метра)
   и один финальный вердикт.

   Приватность: поток живёт только во время попытки и выключается сразу,
   как только прозвучал вердикт. Ничего не записывается и не отправляется.
   ============================================================ */

import { MOO_CONFIG, MooTracker, analyzeFrame, type MooConfig, type MooLive, type MooVerdict } from './moo-core'

export type MicFailReason = 'unsupported' | 'denied' | 'no-device' | 'busy'

/** Микрофон не дался: вызывающий решает, звать ли режим «зажми и мычи». */
export class MicError extends Error {
  readonly reason: MicFailReason

  constructor(reason: MicFailReason) {
    super(`microphone: ${reason}`)
    this.name = 'MicError'
    this.reason = reason
  }
}

export interface MooHooks {
  onFrame?: (live: MooLive) => void
  onDone: (verdict: MooVerdict) => void
}

/** Подсказки по «гигиене» микрофона: обработчики речи съедают мычание. */
const MIC_HINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

function failReasonOf(err: unknown): MicFailReason | null {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no-device'
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'busy'
  return null
}

async function acquireStream(): Promise<MediaStream> {
  const media = navigator.mediaDevices
  try {
    return await media.getUserMedia({ audio: MIC_HINTS })
  } catch (err) {
    const known = failReasonOf(err)
    if (known) throw new MicError(known)
    // «подсказки» бывают не по вкусу браузеру — пробуем самое простое
    try {
      return await media.getUserMedia({ audio: true })
    } catch (err2) {
      throw new MicError(failReasonOf(err2) ?? 'busy')
    }
  }
}

export class MooDetector {
  private readonly ctxProvider: () => AudioContext
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private sink: GainNode | null = null
  private buf = new Float32Array(0)
  private raf = 0
  private startedAt = 0
  private windowMs = 85
  private running = false
  private tracker = new MooTracker()

  /** Контекст берём у «мычащего» движка: браузеры ограничивают число AudioContext. */
  constructor(getCtx: () => AudioContext) {
    this.ctxProvider = getCtx
  }

  /** Микрофон вообще возможен? На обычном HTTP `mediaDevices` не существует. */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia
    )
  }

  get listening(): boolean {
    return this.running
  }

  /** Начать попытку: при отказе микрофона бросит MicError, иначе позовёт onDone.
   * cfg позволяет менять планку попытки — например, тянуть дольше на длинных словах. */
  async start(hooks: MooHooks, cfg: MooConfig = MOO_CONFIG): Promise<void> {
    if (this.running) return
    if (!MooDetector.isSupported()) throw new MicError('unsupported')

    const ctx = this.ctxProvider()
    const stream = await acquireStream()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 4096
    analyser.smoothingTimeConstant = 0.5
    const source = ctx.createMediaStreamSource(stream)
    // глухой приёмник нужен лишь для того, чтобы граф гарантированно считался
    const sink = ctx.createGain()
    sink.gain.value = 0
    source.connect(analyser)
    analyser.connect(sink)
    sink.connect(ctx.destination)

    this.ctx = ctx
    this.stream = stream
    this.source = source
    this.analyser = analyser
    this.sink = sink
    this.buf = new Float32Array(analyser.fftSize)
    this.windowMs = (1000 * analyser.fftSize) / ctx.sampleRate
    this.tracker = new MooTracker(cfg, this.windowMs)
    this.startedAt = performance.now()
    this.running = true

    const loop = (): void => {
      const ctxNow = this.ctx
      const analyserNow = this.analyser
      if (!this.running || !ctxNow || !analyserNow) return
      analyserNow.getFloatTimeDomainData(this.buf)
      // метка времени — начало окна: кадр «мууу» подтверждает и следующие ~85 мс
      const t = Math.max(0, performance.now() - this.startedAt - this.windowMs)
      this.tracker.push(analyzeFrame(this.buf, ctxNow.sampleRate, MOO_CONFIG), t)
      hooks.onFrame?.(this.tracker.live())
      const verdict = this.tracker.result()
      if (verdict) {
        this.stop()
        hooks.onDone(verdict)
        return
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Остановить попытку и отпустить микрофон. Вердикт при этом не выдаётся. */
  stop(): void {
    this.running = false
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
    try {
      this.source?.disconnect()
    } catch {
      /* уже отключён */
    }
    try {
      this.analyser?.disconnect()
    } catch {
      /* уже отключён */
    }
    try {
      this.sink?.disconnect()
    } catch {
      /* уже отключён */
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.source = null
    this.analyser = null
    this.sink = null
  }
}
