export type Tail = 'n' | 'd' | 't' | 'r' | 's' | 'none'

export interface MooParams {
  /** базовая частота мычания, Гц; по умолчанию случайная 122–148 */
  freq?: number
  /** длительность «уууу», секунды */
  dur?: number
  /** финальная согласная, имитируется в конце мычания */
  tail?: Tail
  /** частота вибрато, Гц */
  vib?: number
  /** рычание (возмущённое мычание) */
  growl?: boolean
  /** сдвиг начала относительно текущего момента, секунды */
  at?: number
}

interface Voice {
  oscs: OscillatorNode[]
  lfo: OscillatorNode
  lp: BiquadFilterNode
  amp: GainNode
  freq: number
}

/**
 * Движок мычания Бынича: голос синтезируется целиком на Web Audio,
 * без единого сэмпла. Рецепт «мууууу»:
 *   два расстроенных sawtooth + треугольная субоктава (грудной тон)
 *   → полосовой формантный фильтр «у» (~500 Гц)
 *   → подвижный lowpass (атака «м» = закрытый фильтр)
 *   → огибающая громкости с провалом на финальной согласной.
 */
class MooEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private hold: Voice | null = null

  /** Создаёт AudioContext по первому пользовательскому жесту (autoplay policy). */
  ensure(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -20
      comp.ratio.value = 5
      const master = this.ctx.createGain()
      master.gain.value = 0.85
      master.connect(comp)
      comp.connect(this.ctx.destination)
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  now(): number {
    return this.ensure().currentTime
  }

  private buildVoice(freq: number, vib: number, growl = false): Voice {
    const ctx = this.ensure()
    const bus = ctx.createGain()
    bus.gain.value = growl ? 0.52 : 0.42

    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.value = freq
    const osc2 = ctx.createOscillator()
    osc2.type = 'sawtooth'
    osc2.frequency.value = freq * 1.008
    const sub = ctx.createOscillator()
    sub.type = 'triangle'
    sub.frequency.value = freq / 2

    const g1 = ctx.createGain()
    g1.gain.value = 0.55
    const g2 = ctx.createGain()
    g2.gain.value = growl ? 0.5 : 0.28
    const g3 = ctx.createGain()
    g3.gain.value = 0.5
    osc1.connect(g1)
    g1.connect(bus)
    osc2.connect(g2)
    g2.connect(bus)
    sub.connect(g3)
    g3.connect(bus)

    // вибрато — живое, чуть разное каждый раз
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = vib * (0.92 + Math.random() * 0.16)
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = freq * 0.02
    lfo.connect(lfoGain)
    lfoGain.connect(osc1.frequency)
    lfoGain.connect(osc2.frequency)

    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = 500
    formant.Q.value = 3.5
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.8
    const amp = ctx.createGain()
    amp.gain.value = 0
    bus.connect(formant)
    formant.connect(lp)
    lp.connect(amp)
    amp.connect(this.master!)

    return { oscs: [osc1, osc2, sub], lfo, lp, amp, freq }
  }

  /** Одно мычание. Возвращает длительность в секундах (для тайминга анимации). */
  moo(p: MooParams = {}): number {
    const ctx = this.ensure()
    const freq = p.freq ?? 122 + Math.random() * 26
    const dur = p.dur ?? 1.2
    const tail: Tail = p.tail ?? 'none'
    const v = this.buildVoice(freq, p.vib ?? 5.6, p.growl)
    const t0 = ctx.currentTime + (p.at ?? 0)
    const { oscs, lp, amp } = v
    const tailT = t0 + Math.max(0.18, dur - 0.1)
    const end = t0 + dur

    for (const o of oscs) o.start(t0)
    v.lfo.start(t0)

    // «м»: фильтр закрыт, потом раскрывается в «уууу»
    lp.frequency.setValueAtTime(170, t0)
    lp.frequency.linearRampToValueAtTime(760, t0 + 0.07)
    lp.frequency.linearRampToValueAtTime(500, t0 + Math.min(0.35, dur * 0.3))

    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.linearRampToValueAtTime(0.9, t0 + 0.06)

    const bendFreq = (mult: number, to: number): void => {
      for (const o of oscs) {
        const f = o.frequency.value
        o.frequency.setValueAtTime(f, to)
        o.frequency.linearRampToValueAtTime(f * mult, end + 0.08)
      }
    }

    switch (tail) {
      case 'n':
      case 'd':
        // носовое/взрывное затухание: провал громкости + падение тона
        lp.frequency.linearRampToValueAtTime(420, tailT)
        lp.frequency.linearRampToValueAtTime(260, end + 0.05)
        bendFreq(0.78, tailT)
        amp.gain.setValueAtTime(0.9, tailT)
        amp.gain.linearRampToValueAtTime(0.25, tailT + 0.045)
        amp.gain.linearRampToValueAtTime(0.42, tailT + 0.07)
        amp.gain.linearRampToValueAtTime(0.0001, end + 0.08)
        break
      case 't':
        // резкий стоп
        lp.frequency.linearRampToValueAtTime(500, tailT)
        amp.gain.setValueAtTime(0.9, tailT)
        amp.gain.linearRampToValueAtTime(0.0001, tailT + 0.02)
        break
      case 'r':
        // «р» — короткий подъём и заваливание тона
        bendFreq(0.7, tailT)
        for (const o of oscs) {
          const f = o.frequency.value
          o.frequency.setValueAtTime(f, tailT)
          o.frequency.linearRampToValueAtTime(f * 1.2, tailT + 0.05)
          o.frequency.linearRampToValueAtTime(f * 0.7, end + 0.08)
        }
        amp.gain.setValueAtTime(0.9, tailT)
        amp.gain.linearRampToValueAtTime(0.55, end)
        amp.gain.linearRampToValueAtTime(0.0001, end + 0.1)
        break
      case 's':
        amp.gain.setValueAtTime(0.9, tailT)
        amp.gain.linearRampToValueAtTime(0.0001, end + 0.12)
        lp.frequency.linearRampToValueAtTime(320, end + 0.1)
        break
      default:
        amp.gain.setValueAtTime(0.9, Math.max(t0 + 0.07, end - 0.12))
        amp.gain.linearRampToValueAtTime(0.0001, end + 0.1)
    }

    const stopAt = end + 0.16
    for (const o of oscs) o.stop(stopAt)
    v.lfo.stop(stopAt)
    return dur + 0.16
  }

  /** Мычит английское слово: финальная буква задаёт «хвост», длина — протяжность. */
  mooWord(word: string): number {
    const tails: Record<string, Tail> = { n: 'n', d: 'd', t: 't', r: 'r', s: 's' }
    const tail = tails[word[word.length - 1] ?? ''] ?? 'none'
    const dur = Math.min(0.55 + word.length * 0.24, 2)
    return this.moo({ dur, tail })
  }

  /** Возмущённое мычание (два низких рыка). */
  angry(): number {
    this.moo({ freq: 98, dur: 0.32, vib: 8, growl: true })
    this.moo({ freq: 88, dur: 0.55, vib: 9, growl: true, at: 0.45 })
    return 1.15
  }

  /** «Зажми и мычи»: тянет «мууууу», пока не вызовут endHold. */
  startHold(): void {
    if (this.hold) return
    const ctx = this.ensure()
    const freq = 118 + Math.random() * 24
    const v = this.buildVoice(freq, 5.8)
    const t = ctx.currentTime
    for (const o of v.oscs) o.start(t)
    v.lfo.start(t)
    v.lp.frequency.setValueAtTime(170, t)
    v.lp.frequency.linearRampToValueAtTime(560, t + 0.08)
    v.amp.gain.setValueAtTime(0.0001, t)
    v.amp.gain.linearRampToValueAtTime(0.85, t + 0.07)
    this.hold = v
  }

  endHold(): void {
    const v = this.hold
    if (!v) return
    this.hold = null
    const ctx = this.ctx!
    const t = ctx.currentTime
    for (const o of v.oscs) {
      const f = o.frequency.value
      o.frequency.setValueAtTime(f, t)
      o.frequency.linearRampToValueAtTime(f * 0.8, t + 0.22)
    }
    v.lp.frequency.linearRampToValueAtTime(240, t + 0.22)
    v.amp.gain.cancelScheduledValues(t)
    v.amp.gain.setValueAtTime(v.amp.gain.value, t)
    v.amp.gain.linearRampToValueAtTime(0.0001, t + 0.25)
    const stop = t + 0.3
    for (const o of v.oscs) o.stop(stop)
    v.lfo.stop(stop)
  }
}

export const engine = new MooEngine()
