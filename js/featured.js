/*
 * Trending Now: the puzzles featured on the home page, chosen by hand.
 * Edit this list to change what's featured. A card only shows if its genre or
 * collection exists.
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
  { genre: 'friends', kicker: 'TV · Fan crossword', title: 'Could this BE any more Friends?', colour: '#6b3a4a', icon: 'tv' },
  { genre: 'formula-1', kicker: 'Sport', title: 'Think you know Formula 1?', colour: '#2f5a43', icon: 'flame' },
  { genre: 'harry-potter', kicker: 'Movies · Fan crossword', title: 'Harry Potter: are you a true wizard?', colour: '#4b3f6b', icon: 'film' },
  { genre: 'pokemon', kicker: 'Gaming · Fan crossword', title: 'Pokémon: gotta solve them all', colour: '#3e5c6b', icon: 'gamepad' },
  { genre: 'game-of-thrones', kicker: 'TV · Fan crossword', title: 'The Game of Thrones Superfan test', colour: '#4a3f30', icon: 'tv' },
  { genre: 'rugby', kicker: 'Sport', title: 'Springboks, scrums and World Cup glory', colour: '#2f5a43', icon: 'ball' },
];

if (typeof module !== 'undefined' && module.exports) module.exports = { FEATURED };
