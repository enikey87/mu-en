import './styles.css'
import { engine } from './audio'
import { WORDS, LEVELS, type Word } from './words'
import { MooDetector, MicError, type MicFailReason } from './moo-detector'
import type { MooFailReason, MooLive, MooVerdict } from './moo-core'

const bull = document.getElementById('byanych') as SVGSVGElement | null
const bubbleEl = document.getElementById('bubble')
const body = document.body

// ---------- речевой пузырь ----------
let bubbleTimer = 0
const bubble = (text: string, ms = 1500): void => {
  if (!bubbleEl) return
  bubbleEl.textContent = text
  bubbleEl.classList.add('bubble--show')
  window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => bubbleEl.classList.remove('bubble--show'), ms)
}

// ---------- состояние «мычит» ----------
let mooingTimer = 0
const setMooing = (ms: number): void => {
  bull?.classList.add('bull--mooing')
  window.clearTimeout(mooingTimer)
  mooingTimer = window.setTimeout(() => bull?.classList.remove('bull--mooing'), ms)
}

// ---------- выразительные состояния ----------
let puzzledTimer = 0
const puzzled = (ms = 1500): void => {
  bull?.classList.add('bull--puzzled')
  window.clearTimeout(puzzledTimer)
  puzzledTimer = window.setTimeout(() => bull?.classList.remove('bull--puzzled'), ms)
}

const nod = (): void => {
  bull?.classList.add('bull--nod')
  window.setTimeout(() => bull?.classList.remove('bull--nod'), 600)
}

// ---------- конфетти ----------
const CONFETTI_COLORS = ['#ff8a3d', '#2fb8a6', '#8e6fd8', '#f2698f', '#8fc63d', '#f7b32b']
const confetti = (n = 26): void => {
  for (let i = 0; i < n; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti'
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!
    piece.style.animationDuration = `${1.5 + Math.random() * 1.2}s`
    piece.style.animationDelay = `${Math.random() * 0.4}s`
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    piece.addEventListener('animationend', () => piece.remove())
    body.append(piece)
  }
}

if (bull) {
  // ---------- глаза следят за курсором/пальцем ----------
  const pupilL = document.getElementById('pupil-l')
  const pupilR = document.getElementById('pupil-r')
  const lookAt = (x: number, y: number): void => {
    const r = bull.getBoundingClientRect()
    if (r.width === 0) return
    const cx = r.left + r.width / 2
    const cy = r.top + r.height * 0.36 // уровень глаз
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    const k = (Math.min(len, 260) / 260) * 8
    const ox = ((dx / len) * k).toFixed(1)
    const oy = ((dy / len) * k).toFixed(1)
    const t = `translate(${ox} ${oy})`
    pupilL?.setAttribute('transform', t)
    pupilR?.setAttribute('transform', t)
  }
  window.addEventListener('pointermove', (e) => lookAt(e.clientX, e.clientY), { passive: true })
  window.addEventListener('pointerdown', (e) => lookAt(e.clientX, e.clientY), { passive: true })

  // ---------- моргание ----------
  const eyes = document.querySelectorAll('.eye')
  const scheduleBlink = (): void => {
    window.setTimeout(
      () => {
        eyes.forEach((e) => e.classList.add('eye--blink'))
        window.setTimeout(() => eyes.forEach((e) => e.classList.remove('eye--blink')), 180)
        scheduleBlink()
      },
      2600 + Math.random() * 3000,
    )
  }
  scheduleBlink()

  // ---------- поглаживание по голове ----------
  const head = document.getElementById('head')
  let purrTimer = 0
  let purrCooldownUntil = 0
  if (head) {
    head.addEventListener('pointerenter', () => {
      bull.classList.add('bull--happy')
      window.clearTimeout(purrTimer)
      purrTimer = window.setTimeout(() => {
        if (Date.now() < purrCooldownUntil) return
        purrCooldownUntil = Date.now() + 6000
        engine.purr()
        bubble('Мур-р-му.', 1300)
      }, 1200)
    })
    head.addEventListener('pointerleave', () => {
      bull.classList.remove('bull--happy')
      window.clearTimeout(purrTimer)
    })
  }

  // ---------- прогресс обучения ----------
  const LS_KEY = 'mu-en-learned'
  let learned: string[] = []
  try {
    learned = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as string[]
    if (!Array.isArray(learned)) learned = []
  } catch {
    learned = []
  }
  let celebrated = learned.length >= WORDS.length

  const progressFill = document.getElementById('progress-fill')
  const progressText = document.getElementById('progress-text')
  const updateProgress = (): void => {
    const n = learned.length
    if (progressFill) progressFill.style.width = `${(n / WORDS.length) * 100}%`
    if (progressText) progressText.textContent = `выучено ${n} из ${WORDS.length}`
  }

  const celebrate = (): void => {
    const d = engine.fanfare()
    setMooing(d * 1000)
    confetti(40)
    bubble('Вся программа!', 2000)
    window.setTimeout(() => {
      document.getElementById('diploma')?.removeAttribute('hidden')
      confetti(20)
    }, 1600)
  }

  const markLearned = (w: Word): void => {
    if (!learned.includes(w.en)) {
      learned.push(w.en)
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(learned))
      } catch {
        /* приватный режим — Бынич переживёт */
      }
    }
    updateProgress()
    if (!celebrated && learned.length >= WORDS.length) {
      celebrated = true
      window.setTimeout(celebrate, 700)
    }
  }
  updateProgress()

  // ---------- микрофонный экзамен «мууу» ----------
  // Галочка ставится только за настоящее, громкое и протяжное «муууу» в микрофон.
  // Клик по слову просто озвучивает его. Если микрофон закрыт — карточка
  // переключается в режим «зажми и мычи».
  type MicState = 'idle' | 'listening' | 'done' | 'hold' | 'hold-active'
  type CardMode = 'mic' | 'hold'

  interface CardCtl {
    word: Word
    root: HTMLElement
    mic: HTMLButtonElement
    micLabel: HTMLElement
    meter: HTMLElement
    meterFill: HTMLElement
    meterKeep: HTMLElement
    mode: CardMode
    state: MicState
  }

  const MIC_ICON =
    '<svg class="card__mic-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3Z" fill="currentColor"/>' +
    '<path d="M6.2 11.4a5.8 5.8 0 0 0 11.6 0M12 17.2V20.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

  // подсказка «нажми — услышишь»: появляется у слова при наведении
  const SPEAKER_ICON =
    '<svg class="card__speaker" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill="currentColor"/>' +
    '<path d="M15.4 9a4.3 4.3 0 0 1 0 6M18.1 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

  const MIC_LABELS: Record<MicState, string> = {
    idle: 'Сказать «мууу»',
    listening: 'Слушаю…',
    done: 'Мууу засчитано',
    hold: 'Зажми и мычи',
    'hold-active': 'Мууууу…',
  }

  const MOO_HINTS: Record<MooFailReason, string> = {
    quiet: 'Тихо! Скажи громко: мууууу',
    'not-moo': 'Это было не мууу.',
    short: 'Тяни дольше: мууууу',
    timeout: 'Не расслышал мууу.',
  }

  const MIC_BLOCKED: Record<MicFailReason, string> = {
    unsupported: 'Тут микрофон не работает. Зажми кнопку и мычи сам!',
    denied: 'Микрофон закрыт. Тогда зажми и мычи сам!',
    'no-device': 'Микрофона нет. Тогда зажми и мычи сам!',
    busy: 'Микрофон занят кем-то другим. Зажми и мычи сам!',
  }

  const HOLD_MIN_MS = 1000

  const detector = new MooDetector(() => engine.ensure())
  const micSupported = MooDetector.isSupported()
  const cards = new Map<string, CardCtl>()
  let micBlocked = !micSupported
  let activeListening: CardCtl | null = null
  let lastHoldEnd = 0

  const setMicState = (ctl: CardCtl, state: MicState): void => {
    ctl.state = state
    ctl.mic.dataset.state = state
    ctl.micLabel.textContent = MIC_LABELS[state]
    ctl.mic.setAttribute('aria-busy', state === 'listening' ? 'true' : 'false')
    ctl.mic.setAttribute('aria-label', `${MIC_LABELS[state]}: ${ctl.word.en} — ${ctl.word.ru}`)
  }

  /** Спокойное состояние кнопки: выученное слово всегда показывает «засчитано». */
  const settleMic = (ctl: CardCtl): void => {
    if (ctl.state === 'listening' || ctl.state === 'hold-active') return
    setMicState(ctl, learned.includes(ctl.word.en) ? 'done' : micBlocked ? 'hold' : 'idle')
  }

  const setMeter = (ctl: CardCtl, live: MooLive | null): void => {
    if (!live) {
      ctl.meter.classList.remove('card__meter--on', 'card__meter--good')
      ctl.meterFill.style.width = '0%'
      ctl.meterKeep.style.width = '0%'
      return
    }
    ctl.meter.classList.add('card__meter--on')
    ctl.meter.classList.toggle('card__meter--good', live.moo)
    ctl.meterFill.style.width = `${Math.round(live.level * 100)}%`
    ctl.meterKeep.style.width = `${Math.round(live.progress * 100)}%`
  }

  const clearListening = (ctl: CardCtl): void => {
    ctl.root.classList.remove('card--listening')
    bull.classList.remove('bull--listening')
    // прослушивание окончено — кнопку снова можно пересобирать
    ctl.state = 'idle'
    setMeter(ctl, null)
    if (activeListening === ctl) activeListening = null
  }

  const passMoo = (ctl: CardCtl): void => {
    const w = ctl.word
    const again = learned.includes(w.en)
    ctl.root.classList.add('card--learned')
    setMicState(ctl, 'done')
    const d = engine.happyMoo()
    setMooing(d * 1000 + 150)
    confetti(again ? 10 : 22)
    bubble(again ? 'Снова мууу!' : 'Мууу засчитано!', 1800)
    markLearned(w)
    // слово вслух — награда. Если это было последнее слово программы,
    // вместо озвучки играет фанфара и выдаётся диплом.
    if (!again && learned.length < WORDS.length) {
      window.setTimeout(() => playWord(w, ctl.root, false), 900)
    }
  }

  const failMoo = (ctl: CardCtl, reason: MooFailReason): void => {
    engine.question()
    puzzled(1700)
    bubble(MOO_HINTS[reason], 2200)
    settleMic(ctl)
  }

  const finishAttempt = (ctl: CardCtl, verdict: MooVerdict): void => {
    clearListening(ctl)
    if (verdict.ok) passMoo(ctl)
    else failMoo(ctl, verdict.reason)
  }

  /** Микрофон не дался: все карточки переходят в режим «зажми и мычи». */
  const goHoldMode = (reason: MicFailReason): void => {
    micBlocked = true
    for (const ctl of cards.values()) {
      ctl.mode = 'hold'
      settleMic(ctl)
    }
    engine.question()
    puzzled(1500)
    bubble(MIC_BLOCKED[reason], 3000)
  }

  const onMicPress = async (ctl: CardCtl): Promise<void> => {
    if (ctl.state === 'listening') {
      // передумал: отпускаем микрофон без вердикта
      detector.stop()
      clearListening(ctl)
      settleMic(ctl)
      return
    }
    if (ctl.mode === 'hold') {
      bubble('Зажми и мычи!', 1200)
      return
    }
    if (activeListening) {
      bubble('Дослушаю мууу…', 1200)
      return
    }

    activeListening = ctl
    ctl.root.classList.add('card--listening')
    bull.classList.add('bull--listening')
    setMicState(ctl, 'listening')
    setMeter(ctl, null)
    bubble('Слушаю… скажи громко: мууууу', 2200)
    try {
      await detector.start({
        onFrame: (live) => setMeter(ctl, live),
        onDone: (verdict) => finishAttempt(ctl, verdict),
      })
    } catch (err) {
      clearListening(ctl)
      goHoldMode(err instanceof MicError ? err.reason : 'busy')
    }
  }

  // ---------- «зажми и мычи» вместо микрофона ----------
  let holdCtl: CardCtl | null = null
  let holdStartedAt = 0
  let cardHoldSafety = 0

  const holdBegin = (ctl: CardCtl, e: PointerEvent): void => {
    if (ctl.mode !== 'hold' || holdCtl) return
    e.preventDefault()
    holdCtl = ctl
    holdStartedAt = performance.now()
    try {
      ctl.mic.setPointerCapture?.(e.pointerId)
    } catch {
      // синтетический/неактивный пойнтер — мычание важнее
    }
    engine.startHold()
    bull.classList.add('bull--mooing')
    window.clearTimeout(mooingTimer)
    setMicState(ctl, 'hold-active')
    ctl.root.classList.add('card--listening')
    bubble('Мычи!', 900)
    window.clearTimeout(cardHoldSafety)
    cardHoldSafety = window.setTimeout(() => holdFinish(), 8000) // страховка на упорного быка
  }

  const holdFinish = (): void => {
    const ctl = holdCtl
    if (!ctl) return
    const heldMs = performance.now() - holdStartedAt
    holdCtl = null
    lastHoldEnd = performance.now()
    window.clearTimeout(cardHoldSafety)
    engine.endHold()
    setMooing(350)
    clearListening(ctl)
    if (heldMs >= HOLD_MIN_MS) {
      passMoo(ctl)
    } else {
      engine.question()
      puzzled(1500)
      bubble('Мало. Зажми и держи!', 1800)
      settleMic(ctl)
    }
  }

  // ---------- программа: карточки по уровням ----------
  const playWord = (w: Word, el?: HTMLElement, withBubble = true): void => {
    const d = engine.mooWord(w.en)
    setMooing(d * 1000 + 120)
    if (withBubble) bubble(`${w.say.toUpperCase()}!`, Math.max(1100, d * 800))
    if (el) {
      el.classList.add('card--active')
      window.setTimeout(() => el.classList.remove('card--active'), d * 1000)
    }
  }

  const programLevels = document.getElementById('program-levels')
  if (programLevels) {
    for (const lvl of LEVELS) {
      const levelBox = document.createElement('div')
      levelBox.className = 'level'
      const levelName = document.createElement('h3')
      levelName.className = 'level__name'
      levelName.textContent = lvl.name
      const grid = document.createElement('div')
      grid.className = 'cards'
      for (const w of WORDS.filter((x) => x.level === lvl.id)) {
        const el = document.createElement('article')
        el.className = 'card'
        if (learned.includes(w.en)) el.classList.add('card--learned')
        el.innerHTML = `
          <button class="card__play" type="button" aria-label="Послушать слово ${w.en}">
            <span class="card__head">
              <span class="card__en">${w.en}</span>
              ${SPEAKER_ICON}
            </span>
            <span class="card__say">${w.say}</span>
            <span class="card__ru">${w.ru}</span>
          </button>
          <span class="card__tip">${w.tip}</span>
          <button class="card__mic" type="button">
            ${MIC_ICON}
            <span class="card__mic-label"></span>
          </button>
          <div class="card__meter" aria-hidden="true">
            <div class="card__meter-keep"></div>
            <div class="card__meter-fill"></div>
          </div>
          <span class="card__check" role="img" aria-label="выучено">✓</span>`
        const ctl: CardCtl = {
          word: w,
          root: el,
          mic: el.querySelector('.card__mic') as HTMLButtonElement,
          micLabel: el.querySelector('.card__mic-label') as HTMLElement,
          meter: el.querySelector('.card__meter') as HTMLElement,
          meterFill: el.querySelector('.card__meter-fill') as HTMLElement,
          meterKeep: el.querySelector('.card__meter-keep') as HTMLElement,
          mode: micBlocked ? 'hold' : 'mic',
          state: 'idle',
        }
        // клик в любое место карточки озвучивает слово — кроме кнопки «мууу»
        el.addEventListener('click', (e) => {
          const target = e.target as Element | null
          if (target?.closest('.card__mic')) return
          playWord(w, el)
        })
        ctl.mic.addEventListener('click', () => {
          if (performance.now() - lastHoldEnd < 400) return // это хвост «зажми и мычи»
          void onMicPress(ctl)
        })
        ctl.mic.addEventListener('pointerdown', (e) => holdBegin(ctl, e))
        ctl.mic.addEventListener('pointerup', () => {
          if (holdCtl === ctl) holdFinish()
        })
        ctl.mic.addEventListener('pointercancel', () => {
          if (holdCtl === ctl) holdFinish()
        })
        cards.set(w.en, ctl)
        settleMic(ctl)
        grid.append(el)
      }
      levelBox.append(levelName, grid)
      programLevels.append(levelBox)
    }
  }

  // ---------- словарь под рукой ----------
  const askForm = document.getElementById('ask-form') as HTMLFormElement | null
  const askInput = document.getElementById('ask-input') as HTMLInputElement | null
  const dictEn = new Map(WORDS.map((w) => [w.en, w] as const))
  const dictRu = new Map(WORDS.map((w) => [w.ru, w] as const))
  const ALIASES: Record<string, string> = {
    му: 'moo',
    mu: 'moo',
    мычание: 'moo',
    мур: 'moor',
    муур: 'moor',
  }
  let askFails = 0

  askForm?.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!askInput) return
    const v = askInput.value.trim().toLowerCase()
    if (!v) {
      bubble('?..', 1000)
      return
    }
    if (v === 'honeymoon' || v === 'ханимун') {
      // пасхалка: половину слова всё-таки знает
      const w = dictEn.get('moon')
      puzzled(1800)
      engine.question()
      bubble('Знаю только вторую половину.', 1900)
      if (w) window.setTimeout(() => playWord(w, undefined, false), 2000)
      return
    }
    const w = dictEn.get(v) ?? dictRu.get(v) ?? dictEn.get(ALIASES[v] ?? '')
    if (w) {
      askFails = 0
      playWord(w, undefined, false)
      bubble(`${w.en} — ${w.ru}.`, 1600)
      // галочку даёт только мууу в микрофон; здесь лишь подсвечиваем карточку
      const ctl = cards.get(w.en)
      if (ctl) {
        ctl.root.classList.add('card--active')
        window.setTimeout(() => ctl.root.classList.remove('card--active'), 900)
      }
    } else if (v.startsWith('moo')) {
      // слово начинается как надо — значит, существует; Бынич произносит его уверенно
      askFails = 0
      const d = engine.mooWord(v)
      setMooing(d * 1000 + 120)
      bubble('Есть такое слово.', 1500)
    } else {
      askFails++
      engine.question()
      puzzled(1800)
      if (askFails === 2) bubble('И этого нет.', 1600)
      else if (askFails >= 3) bubble('Есть только слова из программы.', 1800)
      else bubble('Такого слова нет.', 1500)
    }
    askInput.value = ''
  })

  // ---------- Бынич следует за прокруткой ----------
  // В hero фиксированный слой в точности накрывает плейсхолдер (.hero__stage).
  // Когда hero прокручен, Бынич «причаливает» в правый нижний угол и остаётся компаньоном.
  const stage = document.getElementById('hero-stage')
  const mascot = document.getElementById('mascot')
  if (stage && mascot) {
    const place = (): void => {
      const r = stage.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const docked = r.bottom < 140
      if (docked) {
        // на телефоне компаньон мельче: не заслоняет карточки
        const w = Math.max(88, Math.min(160, vw * 0.15))
        mascot.style.width = `${w}px`
        mascot.style.left = `${vw - w - 14}px`
        mascot.style.top = `${vh - w * (470 / 420) - 14}px`
      } else {
        mascot.style.width = `${r.width}px`
        mascot.style.left = `${r.left}px`
        mascot.style.top = `${r.top}px`
      }
      mascot.classList.toggle('mascot--docked', docked)
    }
    let placeRaf = 0
    window.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(placeRaf)
        placeRaf = requestAnimationFrame(place)
      },
      { passive: true },
    )
    window.addEventListener('resize', place)
    place()
  }

  // ---------- «Познакомиться» ----------
  const meetBtn = document.getElementById('meet-btn') as HTMLButtonElement | null
  let greeting = false
  meetBtn?.addEventListener('click', () => {
    if (greeting) return
    greeting = true
    meetBtn.disabled = true
    const parts = [
      { text: 'Мууу!', freq: 132, dur: 0.95 },
      { text: 'Ай', freq: 196, dur: 0.3 },
      { text: 'эм', freq: 165, dur: 0.3 },
      { text: 'Бынич!', freq: 147, dur: 0.5 },
    ]
    let off = 0
    for (const p of parts) {
      engine.moo({ freq: p.freq, dur: p.dur, at: off })
      const t = off
      window.setTimeout(() => bubble(p.text, 750), t * 1000)
      off += p.dur + 0.18
    }
    setMooing(off * 1000 + 200)
    window.setTimeout(
      () => {
        greeting = false
        meetBtn.disabled = false
      },
      (off + 0.4) * 1000,
    )
  })

  // ---------- «зажми и мычи» ----------
  const holdBtn = document.getElementById('hold-btn')
  let holding = false
  let holdSafety = 0
  const holdStart = (ev: Event): void => {
    const e = ev as PointerEvent
    if (holding) return
    holding = true
    const target = e.currentTarget as HTMLElement
    try {
      target.setPointerCapture?.(e.pointerId)
    } catch {
      // синтетический/неактивный пойнтер — не страшно, мычание важнее
    }
    engine.startHold()
    bull.classList.add('bull--mooing')
    window.clearTimeout(mooingTimer)
    lookAt(e.clientX, e.clientY)
    window.clearTimeout(holdSafety)
    holdSafety = window.setTimeout(holdEnd, 8000) // страховка: даже самый упорный бык выдыхает
  }
  const holdEnd = (): void => {
    if (!holding) return
    holding = false
    window.clearTimeout(holdSafety)
    engine.endHold()
    setMooing(350) // короткий хвост Release
  }
  const holdTargets: Array<SVGSVGElement | HTMLElement | null> = [bull, holdBtn]
  for (const target of holdTargets) {
    if (!target) continue
    target.addEventListener('pointerdown', holdStart)
    target.addEventListener('pointerup', holdEnd)
    target.addEventListener('pointercancel', holdEnd)
  }

  // ---------- запись на занятие ----------
  document.getElementById('pay-btn')?.addEventListener('click', () => {
    const d = engine.nod()
    nod()
    setMooing(d * 1000 + 150)
    bubble('Записал. Жду на лугу.', 1800)
    confetti(12)
  })

  // ---------- диплом ----------
  document.getElementById('diploma-close')?.addEventListener('click', () => {
    document.getElementById('diploma')?.setAttribute('hidden', '')
    engine.happyMoo()
  })
}
