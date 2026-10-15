export type Tail = 'n' | 'd' | 't' | 'r' | 's' | 'm' | 'none'

export interface MooParams {
  /** базовая частота мычания, Гц; по умолчанию случайная 122–148 */
  freq?: number
  /** длительность «уууу», секунды */
  dur?: number
  /** финальная согласная, имитируется в конце мычания */
  tail?: Tail
  /** частота вибрато, Гц */
  vib?: number
  /** рычание */
  growl?: boolean
  /** сдвиг начала относительно текущего момента, секунды */
  at?: number
  /** вопросительная интонация: «мууу?» */
  question?: boolean
  /** радостное короткое мычание с мажорным концом */
  happy?: boolean
  /** тише обычного (урчание) */
  quiet?: boolean
}

interface Voice {
  oscs: OscillatorNode[]
  lfo: OscillatorNode
  lfoGain: GainNode
  f1: BiquadFilterNode
  f2: BiquadFilterNode
  lp: BiquadFilterNode
  amp: GainNode
  /** громкость голосового тракта — выключаем на глухих согласных */
  bus: GainNode
  freq: number
  noise: AudioBufferSourceNode
  noiseGain: GainNode
  /** тракт согласных: тот же шум, но мимо формант — свистящие и взрывы */
  bp2: BiquadFilterNode
  ng2: GainNode
}

/** Затухающий шум — импульс для синтетического «реверба луга» (без сэмплов). */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/**
 * Движок мычания Бынича: голос синтезируется целиком на Web Audio.
 *
 * Рецепт «мууууу»: два расстроенных sawtooth + треугольная субоктава (грудной тон)
 *   → пара формантных фильтров /о/→/у/ (F1 480→330 Гц, F2 1000→720 Гц) —
 *     глиссандо формант читается как слог «мо-о-уу», а не статичный гул
 *   → контур тона, как у настоящего мычания: подъём — небольшая просадка — спад
 *   → вибрато, раскачивающееся не сразу, а к середине
 *   → придыхание на атаке («м») + короткий синтетический реверб луга.
 */
export class MooEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private hold: Voice | null = null
  /** фабрика контекста — подменяется в проверках, чтобы рендерить в OfflineAudioContext */
  private readonly ctxFactory: (() => AudioContext) | undefined

  constructor(ctxFactory?: () => AudioContext) {
    this.ctxFactory = ctxFactory
  }

  /** Создаёт AudioContext по первому пользовательскому жесту (autoplay policy). */
  ensure(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = this.ctxFactory ? this.ctxFactory() : new AC()

      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -20
      comp.ratio.value = 5
      comp.connect(ctx.destination)

      const master = ctx.createGain()
      master.gain.value = 0.85
      master.connect(comp)

      // «пространство луга»: короткая свёртка с затухающим шумом
      const conv = ctx.createConvolver()
      conv.buffer = makeImpulse(ctx, 0.9, 2.8)
      const wet = ctx.createGain()
      wet.gain.value = 0.14
      master.connect(conv)
      conv.connect(wet)
      wet.connect(comp)

      this.ctx = ctx
      this.master = master
      this.noiseBuf = makeNoise(ctx)
    }
    if (this.ctx.state === 'suspended' && this.ctx instanceof AudioContext) {
      void this.ctx.resume().catch(() => undefined)
    }
    return this.ctx
  }

  now(): number {
    return this.ensure().currentTime
  }

  private buildVoice(freq: number, vib: number, p: MooParams): Voice {
    const ctx = this.ensure()
    const bus = ctx.createGain()
    bus.gain.value = p.quiet ? 0.22 : p.growl ? 0.52 : 0.4

    const oscs: OscillatorNode[] = []
    const addOsc = (type: OscillatorType, f: number, g: number): void => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      const gain = ctx.createGain()
      gain.gain.value = g
      o.connect(gain)
      gain.connect(bus)
      oscs.push(o)
    }
    addOsc('sawtooth', freq, 0.55)
    addOsc('sawtooth', freq * 1.009, p.growl ? 0.5 : 0.3)
    addOsc('triangle', freq / 2, 0.5)
    if (p.happy) addOsc('square', freq * 2, 0.07)

    // вибрато с поздним раскачиванием
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = vib * (0.92 + Math.random() * 0.16)
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0
    lfo.connect(lfoGain)
    for (const o of oscs) lfoGain.connect(o.frequency)

    // придыхание на атаке — шёпот «м»
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuf
    noise.loop = true
    const nbp = ctx.createBiquadFilter()
    nbp.type = 'bandpass'
    nbp.frequency.value = 240
    nbp.Q.value = 1.2
    const ng = ctx.createGain()
    ng.gain.value = 0
    noise.connect(nbp)
    nbp.connect(ng)
    ng.connect(bus)

    // формантная пара /у/
    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = 6
    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'
    f2.Q.value = 8
    const f1g = ctx.createGain()
    f1g.gain.value = 1.5
    const f2g = ctx.createGain()
    f2g.gain.value = 1.1
    const sum = ctx.createGain()
    bus.connect(f1)
    f1.connect(f1g)
    f1g.connect(sum)
    bus.connect(f2)
    f2.connect(f2g)
    f2g.connect(sum)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.8
    const amp = ctx.createGain()
    amp.gain.value = 0
    sum.connect(lp)
    lp.connect(amp)
    amp.connect(this.master!)

    // тракт согласных: тот же шум идёт мимо формант и гласного фильтра —
    // свистящие «с/ш» и взрывы «т/д/к» не должны окрашиваться в «у»
    const nbp2 = ctx.createBiquadFilter()
    nbp2.type = 'bandpass'
    nbp2.frequency.value = 5000
    nbp2.Q.value = 1
    const ng2 = ctx.createGain()
    ng2.gain.value = 0
    noise.connect(nbp2)
    nbp2.connect(ng2)
    ng2.connect(amp)

    noise.start(ctx.currentTime)
    return { oscs, lfo, lfoGain, f1, f2, lp, amp, bus, freq, noise, noiseGain: ng, bp2: nbp2, ng2 }
  }

  /** Одно мычание. Возвращает длительность в секундах (для тайминга анимации). */
  moo(p: MooParams = {}): number {
    const ctx = this.ensure()
    const freq = p.freq ?? 122 + Math.random() * 26
    const dur = p.dur ?? 1.2
    const tail: Tail = p.tail ?? 'none'
    const level = p.quiet ? 0.4 : 0.85
    const v = this.buildVoice(freq, p.vib ?? 5.6, p)
    const t0 = ctx.currentTime + (p.at ?? 0)
    const mid = t0 + dur * 0.45
    const end = t0 + dur
    const tailT = t0 + Math.max(0.18, dur - 0.1)
    const { oscs, lfo, lfoGain, f1, f2, lp, amp } = v

    for (const o of oscs) o.start(t0)
    lfo.start(t0)

    // контур тона: живое мычание, а не ровный гул
    for (const o of oscs) {
      const fr = o.frequency
      fr.setValueAtTime(o.frequency.value, t0)
      if (p.question) {
        fr.linearRampToValueAtTime(freq * 0.96, mid)
        fr.linearRampToValueAtTime(freq * 1.3, end)
      } else if (p.happy) {
        fr.linearRampToValueAtTime(freq * 1.06, t0 + 0.1)
        fr.linearRampToValueAtTime(freq * 1.14, end)
      } else {
        fr.linearRampToValueAtTime(freq * 1.06, t0 + 0.12)
        fr.linearRampToValueAtTime(freq * 0.98, mid)
        fr.linearRampToValueAtTime(freq * 0.9, Math.max(mid + 0.01, end - 0.05))
      }
    }

    // форманты «мо→му»: язык (если бы он был) закрывается к «у»
    f1.frequency.setValueAtTime(480, t0)
    f1.frequency.linearRampToValueAtTime(330, t0 + 0.15)
    f2.frequency.setValueAtTime(1000, t0)
    f2.frequency.linearRampToValueAtTime(720, t0 + 0.25)
    if (p.question) {
      // вопрос приоткрывает «о» обратно
      f1.frequency.linearRampToValueAtTime(430, end)
      f2.frequency.linearRampToValueAtTime(950, end)
    }

    // «м»: рот закрыт — фильтр душится и раскрывается вместе с гласной
    lp.frequency.setValueAtTime(260, t0)
    lp.frequency.linearRampToValueAtTime(5200, t0 + 0.05)

    // вибрато к середине
    lfoGain.gain.setValueAtTime(0, t0)
    lfoGain.gain.setValueAtTime(0, t0 + 0.22)
    lfoGain.gain.linearRampToValueAtTime(freq * 0.022, t0 + 0.55)

    // придыхание «м» на атаке
    v.noiseGain.gain.setValueAtTime(p.quiet ? 0.05 : 0.12, t0)
    v.noiseGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.12)

    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.linearRampToValueAtTime(level, t0 + 0.06)

    switch (tail) {
      case 'n':
      case 'm':
      case 'd':
        // носовое/взрывное затухание: провал громкости на согласной
        amp.gain.setValueAtTime(level, tailT)
        amp.gain.linearRampToValueAtTime(level * 0.3, tailT + 0.045)
        amp.gain.linearRampToValueAtTime(level * 0.5, tailT + 0.07)
        amp.gain.setTargetAtTime(0.0001, end - 0.02, 0.03)
        f1.frequency.linearRampToValueAtTime(280, end + 0.05)
        break
      case 't':
        // резкий стоп
        amp.gain.setValueAtTime(level, tailT)
        amp.gain.linearRampToValueAtTime(0.0001, tailT + 0.02)
        break
      case 'r':
        amp.gain.setValueAtTime(level, tailT)
        amp.gain.linearRampToValueAtTime(level * 0.65, end)
        amp.gain.setTargetAtTime(0.0001, end, 0.03)
        break
      case 's':
        amp.gain.setValueAtTime(level, tailT)
        amp.gain.setTargetAtTime(0.0001, end, 0.04)
        break
      default:
        amp.gain.setValueAtTime(level, Math.max(t0 + 0.07, end - 0.12))
        amp.gain.setTargetAtTime(0.0001, end - 0.02, 0.03)
    }

    const stopAt = end + 0.2
    for (const o of oscs) o.stop(stopAt)
    lfo.stop(stopAt)
    v.noise.stop(Math.min(stopAt, t0 + 0.25))
    return dur + 0.16
  }

  /** Мычит слово: если есть «мини-МФА» — проговаривает по сегментам, иначе старый путь. */
  mooWord(word: string, phon?: string): number {
    if (phon) return this.mooPhonetic(phon)
    const tails: Record<string, Tail> = { n: 'n', d: 'd', t: 't', r: 'r', s: 's', m: 'm' }
    const tail = tails[word[word.length - 1] ?? ''] ?? 'none'
    const dur = Math.min(0.55 + word.length * 0.24, 2.05)
    return this.moo({ dur, tail })
  }

  /**
   * Посегментная озвучка «по-быньочьи».
   *
   * Строка вида «mu:nlait» читается посимвольно: гласные u/a/i/o/e задают
   * пару формант (двоеточие — тянем), согласные проигрываются настоящими
   * артикуляциями:
   *   m/n — носовой призвук (форманты вниз, голос тише);
   *   t/k — смычка (тишина) → взрыв (шумовой щелчок) → придыхание;
   *   d/b — звонкая смычка → мягкий взрыв;
   *   s   — свист (голос выключен, шум 6 кГц);
   *   c   — шипящая «ш» (шум 3 кГц), с «t» даёт аффрикату «ч»;
   *   r/l/w — скольжение формант.
   * Согласные больше не «провалы громкости», а отдельные звуки.
   */
  private mooPhonetic(phon: string): number {
    const ctx = this.ensure()
    const freq = 122 + Math.random() * 26
    const level = 0.85
    const v = this.buildVoice(freq, 5.6, {})
    const baseBus = v.bus.gain.value

    const t0 = ctx.currentTime + 0.02
    for (const o of v.oscs) o.start(t0)
    v.lfo.start(t0)

    // тракт открывается: «м» прикладывается и раскрывается в первую гласную
    v.lp.frequency.setValueAtTime(260, t0)
    v.lp.frequency.linearRampToValueAtTime(6200, t0 + 0.04)
    // придыхание «м» на атаке
    v.noiseGain.gain.setValueAtTime(0.14, t0)
    v.noiseGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.12)

    // вибрато раскачивается к середине слова
    v.lfoGain.gain.setValueAtTime(0, t0)
    v.lfoGain.gain.setValueAtTime(0, t0 + 0.2)

    const VOWELS: Record<string, { f1: number; f2: number }> = {
      u: { f1: 330, f2: 720 },
      a: { f1: 700, f2: 1150 },
      i: { f1: 300, f2: 2100 },
      o: { f1: 450, f2: 820 },
      e: { f1: 450, f2: 1700 },
    }

    const segs: Array<{ kind: string; long: boolean }> = []
    for (let i = 0; i < phon.length; i++) {
      const ch = phon[i]
      if (ch === ':') continue
      if (VOWELS[ch]) {
        const long = phon[i + 1] === ':'
        if (long) i++
        segs.push({ kind: ch, long })
        continue
      }
      segs.push({ kind: ch, long: false })
    }

    // фирменное «уууу» тянется тем щедрее, чем слово длиннее
    const longDur = Math.min(0.45 + phon.length * 0.025, 0.85)
    const durOf = (seg: { kind: string; long: boolean }): number => {
      if (seg.kind in VOWELS) return seg.long ? longDur : 0.13
      switch (seg.kind) {
        case 'm': return 0.11
        case 'n': return 0.1
        case 's': return 0.14
        case 'z': return 0.1
        case 'c': return 0.14
        case 'r': case 'l': case 'w': return 0.1
        case 'd': case 'b': return 0.07
        case 't': case 'k': return 0.12
        default: return 0.08
      }
    }

    let total = segs.reduce((sum, s) => sum + durOf(s), 0)
    const scale = total > 2.2 ? 2.2 / total : 1

    const formants = (at: number, f1: number, f2: number): void => {
      v.f1.frequency.setTargetAtTime(f1, at, 0.028)
      v.f2.frequency.setTargetAtTime(f2, at, 0.028)
    }

    let t = t0
    // линейный рэмп начинается от предыдущего события автоматизации, поэтому
    // значение-якорь нужно именно запланированное, а не «текущее» в момент
    // планирования — иначе посреди слова появляются ступеньки в тишину
    let ampAt = 0.0001
    const rampAmp = (target: number, at: number, ramp: number): void => {
      v.amp.gain.setValueAtTime(ampAt, at)
      v.amp.gain.linearRampToValueAtTime(target, at + ramp)
      ampAt = target
    }
    for (const seg of segs) {
      const dur = durOf(seg) * scale
      const kind = seg.kind
      if (kind in VOWELS) {
        formants(t, VOWELS[kind].f1, VOWELS[kind].f2)
        v.bus.gain.setTargetAtTime(baseBus, t, 0.02)
        v.ng2.gain.setTargetAtTime(0, t, 0.02)
        rampAmp(level * (seg.long ? 1 : 0.8), t, Math.min(0.05, dur / 2))
        t += dur
        continue
      }
      switch (kind) {
        case 'm':
        case 'n': {
          // носовой: форманты проваливаются вниз, голос тише, но не гаснет
          formants(t, 260, kind === 'm' ? 900 : 1500)
          v.bus.gain.setTargetAtTime(baseBus * 0.85, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.02)
          rampAmp(level * 0.42, t, 0.03)
          t += dur
          break
        }
        case 's': {
          // свист: голос выключен, шум с наклоном вниз и «дыханием» громкости —
          // статичный узкий гул свистел бы, а не шипел
          v.bus.gain.setTargetAtTime(0.001, t, 0.02)
          v.bp2.frequency.setTargetAtTime(5900, t, 0.03)
          v.bp2.frequency.setTargetAtTime(5300, t + dur * 0.5, 0.05)
          v.bp2.Q.setTargetAtTime(1, t, 0.02)
          v.ng2.gain.setValueAtTime(0, t)
          v.ng2.gain.linearRampToValueAtTime(0.42, t + 0.02)
          v.ng2.gain.setTargetAtTime(0.34, t + 0.03, 0.06)
          rampAmp(level * 0.42, t, 0.025)
          rampAmp(level * 0.3, t + dur * 0.55, dur * 0.45)
          t += dur
          break
        }
        case 'z': {
          // звонкий «з»: шум 6 кГц поверх приглушённого голоса
          v.bus.gain.setTargetAtTime(baseBus * 0.5, t, 0.02)
          v.bp2.frequency.setTargetAtTime(5900, t, 0.03)
          v.bp2.Q.setTargetAtTime(1, t, 0.02)
          v.ng2.gain.setTargetAtTime(0.28, t, 0.02)
          rampAmp(level * 0.38, t, 0.03)
          t += dur
          break
        }
        case 'c': {
          // шипящая «ш»: широкий шумовой горб 1–4,5 кГц с оседанием вниз,
          // без него узкая полоса свистит как сирена
          v.bus.gain.setTargetAtTime(0.001, t, 0.02)
          v.bp2.frequency.setTargetAtTime(2800, t, 0.03)
          v.bp2.frequency.setTargetAtTime(2300, t + dur * 0.5, 0.05)
          v.bp2.Q.setTargetAtTime(0.75, t, 0.02)
          v.ng2.gain.setValueAtTime(0, t)
          v.ng2.gain.linearRampToValueAtTime(0.5, t + 0.025)
          v.ng2.gain.setTargetAtTime(0.4, t + 0.035, 0.06)
          rampAmp(level * 0.5, t, 0.03)
          rampAmp(level * 0.38, t + dur * 0.55, dur * 0.45)
          t += dur
          break
        }
        case 't':
        case 'k': {
          // глухая смычка: голос выключен до конца взрыва и придыхания
          v.bus.gain.setTargetAtTime(0.001, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.015)
          rampAmp(0.001, t, 0.015)
          t += 0.05 * scale
          v.bp2.frequency.setValueAtTime(kind === 'k' ? 3200 : 4300, t)
          v.bp2.Q.setValueAtTime(1.2, t)
          v.ng2.gain.setValueAtTime(0.75, t)
          rampAmp(level * 0.7, t, 0.008)
          v.ng2.gain.setTargetAtTime(0, t + 0.025, 0.01)
          t += 0.025 * scale
          v.bp2.frequency.setTargetAtTime(1700, t, 0.02)
          v.ng2.gain.setTargetAtTime(0.16, t, 0.02)
          rampAmp(level * 0.25, t, 0.03)
          t += 0.045 * scale
          break
        }
        case 'd':
        case 'b': {
          // звонкая смычка: голос почти не гаснет, взрыв мягче
          v.bus.gain.setTargetAtTime(baseBus * 0.9, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.015)
          rampAmp(0.05, t, 0.015)
          t += 0.045 * scale
          v.bp2.frequency.setValueAtTime(kind === 'b' ? 1000 : 2600, t)
          v.ng2.gain.setValueAtTime(0.55, t)
          rampAmp(level * 0.6, t, 0.008)
          v.ng2.gain.setTargetAtTime(0, t + 0.025, 0.012)
          t += 0.025 * scale
          break
        }
        case 'r': {
          formants(t, 340, 1150)
          v.bus.gain.setTargetAtTime(baseBus, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.02)
          rampAmp(level * 0.6, t, 0.03)
          t += dur
          break
        }
        case 'l': {
          formants(t, 360, 950)
          v.bus.gain.setTargetAtTime(baseBus, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.02)
          rampAmp(level * 0.6, t, 0.03)
          t += dur
          break
        }
        case 'w': {
          formants(t, 300, 650)
          v.bus.gain.setTargetAtTime(baseBus, t, 0.02)
          v.ng2.gain.setTargetAtTime(0, t, 0.02)
          rampAmp(level * 0.6, t, 0.03)
          t += dur
          break
        }
        default: {
          t += dur
        }
      }
    }

    const end = t
    v.amp.gain.setTargetAtTime(0.0001, end - 0.02, 0.045)
    v.bus.gain.setTargetAtTime(baseBus, end, 0.05)
    v.lfoGain.gain.setValueAtTime(0, t0 + 0.2)
    v.lfoGain.gain.linearRampToValueAtTime(freq * 0.02, t0 + Math.min(0.6, (end - t0) * 0.6))

    const stopAt = end + 0.25
    for (const o of v.oscs) o.stop(stopAt)
    v.lfo.stop(stopAt)
    // шум нужен согласным до самого конца — раньше он обрезался на 0,2 с
    v.noise.stop(stopAt)
    return end - t0 + 0.16
  }

  /** Утвердительное «му-му» (кивок). */
  nod(): number {
    this.moo({ freq: 150, dur: 0.26, quiet: true })
    this.moo({ freq: 158, dur: 0.3, quiet: true, at: 0.34 })
    return 0.75
  }

  /** «Мууу?» — недоумение. */
  question(): number {
    return this.moo({ freq: 138, dur: 0.75, question: true, quiet: true })
  }

  /** Радостное короткое. */
  happyMoo(): number {
    return this.moo({ freq: 175, dur: 0.45, happy: true, quiet: true })
  }

  /** Урчание довольного быка. */
  purr(): number {
    return this.moo({ freq: 74, dur: 1.6, vib: 4, quiet: true })
  }

  /** Фанфары: три восходящих мычания. */
  fanfare(): number {
    this.moo({ freq: 150, dur: 0.4, happy: true, quiet: true })
    this.moo({ freq: 182, dur: 0.4, happy: true, quiet: true, at: 0.5 })
    this.moo({ freq: 218, dur: 0.8, happy: true, at: 1.0 })
    return 2.1
  }

  /** «Зажми и мычи»: тянет «мууууу» с медленным нарастанием, пока не вызовут endHold. */
  startHold(): void {
    if (this.hold) return
    const ctx = this.ensure()
    const freq = 118 + Math.random() * 24
    const v = this.buildVoice(freq, 5.8, {})
    const t = ctx.currentTime
    for (const o of v.oscs) o.start(t)
    v.lfo.start(t)
    v.noise.stop(t + 0.25)

    // форманты и атака
    v.f1.frequency.setValueAtTime(480, t)
    v.f1.frequency.linearRampToValueAtTime(330, t + 0.15)
    v.f2.frequency.setValueAtTime(1000, t)
    v.f2.frequency.linearRampToValueAtTime(720, t + 0.25)
    v.lp.frequency.setValueAtTime(260, t)
    v.lp.frequency.linearRampToValueAtTime(5200, t + 0.05)
    v.noiseGain.gain.setValueAtTime(0.1, t)
    v.noiseGain.gain.linearRampToValueAtTime(0.0001, t + 0.12)
    v.amp.gain.setValueAtTime(0.0001, t)
    v.amp.gain.linearRampToValueAtTime(0.8, t + 0.07)

    // нарастание: тон и вибрато медленно растут, будто бык входит во вкус
    v.lfoGain.gain.setValueAtTime(freq * 0.02, t + 0.3)
    v.lfoGain.gain.linearRampToValueAtTime(freq * 0.035, t + 6)
    for (const o of v.oscs) {
      o.frequency.setValueAtTime(o.frequency.value, t + 0.3)
      o.frequency.linearRampToValueAtTime(o.frequency.value * 1.16, t + 7)
    }

    this.hold = v
  }

  endHold(): void {
    const v = this.hold
    if (!v) return
    this.hold = null
    const ctx = this.ctx!
    const t = ctx.currentTime
    for (const o of v.oscs) {
      o.frequency.cancelScheduledValues(t)
      o.frequency.setValueAtTime(o.frequency.value, t)
      o.frequency.linearRampToValueAtTime(o.frequency.value * 0.8, t + 0.22)
    }
    v.lp.frequency.linearRampToValueAtTime(240, t + 0.22)
    v.f1.frequency.linearRampToValueAtTime(280, t + 0.22)
    v.amp.gain.cancelScheduledValues(t)
    v.amp.gain.setValueAtTime(v.amp.gain.value, t)
    v.amp.gain.setTargetAtTime(0.0001, t, 0.06)
    const stop = t + 0.35
    for (const o of v.oscs) o.stop(stop)
    v.lfo.stop(stop)
  }
}

export const engine = new MooEngine()
