/* ============================================================
   Оффлайн-пробник детектора мычания.

   Синтезирует «мууу» и звуки-обманки, прогоняет их через тот же
   анализ, что и микрофон (src/moo-core.ts), и печатает таблицу:
   где детектор должен сработать, а где — отказать.

   Запуск:  npm run moo:probe
   Микрофон не нужен; Node 24 исполняет TypeScript напрямую.
   ============================================================ */

import { MOO_CONFIG, MooTracker, analyzeFrame, type MooVerdict } from '../src/moo-core.ts'

const RATE = 48000
const WINDOW = 4096 // как в микрофонном детекторе
const HOP = 768 // ~16 мс

/** Линейный конгруэнтный генератор: шум должен повторяться от прогона к прогону. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function noise(ms: number, levelDb: number, next: () => number): Float32Array {
  const n = Math.round((ms / 1000) * RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = next() * 2 - 1
  return normalize(out, levelDb)
}

function silence(ms: number): Float32Array {
  const n = Math.round((ms / 1000) * RATE)
  return new Float32Array(n).fill(1e-5)
}

function rms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / (buf.length || 1))
}

/** Приводит сигнал к нужной громкости в dBFS. */
function normalize(buf: Float32Array, levelDb: number): Float32Array {
  const target = Math.pow(10, levelDb / 20)
  const k = target / Math.max(rms(buf), 1e-9)
  for (let i = 0; i < buf.length; i++) buf[i] *= k
  return buf
}

function concat(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Float32Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

interface MooStyle {
  f0: number
  f1: number
  f2: number
  ms: number
  levelDb: number
}

/** Гармонический «голос» с формантами: два лоренцевых горба поверх спада глотки. */
function voiced({ f0, f1, f2, ms, levelDb }: MooStyle): Float32Array {
  const n = Math.round((ms / 1000) * RATE)
  const out = new Float32Array(n)
  const shape = (f: number, F: number, bw: number): number => 1 / (1 + ((f - F) / bw) ** 2)
  const harmonics: Array<{ h: number; a: number }> = []
  for (let h = 1; h * f0 <= 4000; h++) {
    const f = h * f0
    const a = (0.9 * shape(f, f1, 90) + shape(f, f2, 120) + 0.12) / Math.pow(h, 0.8)
    harmonics.push({ h, a })
  }
  // фаза копится: вибрато должно быть настоящей частотной модуляцией,
  // иначе к концу мычания гармоники разъезжаются и тон «плывёт»
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const ramp = Math.min(1, i / (0.25 * RATE))
    const mod = 1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t) * ramp
    phase += (2 * Math.PI * f0 * mod) / RATE
    let v = 0
    for (const { h, a } of harmonics) v += a * Math.sin(phase * h)
    // атака «м» и затухание на конце
    const attack = Math.min(1, i / (0.04 * RATE))
    const release = Math.min(1, (n - i) / (0.08 * RATE))
    out[i] = v * attack * release
  }
  return normalize(out, levelDb)
}

/** Прогоняет сигнал через накопитель так же, как это делает микрофонный детектор. */
function run(signal: Float32Array, cfg = MOO_CONFIG): MooVerdict {
  const tracker = new MooTracker(cfg, (1000 * WINDOW) / RATE)
  for (let start = 0; start + WINDOW <= signal.length; start += HOP) {
    tracker.push(analyzeFrame(signal.subarray(start, start + WINDOW), RATE, cfg), (1000 * start) / RATE)
    if (tracker.result()) break
  }
  // если звук кончился раньше срока, дослушиваем тишину до конца попытки
  for (let t = (1000 * signal.length) / RATE; !tracker.result() && t < cfg.listenMs + 100; t += HOP / RATE * 1000) {
    tracker.push(analyzeFrame(silence(WINDOW / RATE * 1000 + 0.001), RATE, cfg), t)
  }
  return tracker.result() ?? { ok: false, reason: 'timeout' }
}

interface Case {
  name: string
  signal: Float32Array
  expect: 'ok' | 'no'
  note?: string
}

const next = rng(20261014)
const ambient = (): Float32Array => noise(600, -62, next)

const cases: Case[] = [
  {
    name: 'мууу взрослого',
    signal: concat(ambient(), voiced({ f0: 130, f1: 330, f2: 720, ms: 1400, levelDb: -15 }), silence(600)),
    expect: 'ok',
  },
  {
    name: 'мууу ребёнка (высоко)',
    signal: concat(ambient(), voiced({ f0: 300, f1: 340, f2: 760, ms: 1100, levelDb: -18 }), silence(600)),
    expect: 'ok',
  },
  {
    name: 'мууу ровно на минимуме (0.9 с)',
    signal: concat(ambient(), voiced({ f0: 150, f1: 330, f2: 700, ms: 900, levelDb: -20 }), silence(600)),
    expect: 'ok',
  },
  {
    name: 'короткое «му» (0.35 с)',
    signal: concat(ambient(), voiced({ f0: 140, f1: 330, f2: 720, ms: 350, levelDb: -15 }), silence(1500)),
    expect: 'no',
    note: 'коротко',
  },
  {
    name: 'мычание вполголоса',
    signal: concat(noise(600, -75, next), voiced({ f0: 135, f1: 330, f2: 720, ms: 1400, levelDb: -48 }), silence(600)),
    expect: 'no',
    note: 'тихо',
  },
  {
    name: '«аааа»',
    signal: concat(ambient(), voiced({ f0: 130, f1: 800, f2: 1200, ms: 1400, levelDb: -15 }), silence(600)),
    expect: 'no',
    note: 'не та гласная',
  },
  {
    name: '«ииии»',
    signal: concat(ambient(), voiced({ f0: 130, f1: 300, f2: 2200, ms: 1400, levelDb: -15 }), silence(600)),
    expect: 'no',
    note: 'не та гласная',
  },
  {
    name: 'белый шум',
    signal: concat(ambient(), noise(1400, -12, next), silence(600)),
    expect: 'no',
    note: 'не тот тембр',
  },
  {
    name: 'два мууу с паузой',
    signal: concat(
      ambient(),
      voiced({ f0: 135, f1: 330, f2: 720, ms: 500, levelDb: -15 }),
      silence(300),
      voiced({ f0: 135, f1: 330, f2: 720, ms: 500, levelDb: -15 }),
      silence(600),
    ),
    expect: 'no',
    note: 'прерывисто',
  },
  {
    name: 'тишина',
    signal: concat(ambient(), silence(2000), silence(600)),
    expect: 'no',
    note: 'тихо',
  },
]

let failed = 0
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length))
console.log(`${pad('сценарий', 26)} ${pad('ждём', 6)} ${pad('факт', 26)} итог`)
for (const c of cases) {
  const v = run(c.signal)
  const got = v.ok ? `ok (${v.durationMs} мс)` : `нет — ${v.reason}`
  const pass = c.expect === 'ok' ? v.ok : !v.ok
  if (!pass) failed++
  const note = !v.ok && c.note && !got.includes(c.note) ? `  ← ждали «${c.note}»` : ''
  console.log(`${pad(c.name, 26)} ${pad(c.expect === 'ok' ? 'мууу' : 'нет', 6)} ${pad(got, 26)} ${pass ? '✓' : '✗'}${note}`)
}

console.log('')
if (failed) {
  console.log(`Провалено сценариев: ${failed}. Подкрутите MOO_CONFIG в src/moo-core.ts.`)
  process.exitCode = 1
} else {
  console.log(`Все ${cases.length} сценариев пройдены.`)
}
