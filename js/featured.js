/*
 * Trending Now: the puzzles featured on the home page, chosen by hand.
 * Edit this list to change what's featured; the first four show on phones.
 *
 * Each item:
 *   genre:  the genre a card opens (an id from js/genres.js), or
 *   link:   a site link instead, such as '#/daily/2026-10-18'
 *   kicker: the small label above the title, such as 'Sport'
 *   title:  the card's headline. Keep it spoiler-free.
 *   colour: the card's background (dark enough for white text)
 *   icon:   an icon name from ICONS in js/app.js
 *
 * Only feature topics you've checked are real and current: nothing here is
 * generated automatically.
 */
const FEATURED = [
  { genre: 'movies', kicker: 'Film & TV', title: 'Think you know your movies and TV?', colour: '#5a2f4f', icon: 'film' },
  { genre: 'sports', kicker: 'Sport', title: 'Games, gear and glory', colour: '#2b4a3f', icon: 'ball' },
  { genre: 'popculture', kicker: 'Pop culture', title: 'Stars, streaming and memes', colour: '#6b3a24', icon: 'star' },
  { genre: 'gaming', kicker: 'Video games', title: 'Consoles, characters and gamer slang', colour: '#24456b', icon: 'gamepad' },
];

if (typeof module !== 'undefined' && module.exports) module.exports = { FEATURED };
