export interface Word {
  en: string
  /** произношение по-быньочьи */
  say: string
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
  { en: 'moo', say: 'муу', ru: 'приветствие', tip: 'С него начинается всё.', level: 1 },
  { en: 'moon', say: 'мууууун', ru: 'луна', tip: 'Домашнее задание — посмотреть ночью.', level: 1 },
  { en: 'mood', say: 'муууууд', ru: 'настроение', tip: 'Бынич начинает каждое занятие с проверки.', level: 1 },
  { en: 'moose', say: 'муууууус', ru: 'лось', tip: 'Тема «Родственники».', level: 2 },
  { en: 'moor', say: 'мууур', ru: 'пустошь', tip: 'Выездное занятие.', level: 2 },
  { en: 'moot', say: 'мууут', ru: 'спорный', tip: 'Для дебатов на втором году обучения.', level: 2 },
  { en: 'moody', say: 'муууди', ru: 'угрюмый', tip: 'Описываем понедельники.', level: 2 },
  { en: 'moonlight', say: 'мууууунлайт', ru: 'лунный свет', tip: 'Вечерняя группа.', level: 3 },
  { en: 'moonstone', say: 'мууууунстоун', ru: 'лунный камень', tip: 'Смотрим, трогаем, запоминаем.', level: 3 },
  { en: 'moonwalk', say: 'мууууунуок', ru: 'лунная походка', tip: 'Физкультминутка.', level: 3 },
  { en: 'moonshot', say: 'муууууншот', ru: 'дерзкий план', tip: 'Профориентация.', level: 3 },
  { en: 'moonscape', say: 'мууууунскейп', ru: 'лунный пейзаж', tip: 'Изобразительное искусство.', level: 3 },
  { en: 'moonbeam', say: 'мууууунбим', ru: 'луч луны', tip: 'Для самых маленьких.', level: 3 },
]
