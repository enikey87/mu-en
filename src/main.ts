import './styles.css'
import { engine } from './audio'
import { WORDS, LEVELS, type Word } from './words'

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
  const cardEls = new Map<string, HTMLElement>()
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
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'card'
        if (learned.includes(w.en)) el.classList.add('card--learned')
        el.innerHTML = `
          <span class="card__check" aria-label="выучено">✓</span>
          <span class="card__en">${w.en}</span>
          <span class="card__say">${w.say}</span>
          <span class="card__ru">${w.ru}</span>
          <span class="card__tip">${w.tip}</span>`
        el.addEventListener('click', () => {
          playWord(w, el)
          el.classList.add('card--learned')
          markLearned(w)
        })
        cardEls.set(w.en, el)
        grid.append(el)
      }
      levelBox.append(levelName, grid)
      programLevels.append(levelBox)
    }
  }

  // ---------- повторение (аудиоквиз) ----------
  const quizOptions = document.getElementById('quiz-options')
  const quizListen = document.getElementById('quiz-listen') as HTMLButtonElement | null
  const quizStreak = document.getElementById('quiz-streak')
  const PRAISE = ['Именно.', 'Верно.', 'Так.', 'Отлично.']
  let quizTarget: Word = WORDS[0]!
  let quizLock = false
  let streak = 0

  const newRound = (): void => {
    quizTarget = WORDS[Math.floor(Math.random() * WORDS.length)]!
    const others = WORDS.filter((w) => w.en !== quizTarget.en)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
    const options = [quizTarget, ...others].sort(() => Math.random() - 0.5)
    if (!quizOptions) return
    quizOptions.classList.remove('quiz__options--locked')
    quizOptions.innerHTML = ''
    for (const w of options) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'quiz__option'
      btn.textContent = w.en
      if (w.en === quizTarget.en) btn.dataset.correct = '1'
      btn.addEventListener('click', () => {
        if (quizLock) return
        quizLock = true
        quizOptions.classList.add('quiz__options--locked')
        if (w.en === quizTarget.en) {
          streak++
          engine.nod()
          nod()
          const praise = streak >= 3 ? 'Бынич доволен: три подряд.' : PRAISE[Math.floor(Math.random() * PRAISE.length)]!
          bubble(praise, 1100)
          if (quizStreak) quizStreak.textContent = streak >= 2 ? `правильно подряд: ${streak}` : ''
          markLearned(w)
          window.setTimeout(() => {
            quizLock = false
            newRound()
            // раунд сам озвучивается — контекст уже разбужен кликом
            const d = engine.mooWord(quizTarget.en)
            setMooing(d * 1000 + 120)
          }, 1100)
        } else {
          streak = 0
          if (quizStreak) quizStreak.textContent = ''
          const d = engine.mooWord(quizTarget.en)
          setMooing(d * 1000 + 120)
          puzzled()
          bubble('Почти. Слушайте ещё.', 1400)
          window.setTimeout(() => {
            quizLock = false
            quizOptions.classList.remove('quiz__options--locked')
          }, 900)
        }
      })
      quizOptions.append(btn)
    }
  }
  newRound()
  quizListen?.addEventListener('click', () => {
    const d = engine.mooWord(quizTarget.en)
    setMooing(d * 1000 + 120)
  })

  // ---------- словарь под рукой ----------
  const askForm = document.getElementById('ask-form') as HTMLFormElement | null
  const askInput = document.getElementById('ask-input') as HTMLInputElement | null
  const dictEn = new Map(WORDS.map((w) => [w.en, w] as const))
  const dictRu = new Map(WORDS.map((w) => [w.ru, w] as const))
  const ALIASES: Record<string, string> = {
    му: 'moo',
    mu: 'moo',
    мычание: 'moo',
    мёд: 'moor',
    мед: 'moor',
    мур: 'moor',
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
      const el = cardEls.get(w.en)
      el?.classList.add('card--learned')
      markLearned(w)
    } else {
      askFails++
      engine.question()
      puzzled(1800)
      if (askFails >= 3) bubble('Всё, что знаю, — выше, в программе.', 1800)
      else if (askFails === 2) bubble('Не нашёл. Попробуйте слово попроще.', 1700)
      else bubble('Не нашёл.', 1400)
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
        const w = Math.max(110, Math.min(170, vw * 0.16))
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
