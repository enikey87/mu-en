/* ============================================================
   РИСУНКИ-ПОДСКАЗКИ К СЛОВАМ — по одному на каждую карточку.

   Все нарисованы руками в стиле Бынича: плоские «стикеры»,
   толстая тёплая обводка (#7a4a28), палитра «Луга». Без внешних
   картинок. Вставляются в карточку перед словом: ребёнок связывает
   образ со словом ещё до чтения.

   Каждый рисунок — инлайн-SVG на поле 120×72; фон и скругление
   даёт контейнер .card__art.
   ============================================================ */

const STROKE = '#7a4a28'

const svg = (body: string): string =>
  `<svg viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`

const star = (x: number, y: number, r = 2): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7c948"/>`

export const WORD_ART: Record<string, string> = {
  // приветствие: пузырь с «Муу!»
  moo: svg(
    `<path d="M46 52 L36 68 L62 55 Z" fill="#fff" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/>` +
      `<ellipse cx="58" cy="34" rx="36" ry="24" fill="#fff" stroke="${STROKE}" stroke-width="3"/>` +
      `<text x="58" y="41" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="19" fill="#2f2115">Муу!</text>`,
  ),

  // луна: полная, с кратерами
  moon: svg(
    star(20, 16) +
      star(98, 22, 1.7) +
      star(90, 54) +
      `<circle cx="58" cy="36" r="23" fill="#f7d774" stroke="#d9a93f" stroke-width="3"/>` +
      `<circle cx="50" cy="29" r="5" fill="#ecc55e"/>` +
      `<circle cx="65" cy="41" r="4.2" fill="#ecc55e"/>` +
      `<circle cx="57" cy="48" r="2.6" fill="#ecc55e"/>`,
  ),

  // настроение: лицо с бровями
  mood: svg(
    `<circle cx="60" cy="38" r="24" fill="#ffe1b8" stroke="${STROKE}" stroke-width="3"/>` +
      `<path d="M43 26 Q 50 21 56 26" fill="none" stroke="#2f2115" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M64 24 Q 70 22 75 27" fill="none" stroke="#2f2115" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="50" cy="34" r="2.7" fill="#2f2115"/>` +
      `<circle cx="70" cy="34" r="2.7" fill="#2f2115"/>` +
      `<path d="M50 48 Q 60 56 70 48" fill="none" stroke="#2f2115" stroke-width="3" stroke-linecap="round"/>`,
  ),

  // лось: голова с рогами
  moose: svg(
    `<path d="M42 28 Q 30 16 26 7 M31 15 L23 12 M34 19 L41 10" fill="none" stroke="${STROKE}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M78 28 Q 90 16 94 7 M89 15 L97 12 M86 19 L79 10" fill="none" stroke="${STROKE}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="36" cy="32" rx="7" ry="4.5" fill="#a9714a" stroke="${STROKE}" stroke-width="2.5" transform="rotate(-24 36 32)"/>` +
      `<ellipse cx="84" cy="32" rx="7" ry="4.5" fill="#a9714a" stroke="${STROKE}" stroke-width="2.5" transform="rotate(24 84 32)"/>` +
      `<ellipse cx="60" cy="40" rx="21" ry="16" fill="#a9714a" stroke="${STROKE}" stroke-width="3"/>` +
      `<ellipse cx="60" cy="53" rx="15" ry="10" fill="#c9986a" stroke="${STROKE}" stroke-width="3"/>` +
      `<ellipse cx="54" cy="52" rx="2.4" ry="3.4" fill="${STROKE}"/>` +
      `<ellipse cx="66" cy="52" rx="2.4" ry="3.4" fill="${STROKE}"/>` +
      `<circle cx="51" cy="34" r="2.6" fill="#2f2115"/>` +
      `<circle cx="69" cy="34" r="2.6" fill="#2f2115"/>`,
  ),

  // пустошь: горизонт, куст да камень — и всё
  moor: svg(
    `<path d="M62 20 q 5 -5 10 0 M72 20 q 5 -5 10 0" fill="none" stroke="#a89480" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M0 50 Q 30 43 60 49 T 120 48 V72 H0 Z" fill="#a5d67a"/>` +
      `<path d="M34 49 l-3 -9 M34 49 l0 -11 M34 49 l4 -9" fill="none" stroke="#6cb44a" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M58 50 l-3 -8 M58 50 l1 -10 M58 50 l4 -8" fill="none" stroke="#6cb44a" stroke-width="2.6" stroke-linecap="round"/>` +
      `<ellipse cx="88" cy="54" rx="10" ry="5.5" fill="#c9b9a2" stroke="#a89480" stroke-width="2.6"/>`,
  ),

  // спорный: два мнения не договорились
  moot: svg(
    `<g transform="rotate(-5 34 28)">` +
      `<rect x="12" y="14" width="44" height="28" rx="11" fill="#fff" stroke="${STROKE}" stroke-width="3"/>` +
      `<path d="M24 40 l-4 10 12 -8 Z" fill="#fff" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/>` +
      `<text x="34" y="35" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="17" fill="#2fb8a6">?</text>` +
      `</g>` +
      `<g transform="rotate(4 86 44)">` +
      `<rect x="64" y="30" width="44" height="28" rx="11" fill="#ff8a3d" stroke="#e06b1f" stroke-width="3"/>` +
      `<path d="M96 56 l5 9 8 -12 Z" fill="#ff8a3d" stroke="#e06b1f" stroke-width="3" stroke-linejoin="round"/>` +
      `<text x="86" y="51" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="17" fill="#fff">!</text>` +
      `</g>`,
  ),

  // угрюмый: туча над недовольным лицом
  moody: svg(
    `<path d="M28 36 a10 10 0 0 1 4 -19 a13 13 0 0 1 24 -4 a10 10 0 0 1 17 6 a8 8 0 0 1 3 12 q0 5 -6 5 H35 q-7 0 -7 -4 Z" fill="#cfd6dd" stroke="#8f9aa8" stroke-width="3" stroke-linejoin="round"/>` +
      `<circle cx="56" cy="54" r="12" fill="#ffe1b8" stroke="${STROKE}" stroke-width="3"/>` +
      `<path d="M47 48 l9 3 M65 51 l9 -3" stroke="#2f2115" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="51" cy="55" r="2.2" fill="#2f2115"/>` +
      `<circle cx="61" cy="55" r="2.2" fill="#2f2115"/>` +
      `<path d="M50 62 Q 56 58 62 62" fill="none" stroke="#2f2115" stroke-width="2.6" stroke-linecap="round"/>`,
  ),

  // деньги: монета «муу» и соломинка
  moolah: svg(
    `<path d="M92 22 l11 -11 M96 28 l13 -7 M88 17 l7 -9" fill="none" stroke="#d9a93f" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="58" cy="39" r="21" fill="#f7c948" stroke="#c9982a" stroke-width="3"/>` +
      `<circle cx="58" cy="39" r="14.5" fill="none" stroke="#c9982a" stroke-width="2" stroke-dasharray="4 3"/>` +
      `<text x="58" y="45" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="13" fill="#8a6a1a">муу</text>`,
  ),

  // поживиться: чайка уносит бутерброд
  mooch: svg(
    `<path d="M30 26 l-11 -5 M31 38 l-13 1" stroke="#a89480" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="86" y="31" width="13" height="8" rx="2.5" fill="#e0a45e" stroke="#a5714a" stroke-width="2.2"/>` +
      `<path d="M86 35 h13" stroke="#a5714a" stroke-width="1.8"/>` +
      `<ellipse cx="60" cy="37" rx="19" ry="13" fill="#f4f7ec" stroke="${STROKE}" stroke-width="3"/>` +
      `<path d="M48 34 Q 60 26 73 34 Q 62 42 48 34 Z" fill="#dfe7ee" stroke="${STROKE}" stroke-width="2.4"/>` +
      `<path d="M77 34 l12 3.5 -12 4.5 Z" fill="#f7b32b" stroke="#c9982a" stroke-width="2"/>` +
      `<circle cx="69" cy="31" r="2.2" fill="#2f2115"/>`,
  ),

  // восход луны: половинка над лугом
  moonrise: svg(
    star(24, 16) +
      star(96, 14, 1.7) +
      `<path d="M62 21 v-9 M43 27 l-7 -7 M81 27 l7 -7" fill="none" stroke="#f7b32b" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M42 54 a20 20 0 0 1 40 0 Z" fill="#f7d774" stroke="#d9a93f" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M0 54 H120 V72 H0 Z" fill="#8fce62"/>`,
  ),

  // вересковая пустошь: холмы и вереск
  moorland: svg(
    `<path d="M0 44 Q 30 24 60 42 Q 90 56 120 38 V72 H0 Z" fill="#8fce62"/>` +
      `<path d="M0 58 Q 40 42 80 56 Q 100 62 120 54 V72 H0 Z" fill="#6cb44a"/>` +
      `<circle cx="34" cy="40" r="3" fill="#b48fe0"/><circle cx="40" cy="43" r="2.4" fill="#b48fe0"/><circle cx="29" cy="44" r="2.2" fill="#b48fe0"/>` +
      `<circle cx="88" cy="52" r="3" fill="#b48fe0"/><circle cx="94" cy="55" r="2.4" fill="#b48fe0"/><circle cx="83" cy="56" r="2.2" fill="#b48fe0"/>` +
      `<circle cx="60" cy="58" r="2.6" fill="#f4f7ec"/>`,
  ),

  // гавайское платье: муумуу во всей красе
  muumuu: svg(
    `<path d="M50 10 q10 7 20 0 l4 9 15 39 q-29 11 -58 0 l15 -39 Z" fill="#f2698f" stroke="#c14a68" stroke-width="3" stroke-linejoin="round"/>` +
      `<circle cx="54" cy="34" r="2.6" fill="#fff"/><circle cx="66" cy="42" r="2.6" fill="#fff"/><circle cx="58" cy="50" r="2.6" fill="#fff"/>` +
      `<circle cx="70" cy="28" r="2.2" fill="#fff"/><circle cx="50" cy="56" r="2.2" fill="#fff"/>` +
      `<path d="M50 10 q10 7 20 0" fill="none" stroke="#c14a68" stroke-width="3" stroke-linecap="round"/>`,
  ),

  // лунный свет: луч падает на луг
  moonlight: svg(
    star(20, 14) +
      star(44, 10, 1.7) +
      `<path d="M78 24 L34 66 H88 Z" fill="#fff3c4" opacity="0.9"/>` +
      `<circle cx="86" cy="18" r="12" fill="#f7d774" stroke="#d9a93f" stroke-width="3"/>` +
      `<path d="M56 66 l-3 -9 M58 66 l1 -11 M60 66 l4 -9" fill="none" stroke="#6cb44a" stroke-width="2.6" stroke-linecap="round"/>`,
  ),

  // лунный камень: гранёный самоцвет
  moonstone: svg(
    star(92, 16) +
      star(24, 24, 1.7) +
      `<rect x="50" y="55" width="20" height="7" rx="2.5" fill="#c9b9a2" stroke="#a89480" stroke-width="2.4"/>` +
      `<path d="M60 14 L79 30 L60 52 L41 30 Z" fill="#9ad7e8" stroke="#5aa9d6" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M41 30 H79 M60 14 L51 30 L60 52 M60 14 L69 30 L60 52" fill="none" stroke="#5aa9d6" stroke-width="2"/>`,
  ),

  // лунная походка: следы и скольжение
  moonwalk: svg(
    `<path d="M18 62 Q 55 70 96 52" fill="none" stroke="#a89480" stroke-width="2.4" stroke-dasharray="7 6" stroke-linecap="round"/>` +
      `<g fill="#8a5a32">` +
      `<ellipse cx="44" cy="30" rx="7" ry="11" transform="rotate(-16 44 30)"/>` +
      `<ellipse cx="50" cy="46" rx="4" ry="3"/>` +
      `<ellipse cx="74" cy="40" rx="7" ry="11" transform="rotate(-16 74 40)"/>` +
      `<ellipse cx="80" cy="56" rx="4" ry="3"/>` +
      `</g>` +
      star(98, 18) +
      star(24, 14, 1.7),
  ),

  // дерзкий план: ракета летит к луне
  moonshot: svg(
    `<path d="M14 60 Q 46 10 96 24" fill="none" stroke="#a89480" stroke-width="2.4" stroke-dasharray="7 6" stroke-linecap="round"/>` +
      `<circle cx="104" cy="24" r="9" fill="#f7d774" stroke="#d9a93f" stroke-width="3"/>` +
      `<g transform="rotate(-32 44 40)">` +
      `<path d="M44 22 q 9 10 8 26 h-16 q -1 -16 8 -26 Z" fill="#eceff1" stroke="#8f9aa8" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M36 48 l-7 9 9 -2 Z M52 48 l7 9 -9 -2 Z" fill="#e06b1f"/>` +
      `<circle cx="44" cy="38" r="4" fill="#85c6ec" stroke="#5aa9d6" stroke-width="2"/>` +
      `<path d="M41 52 q 3 7 6 0 Z" fill="#f7b32b"/>` +
      `</g>`,
  ),

  // лунный пейзаж: кратеры и флаг
  moonscape: svg(
    star(22, 12) +
      star(96, 14, 1.7) +
      star(80, 24, 1.6) +
      `<path d="M0 46 Q 60 36 120 46 V72 H0 Z" fill="#cfc8bd"/>` +
      `<ellipse cx="38" cy="56" rx="10" ry="5" fill="#b7afa2" stroke="#a89e90" stroke-width="2.4"/>` +
      `<ellipse cx="72" cy="63" rx="6.5" ry="3.2" fill="#b7afa2" stroke="#a89e90" stroke-width="2.4"/>` +
      `<path d="M96 40 V20" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M96 21 l16 5 -16 5 Z" fill="#d9534f"/>`,
  ),

  // луч луны: свет из-за угла
  moonbeam: svg(
    star(96, 14) +
      `<path d="M2 0 L44 0 L96 68 L60 68 Z" fill="#fff3c4" opacity="0.9"/>` +
      `<path d="M52 26 h10 M57 21 v10" stroke="#f7c948" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M70 66 l-3 -8 M72 66 l1 -10 M74 66 l4 -8" fill="none" stroke="#6cb44a" stroke-width="2.6" stroke-linecap="round"/>`,
  ),

  // освещённый луной: серп над тёмным лугом
  moonlit: svg(
    `<mask id="cut-moonlit" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="72"><rect width="120" height="72" fill="#fff"/><circle cx="97" cy="12" r="8" fill="#000"/></mask>` +
      star(24, 12) +
      star(44, 22, 1.6) +
      `<circle cx="90" cy="18" r="11" fill="#f7d774" stroke="#d9a93f" stroke-width="2.6" mask="url(#cut-moonlit)"/>` +
      `<path d="M0 50 Q 30 38 60 48 Q 90 58 120 46 V72 H0 Z" fill="#4e7d3f"/>` +
      `<circle cx="36" cy="56" r="2.4" fill="#f4f7ec"/><circle cx="60" cy="62" r="2.4" fill="#f4f7ec"/><circle cx="86" cy="58" r="2.4" fill="#f4f7ec"/>`,
  ),

  // безлунный: ночь, а луны нет
  moonless: svg(
    `<rect x="16" y="8" width="88" height="56" rx="12" fill="#2e3a52"/>` +
      star(32, 20, 1.8) +
      star(88, 18, 1.5) +
      star(84, 50, 1.8) +
      star(30, 52, 1.4) +
      `<circle cx="60" cy="36" r="14" fill="none" stroke="#8fa3c8" stroke-width="2.6" stroke-dasharray="5 5"/>` +
      `<text x="60" y="41" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="13" fill="#8fa3c8">?</text>`,
  ),

  // рассеянный: смотрит на луну и не слышит
  moony: svg(
    `<circle cx="86" cy="15" r="8" fill="#f7d774" stroke="#d9a93f" stroke-width="2.4"/>` +
      `<circle cx="76" cy="26" r="2.6" fill="#cfd6dd"/>` +
      `<circle cx="81" cy="21" r="1.8" fill="#cfd6dd"/>` +
      `<circle cx="56" cy="42" r="20" fill="#ffe1b8" stroke="${STROKE}" stroke-width="3"/>` +
      `<path d="M44 38 q 4 5 9 0 M61 38 q 4 5 9 0" fill="none" stroke="#2f2115" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="57" cy="50" r="3.2" fill="none" stroke="#2f2115" stroke-width="2.4"/>`,
  ),
}
