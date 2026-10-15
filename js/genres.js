/*
 * Genre definitions. Each genre's words come from words/<id>.txt (compiled
 * into js/words.js). Puzzles draw a fresh subset every time they are played.
 */
const WORD_LISTS = typeof CROSSWORD_WORDS !== 'undefined' ? CROSSWORD_WORDS : require('./words.js');

// Lines read "ANSWER|clue". A leading ! marks a hard answer and + an easy one
// (rated by tools/rate-words.py); everything else counts as medium.
function parseList(text) {
  if (!text) return [];
  return text.split('\n').map((line) => {
    const bar = line.indexOf('|');
    const mark = line[0];
    const level = mark === '!' ? 'hard' : mark === '+' ? 'easy' : 'medium';
    return { answer: line.slice(level === 'medium' ? 0 : 1, bar), clue: line.slice(bar + 1), level };
  });
}

const BASE_GENRES = [
  {
    id: 'animals',
    subject: 'Animals',
    category: 'classic',
    name: 'Animal Kingdom',
    icon: '🦁',
    blurb: 'Creatures of land, sea and sky.',
  },
  {
    id: 'food',
    subject: 'Food & Drink',
    category: 'classic',
    name: 'Food & Drink',
    icon: '🍕',
    blurb: 'Dishes, snacks and flavours from around the world.',
  },
  {
    id: 'geography',
    subject: 'Geography',
    category: 'classic',
    name: 'World Geography',
    icon: '🌍',
    blurb: 'Countries, capitals, rivers and landforms.',
  },
  {
    id: 'science',
    subject: 'Science',
    category: 'classic',
    name: 'Science Lab',
    icon: '🔬',
    blurb: 'Atoms, forces, cells and big ideas.',
  },
  {
    id: 'sports',
    subject: 'Sport',
    category: 'classic',
    name: 'Sports Arena',
    icon: '⚽',
    blurb: 'Games, gear and glory.',
  },
  {
    id: 'music',
    subject: 'Music',
    category: 'classic',
    name: 'Music Hall',
    icon: '🎵',
    blurb: 'Instruments, composers and the language of sound.',
  },
  {
    id: 'space',
    subject: 'Astronomy',
    category: 'classic',
    name: 'Outer Space',
    icon: '🚀',
    blurb: 'Planets, stars and the missions that reach them.',
  },
  {
    id: 'mythology',
    subject: 'Mythology',
    category: 'classic',
    name: 'Myths & Legends',
    icon: '⚡',
    blurb: 'Gods, heroes and monsters of ancient tales.',
  },
  // ---------- Pop culture & fun ----------
  {
    id: 'popculture',
    subject: 'Pop Culture',
    category: 'fun',
    name: 'Pop Culture',
    icon: '🎤',
    blurb: 'Stars, streaming, memes and the internet age.',
  },
  {
    id: 'movies',
    subject: 'Film & TV',
    category: 'fun',
    name: 'Movies & TV',
    icon: '🎬',
    blurb: 'Blockbusters, characters and screen lingo.',
  },
  {
    id: 'gaming',
    subject: 'Video Games',
    category: 'fun',
    name: 'Video Games',
    icon: '🎮',
    blurb: 'Consoles, characters and gamer slang.',
  },
  {
    id: 'holidays',
    subject: 'Festivals',
    category: 'fun',
    name: 'Holidays & Festivals',
    icon: '🎆',
    blurb: 'Celebrations and traditions from around the world.',
  },
  // ---------- Academic ----------
  {
    id: 'philosophy',
    category: 'academic',
    name: 'Philosophy',
    icon: '🏛️',
    blurb: 'Thinkers, schools and the big questions.',
  },
  {
    id: 'literature',
    category: 'academic',
    name: 'Literature',
    icon: '📚',
    blurb: 'Classic authors, works and literary devices.',
  },
  {
    id: 'mathematics',
    category: 'academic',
    name: 'Mathematics',
    icon: '📐',
    blurb: 'From algebra to topology.',
  },
  {
    id: 'vocabulary',
    category: 'academic',
    name: 'Advanced Vocabulary',
    icon: '🖋️',
    blurb: 'Impressive words for the well-read solver.',
  },
  {
    id: 'history',
    category: 'academic',
    name: 'World History',
    icon: '📜',
    blurb: 'Empires, revolutions and the people who shaped them.',
  },
  {
    id: 'economics',
    category: 'academic',
    name: 'Economics',
    icon: '📈',
    blurb: 'Markets, money and policy.',
  },
  {
    id: 'anatomy',
    category: 'academic',
    name: 'Human Anatomy',
    icon: '🫀',
    blurb: 'Bones, organs and the systems that keep us alive.',
  },
  {
    id: 'art',
    category: 'academic',
    name: 'Art & Architecture',
    icon: '🎨',
    blurb: 'Masters, movements and techniques.',
  },
  {
    id: 'chemistry',
    category: 'academic',
    name: 'Chemistry',
    icon: '⚗️',
    blurb: 'Elements, bonds and reactions.',
  },
  {
    id: 'physics',
    category: 'academic',
    name: 'Physics',
    icon: '⚛️',
    blurb: 'Forces, fields and the quantum world.',
  },
  {
    id: 'biology',
    category: 'academic',
    name: 'Biology',
    icon: '🧬',
    blurb: 'Cells, evolution and the living world.',
  },
  {
    id: 'psychology',
    category: 'academic',
    name: 'Psychology',
    icon: '🧠',
    blurb: 'Mind, memory and behaviour.',
  },
  {
    id: 'computing',
    category: 'academic',
    name: 'Computer Science',
    icon: '💻',
    blurb: 'Code, networks and the people who built them.',
  },
  {
    id: 'law',
    category: 'academic',
    name: 'Law & Government',
    icon: '⚖️',
    blurb: 'Courts, constitutions and the machinery of the state.',
  },
  {
    id: 'religion',
    category: 'academic',
    name: 'World Religions',
    icon: '🕊️',
    blurb: 'Faiths, texts and traditions.',
  },
  {
    id: 'linguistics',
    category: 'academic',
    name: 'Language & Linguistics',
    icon: '🗣️',
    blurb: 'Words, grammar and the history of language.',
  },
  {
    id: 'earthscience',
    category: 'academic',
    name: 'Earth Science',
    icon: '🌋',
    blurb: 'Rocks, weather and the restless planet.',
  },
  {
    id: 'classics',
    category: 'academic',
    name: 'Latin & the Ancient World',
    icon: '🏺',
    blurb: 'Rome, Greece and the phrases they left us.',
  },
]
  .map((g) => ({ ...g, words: parseList(WORD_LISTS[g.id]) }));

// Mixed puzzles draw from several genres at once. Answers that appear in
// more than one genre are kept once, with the first genre's clue.
function mixGenre(id, name, icon, blurb, sources) {
  const seen = new Set();
  const words = [];
  for (const g of sources) {
    for (const w of g.words) {
      if (seen.has(w.answer)) continue;
      seen.add(w.answer);
      words.push({ ...w, tag: g.subject || g.name });
    }
  }
  return { id, category: 'mixed', name, icon, blurb, words };
}

const GENRES = [
  mixGenre('mixed', 'Mixed Bag', '🎲', 'A bit of everything from every genre.', BASE_GENRES),
  mixGenre('mixed-fun', 'Pop & Fun Mix', '🍿', 'Pop culture, movies, games, food, sport and more.',
    BASE_GENRES.filter((g) => g.category !== 'academic')),
  mixGenre('mixed-academic', 'Academic Mix', '🎓', 'A tough blend of every academic subject.',
    BASE_GENRES.filter((g) => g.category === 'academic' || g.id === 'science')),
  ...BASE_GENRES,
];

const CATEGORIES = [
  { id: 'mixed', name: 'Mixed puzzles', blurb: 'Clues drawn from many genres at once.' },
  { id: 'classic', name: 'Everyday themes', blurb: 'Friendly topics for every solver.' },
  { id: 'fun', name: 'Pop culture & fun', blurb: 'Screens, stars, games and celebrations.' },
  { id: 'academic', name: 'Academic', blurb: 'Challenging subjects for serious solvers.' },
];

const DIFFICULTIES = {
  // hard: how many tough answers each puzzle mixes in; the rest lean easy.
  easy: { label: 'Easy', count: 12, maxSize: 13, hard: 2 },
  medium: { label: 'Medium', count: 20, maxSize: 17, hard: 5 },
  hard: { label: 'Hard', count: 30, maxSize: 21, hard: 8 },
};

// ---------- Daily puzzles ----------
// The Daily is an academic puzzle drawn from every scholarly subject. Like a
// newspaper crossword it gets harder through the week: early days use shorter
// answers and fewer clues; Saturday is the toughest and Sunday the largest.
const DAILY_SOURCES = BASE_GENRES.filter(
  (g) => g.category === 'academic' || ['science', 'geography', 'space', 'mythology', 'music'].includes(g.id)
);
const DAILY_BANK = mixGenre('daily', 'The Daily', '', '', DAILY_SOURCES).words;

// Indexed by Date.getDay(): 0 = Sunday.
const DAILY_SCHEDULE = [
  { day: 'Sunday', level: 'Grand', count: 40, maxSize: 23, maxLen: 15, hard: 8 },
  { day: 'Monday', level: 'Gentle', count: 22, maxSize: 17, maxLen: 8, hard: 3 },
  { day: 'Tuesday', level: 'Moderate', count: 25, maxSize: 17, maxLen: 9, hard: 4 },
  { day: 'Wednesday', level: 'Moderate', count: 28, maxSize: 19, maxLen: 10, hard: 5 },
  { day: 'Thursday', level: 'Tricky', count: 30, maxSize: 21, maxLen: 15, hard: 6 },
  { day: 'Friday', level: 'Challenging', count: 32, maxSize: 21, maxLen: 15, hard: 7 },
  { day: 'Saturday', level: 'Fiendish', count: 34, maxSize: 21, maxLen: 15, hard: 8 },
];

// The Mini is a quick warm-up of short everyday and pop-culture answers.
const MINI_BANK = mixGenre(
  'mini', 'The Mini', '', '',
  BASE_GENRES.filter((g) => g.category === 'classic' || g.category === 'fun')
).words.filter((w) => w.answer.length >= 3 && w.answer.length <= 6);
const MINI_CONFIG = { count: 6, maxSize: 7, hard: 0 };

// How many answers each day's Daily and Mini may choose from.
const DAILY_WINDOW = 240;
const MINI_WINDOW = 30;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GENRES, CATEGORIES, DIFFICULTIES, DAILY_BANK, DAILY_SCHEDULE, MINI_BANK, MINI_CONFIG, DAILY_WINDOW, MINI_WINDOW };
}
