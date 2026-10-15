/*
 * Merging saved progress from two places (this device and the signed-in
 * account), so nothing is lost when someone plays on several devices.
 */
(function (root) {
  'use strict';

  // In-progress puzzles kept in the account; the oldest drop off first.
  const MAX_SYNCED_SAVES = 15;

  // The part of the local store that belongs to the player rather than the
  // device. Settings, the chosen difficulty and tab stay per device.
  function syncable(store) {
    const saves = Object.entries(store.saves || {})
      .sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0))
      .slice(0, MAX_SYNCED_SAVES);
    return {
      solves: store.solves || {},
      best: store.best || {},
      seen: store.seen || {},
      lastWords: store.lastWords || {},
      solvedCount: store.solvedCount || 0,
      saves: Object.fromEntries(saves),
    };
  }

  // The better of two records of the same solve: clean beats assisted, then
  // the faster time.
  function betterSolve(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.clean !== b.clean) return a.clean ? a : b;
    return (b.time || Infinity) < (a.time || Infinity) ? b : a;
  }

  // Merges an account's progress into the local store, returning a new
  // store. Device settings come from local.
  function mergeStores(local, remote) {
    remote = remote || {};
    const out = Object.assign({}, local);

    out.solves = Object.assign({}, remote.solves);
    for (const [k, s] of Object.entries(local.solves || {})) out.solves[k] = betterSolve(out.solves[k], s);

    out.best = Object.assign({}, remote.best);
    for (const [k, t] of Object.entries(local.best || {})) {
      out.best[k] = out.best[k] == null ? t : Math.min(out.best[k], t);
    }

    out.seen = {};
    for (const id of new Set([...Object.keys(local.seen || {}), ...Object.keys(remote.seen || {})])) {
      out.seen[id] = [...new Set([...((remote.seen || {})[id] || []), ...((local.seen || {})[id] || [])])];
    }

    out.lastWords = Object.assign({}, remote.lastWords, local.lastWords);
    out.solvedCount = Math.max(local.solvedCount || 0, remote.solvedCount || 0);

    // Puzzles in progress: the most recently played copy wins, and a puzzle
    // finished on either device is no longer in progress.
    out.saves = {};
    for (const k of new Set([...Object.keys(local.saves || {}), ...Object.keys(remote.saves || {})])) {
      const a = (local.saves || {})[k];
      const b = (remote.saves || {})[k];
      const save = !a ? b : !b ? a : (b.updated || 0) > (a.updated || 0) ? b : a;
      const solve = out.solves[k];
      if (solve && (solve.at || 0) >= (save.updated || 0)) continue;
      out.saves[k] = save;
    }
    return out;
  }

  // True when merging would change the account's copy.
  function differs(a, b) {
    return JSON.stringify(syncable(a)) !== JSON.stringify(syncable(b));
  }

  const api = { syncable, mergeStores, differs, MAX_SYNCED_SAVES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
