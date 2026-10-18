/*
 * Optional, privacy-conscious analytics: Google Analytics 4.
 *
 * It does nothing at all unless both are true:
 *   1. js/firebase-config.js has a measurementId (G-…), and
 *   2. the player said yes to "Help improve Crossword Hub?".
 * Before that, no Google script is loaded and no cookie is set. Saying no
 * later switches it off again and removes Google Analytics' cookies.
 *
 * Events carry no names, emails or answers: only what was played and how
 * (for example the genre, level, time and hint points). Advertising features
 * and Google signals are switched off.
 */
(function (root) {
  'use strict';

  const config = root.FIREBASE_CONFIG || {};
  const id = /^G-[A-Z0-9]+$/.test(config.measurementId || '') ? config.measurementId : null;
  let started = false;

  function start() {
    if (!id || started) return;
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
    });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s);
  }

  function stop() {
    if (!id) return;
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
  }

  function track(name, params) {
    if (!started || !root.gtag) return;
    root.gtag('event', name, params || {});
  }

  function page(path) {
    track('page_view', { page_path: path, page_location: `${location.origin}${location.pathname.replace(/\/$/, '')}${path}`, page_title: document.title });
  }

  root.HubAnalytics = { available: !!id, start, stop, track, page };
})(typeof window !== 'undefined' ? window : globalThis);
