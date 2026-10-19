/*
 * Optional, privacy-conscious analytics: Google Analytics 4 (free).
 *
 * It does nothing at all unless both are true:
 *   1. js/firebase-config.js has a measurementId (G-…), and
 *   2. the player said yes to "Help improve Crossword Hub?".
 * Before that, no Google script is loaded and no cookie is set. Saying no
 * later switches it off again and removes Google Analytics' cookies.
 *
 * Only the events and fields listed in ALLOWED are ever sent; anything else
 * is dropped, as is any value that looks like an email address. So answers,
 * gift stories, names and emails can't reach Google even by mistake. Page
 * addresses are reduced to a plain path (no puzzle codes, challenge data or
 * private links), page titles are generic, and advertising features and
 * Google signals are off.
 *
 * Analytics can never interrupt play: every call is wrapped, and nothing
 * waits for Google's script (which ad blockers may stop).
 */
(function (root) {
  'use strict';

  // Event name → the fields it may carry. Values must be short strings,
  // numbers or true/false.
  const PUZZLE = ['puzzle_kind', 'category', 'level', 'genre'];
  const ALLOWED = {
    page_view: ['page_path', 'page_location', 'page_title'],
    puzzle_start: [...PUZZLE, 'resumed'],
    puzzle_complete: [...PUZZLE, 'seconds', 'hint_points', 'assisted', 'no_hint', 'challenge', 'collab'],
    hint_used: ['hint', 'puzzle_kind'],
    check_used: ['scope', 'puzzle_kind'],
    autocheck_on: ['puzzle_kind'],
    share: ['method', 'content_type', 'item_id'],
    challenge_open: ['page'],
    return_visit: ['days_since_last_visit'],
    room_create: ['puzzle_kind'],
    room_join: ['puzzle_kind'],
    gift_create: ['words'], // how many answers only: never the gift itself
    arcade_start: ['mode'],
    arcade_end: ['mode', 'score', 'correct', 'round'],
  };
  const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

  // Keeps only allowed fields with safe values; null if the event isn't allowed.
  function clean(name, params) {
    const keys = ALLOWED[name];
    if (!keys) return null;
    const out = {};
    for (const k of keys) {
      const v = params && params[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string' && v.length <= 100 && !EMAIL.test(v)) out[k] = v;
    }
    return out;
  }

  const config = root.FIREBASE_CONFIG || {};
  const id = /^G-[A-Z0-9]+$/.test(config.measurementId || '') ? config.measurementId : null;
  let started = false;
  const base = () => `${location.origin}${location.pathname.replace(/\/$/, '')}`;

  function start() {
    if (!id || started) return;
    try {
      started = true;
      root[`ga-disable-${id}`] = false;
      root.dataLayer = root.dataLayer || [];
      root.gtag = function gtag() { root.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
      root.gtag('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      });
      root.gtag('js', new Date());
      root.gtag('config', id, {
        send_page_view: false, // pages are sent from the app's router
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        // Never the real address: it can hold puzzle codes or private links.
        page_location: `${base()}/`,
        page_title: 'Crossword Hub',
      });
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      document.head.appendChild(s);
    } catch (e) {
      started = false;
    }
  }

  function stop() {
    if (!id) return;
    try {
      root[`ga-disable-${id}`] = true;
      started = false;
      // Remove Google Analytics' cookies (_ga and _ga_<id>).
      for (const c of document.cookie.split(';')) {
        const name = c.split('=')[0].trim();
        if (!/^_ga/.test(name)) continue;
        const host = location.hostname;
        for (const domain of ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]) {
          document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
        }
      }
    } catch (e) {
      /* never let analytics affect the game */
    }
  }

  function track(name, params) {
    if (!started || !root.gtag) return;
    try {
      const safe = clean(name, params);
      if (safe) root.gtag('event', name, safe);
    } catch (e) {
      /* never let analytics affect the game */
    }
  }

  // A page view for a cleaned path such as '/play/friends/fan'. The address
  // and title are set for every later event too, so nothing Google collects
  // automatically carries the real address or a page's own title.
  function page(path) {
    if (!started || !root.gtag) return;
    try {
      const page_location = `${base()}${path}`;
      const page_title = `Crossword Hub ${path}`;
      root.gtag('set', { page_location, page_title });
      track('page_view', { page_path: path, page_location, page_title });
    } catch (e) {
      /* never let analytics affect the game */
    }
  }

  root.HubAnalytics = { available: !!id, start, stop, track, page, clean, ALLOWED };
  if (typeof module !== 'undefined' && module.exports) module.exports = { clean, ALLOWED };
})(typeof window !== 'undefined' ? window : globalThis);
