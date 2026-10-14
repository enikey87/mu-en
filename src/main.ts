import './styles.css'
import { engine } from './audio'
import { WORDS, type Word } from './words'

const bull = document.getElementById('byanych') as SVGSVGElement | null
const bubbleEl = document.getElementById('bubble')
const body = document.body

if (bull) {
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
    bull.classList.add('bull--mooing')
    window.clearTimeout(mooingTimer)
    mooingTimer = window.setTimeout(() => bull.classList.remove('bull--mooing'), ms)
  }

  const shake = (): void => {
    if (body.classList.contains('shake')) return
    body.classList.add('shake')
    window.setTimeout(() => body.classList.remove('shake'), 480)
  }

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

  // ---------- словарь ----------
  const playWord = (w: Word, el?: HTMLElement): void => {
    const d = engine.mooWord(w.en)
    setMooing(d * 1000 + 120)
    bubble(`${w.say.toUpperCase()}!`, Math.max(1100, d * 800))
    if (el) {
      el.classList.add('card--active')
      window.setTimeout(() => el.classList.remove('card--active'), d * 1000)
    }
  }

  const cards = document.getElementById('cards')
  if (cards) {
    for (const w of WORDS) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'card'
      el.innerHTML = `
        <span class="card__en">${w.en}</span>
        <span class="card__say">${w.say}</span>
        <span class="card__ru">${w.ru}</span>
        <span class="card__tip">${w.tip}</span>`
      el.addEventListener('click', () => playWord(w, el))
      cards.append(el)
    }
  }

  // ---------- Moo-DJ пады и комбо ----------
  const pads = document.getElementById('pads')
  const padTimes: number[] = []
  const combo = (): void => {
    bull.classList.add('bull--combo')
    window.setTimeout(() => bull.classList.remove('bull--combo'), 1000)
    shake()
    bubble('Муу-комбо!', 1200)
    padTimes.length = 0
  }
  if (pads) {
    WORDS.forEach((w, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `pad pad--${(i % 6) + 1}`
      el.innerHTML = `
        <span class="pad__say">${w.say.toUpperCase()}</span>
        <span class="pad__en">${w.en}</span>`
      el.addEventListener('click', () => {
        const d = engine.mooWord(w.en)
        setMooing(d * 1000 + 120)
        const now = performance.now()
        padTimes.push(now)
        while (padTimes.length > 0 && padTimes[0] < now - 2000) padTimes.shift()
        if (padTimes.length >= 3) combo()
      })
      pads.append(el)
    })
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

  // ---------- Moo-t Premium: оплата сеном ----------
  document.getElementById('pay-btn')?.addEventListener('click', () => {
    const d = engine.angry()
    setMooing(d * 1000 + 150)
    bubble('Мууу?! Сеном не платят!', 1800)
    shake()
  })
}
