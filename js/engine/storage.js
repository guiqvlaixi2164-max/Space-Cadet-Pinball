// storage.js - LocalStorage persistence with a small versioned schema for high
// scores and settings. Everything is wrapped in try/catch so the game still runs
// where storage is unavailable or blocked (some browsers restrict it on file://).

(function (PB) {
  'use strict';

  var KEY = 'pb.save.v1';
  var VERSION = 2;

  function defaults() {
    return {
      version: VERSION,
      highScores: [],   // [{ name, score, rank }]
      settings: {
        volume: 0.7,
        muted: false,
        reducedMotion: false,
        colorblind: false,
        // v2 added nudge and pause bindings (all controls are now remappable).
        keymap: {
          flipperLeft: 'ShiftLeft', flipperRight: 'ShiftRight', plunger: 'Space',
          nudgeLeft: 'ArrowLeft', nudgeRight: 'ArrowRight', nudgeUp: 'ArrowUp',
          pause: 'KeyP',
        },
      },
    };
  }

  // Stepwise upgrade functions: each takes a save at version N and returns it at
  // version N+1, PRESERVING the player's data. New schema versions add an entry
  // here; data is never discarded on a normal upgrade.
  var MIGRATIONS = {
    1: function (d) {
      // v1 -> v2: backfill the new keymap bindings, keep scores and settings.
      d.settings = d.settings || {};
      d.settings.keymap = assign(defaults().settings.keymap, d.settings.keymap || {});
      d.version = 2;
      return d;
    },
  };

  function migrate(d) {
    if (!d || typeof d !== 'object' || typeof d.version !== 'number') return defaults();
    // Run upgrades in sequence up to the current version.
    var guard = 0;
    while (d.version < VERSION) {
      var step = MIGRATIONS[d.version];
      if (!step || guard++ > 100) return defaults();  // unknown gap: safe fallback
      d = step(d);
    }
    if (d.version !== VERSION) return defaults();      // a newer (downgraded) save
    // Fill any missing fields without clobbering existing values.
    var def = defaults();
    d.settings = assign(def.settings, d.settings || {});
    d.settings.keymap = assign(def.settings.keymap, d.settings.keymap || {});
    if (!Array.isArray(d.highScores)) d.highScores = [];
    return d;
  }

  function assign(base, over) {
    var out = {};
    var k;
    for (k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
    for (k in over) if (over.hasOwnProperty(k)) out[k] = over[k];
    return out;
  }

  PB.storage = {
    KEY: KEY,
    defaults: defaults,
    migrate: migrate,

    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return defaults();
        return migrate(JSON.parse(raw));
      } catch (e) {
        return defaults();
      }
    },

    save: function (data) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    },

    // Would this score make the high-score table?
    qualifies: function (data, score) {
      var hs = data.highScores;
      var cap = PB.config.game.maxHighScores;
      return hs.length < cap || score > hs[hs.length - 1].score;
    },

    // Insert a score, keep the list sorted and capped, and persist. Returns the
    // updated (in-memory) data so callers can use it without reloading.
    addHighScore: function (data, name, score, rank) {
      data.highScores.push({ name: name, score: score, rank: rank });
      data.highScores.sort(function (a, b) { return b.score - a.score; });
      data.highScores = data.highScores.slice(0, PB.config.game.maxHighScores);
      PB.storage.save(data);
      return data;
    },
  };

})(window.PB = window.PB || {});
