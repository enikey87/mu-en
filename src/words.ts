export interface Word {
  en: string
  /** произношение по-быньочьи */
  say: string
  /** произношение для движка: мини-МФА (см. MooEngine.mooPhonetic) */
  moo: string
  ru: string
  tip: string
  level: 1 | 2 | 3
}

export const LEVELS: Array<{ id: 1 | 2 | 3; name: string }> = [
  { id: 1, name: 'Уровень 1. Первые шаги' },
  { id: 2, name: 'Уровень 2. Луг' },
  { id: 3, name: 'Уровень 3. Высший' },
]

export const WORDS: Word[] = [
  { en: 'moo', say: 'муу', moo: 'mu:', ru: 'приветствие', tip: 'С него начинается всё.', level: 1 },
  { en: 'moon', say: 'мууууун', moo: 'mu:n', ru: 'луна', tip: 'Домашнее задание — посмотреть ночью.', level: 1 },
  { en: 'mood', say: 'муууууд', moo: 'mu:d', ru: 'настроение', tip: 'Бынич начинает каждое занятие с проверки.', level: 1 },
  { en: 'moose', say: 'муууууус', moo: 'mu:s', ru: 'лось', tip: 'Тема «Родственники».', level: 2 },
  { en: 'moor', say: 'мууур', moo: 'mu:r', ru: 'пустошь', tip: 'Выездное занятие.', level: 2 },
  { en: 'moot', say: 'мууут', moo: 'mu:t', ru: 'спорный', tip: 'Для дебатов на втором году обучения.', level: 2 },
  { en: 'moody', say: 'муууди', moo: 'mu:di', ru: 'угрюмый', tip: 'Описываем понедельники.', level: 2 },
  { en: 'moolah', say: 'муула', moo: 'mu:la', ru: 'деньги', tip: 'Единственное слово про деньги. Оплата всё равно сеном.', level: 2 },
  { en: 'mooch', say: 'мууч', moo: 'mu:tc', ru: 'поживиться за чужой счёт', tip: 'Как чайка на чужом пикнике.', level: 2 },
  { en: 'moonrise', say: 'мууунрайз', moo: 'mu:nraiz', ru: 'восход луны', tip: 'Лучший момент домашнего задания.', level: 2 },
  { en: 'moorland', say: 'муурлэнд', moo: 'mu:rland', ru: 'вересковая пустошь', tip: 'Там и проходит выездное занятие.', level: 2 },
  { en: 'muumuu', say: 'муумуу', moo: 'mu:mu:', ru: 'гавайское платье', tip: 'Единственное слово, которое мычит дважды.', level: 2 },
  { en: 'moonlight', say: 'мууууунлайт', moo: 'mu:nlait', ru: 'лунный свет', tip: 'Вечерняя группа.', level: 3 },
  { en: 'moonstone', say: 'мууууунстоун', moo: 'mu:nstoun', ru: 'лунный камень', tip: 'Смотрим, трогаем, запоминаем.', level: 3 },
  { en: 'moonwalk', say: 'мууууунуок', moo: 'mu:nwok', ru: 'лунная походка', tip: 'Физкультминутка.', level: 3 },
  { en: 'moonshot', say: 'муууууншот', moo: 'mu:ncot', ru: 'дерзкий план', tip: 'Профориентация.', level: 3 },
  { en: 'moonscape', say: 'мууууунскейп', moo: 'mu:nskaip', ru: 'лунный пейзаж', tip: 'Изобразительное искусство.', level: 3 },
  { en: 'moonbeam', say: 'мууууунбим', moo: 'mu:nbi:m', ru: 'луч луны', tip: 'Для самых маленьких.', level: 3 },
  { en: 'moonlit', say: 'муунлит', moo: 'mu:nlit', ru: 'освещённый луной', tip: 'Таким луг становится после отбоя.', level: 3 },
  { en: 'moonless', say: 'муунлес', moo: 'mu:nles', ru: 'безлунный', tip: 'Такие ночи программа не признаёт.', level: 3 },
  { en: 'moony', say: 'мууни', moo: 'mu:ni', ru: 'рассеянный', tip: 'Про того, кто на занятии смотрит на луну.', level: 3 },
]
