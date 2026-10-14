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
  freq: number
  noise: AudioBufferSourceNode
  noiseGain: GainNode
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
class MooEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private hold: Voice | null = null

  /** Создаёт AudioContext по первому пользовательскому жесту (autoplay policy). */
  ensure(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()

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
    if (this.ctx.state === 'suspended') void this.ctx.resume()
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

    noise.start(ctx.currentTime)
    return { oscs, lfo, lfoGain, f1, f2, lp, amp, freq, noise, noiseGain: ng }
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

  /** Мычит английское слово: финальная буква задаёт «хвост», длина — протяжность. */
  mooWord(word: string): number {
    const tails: Record<string, Tail> = { n: 'n', d: 'd', t: 't', r: 'r', s: 's', m: 'm' }
    const tail = tails[word[word.length - 1] ?? ''] ?? 'none'
    const dur = Math.min(0.55 + word.length * 0.24, 2.05)
    return this.moo({ dur, tail })
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
