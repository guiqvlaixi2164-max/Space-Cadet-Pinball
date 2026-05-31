// scoring.js - points, the score multiplier, and the rank ladder. The ranks run
// from Cadet to Fleet Admiral; crossing a threshold is a promotion event the
// game surfaces to the player.

(function (PB) {
  'use strict';

  PB.Scoring = {
    ranks: [
      { name: 'Cadet', at: 0 },
      { name: 'Ensign', at: 20000 },
      { name: 'Lieutenant', at: 60000 },
      { name: 'Captain', at: 120000 },
      { name: 'Lieutenant Commander', at: 220000 },
      { name: 'Commander', at: 360000 },
      { name: 'Commodore', at: 550000 },
      { name: 'Admiral', at: 800000 },
      { name: 'Fleet Admiral', at: 1200000 },
    ],

    create: function () {
      return { score: 0, multiplier: 1, rankIndex: 0 };
    },

    // Award base points scaled by the current multiplier.
    add: function (sc, basePoints) {
      sc.score += basePoints * sc.multiplier;
    },

    // Award points with no multiplier (bonuses, jackpots).
    addRaw: function (sc, points) {
      sc.score += points;
    },

    setMultiplier: function (sc, m) { sc.multiplier = m; },

    bumpMultiplier: function (sc, inc, cap) {
      sc.multiplier += inc;
      if (cap && sc.multiplier > cap) sc.multiplier = cap;
    },

    rank: function (sc) { return PB.Scoring.ranks[sc.rankIndex]; },

    // Advance the rank index to match the score. Returns the new rank name if a
    // promotion happened this call, else null.
    updateRank: function (sc) {
      var r = sc.rankIndex;
      var ranks = PB.Scoring.ranks;
      while (r + 1 < ranks.length && sc.score >= ranks[r + 1].at) r++;
      if (r !== sc.rankIndex) { sc.rankIndex = r; return ranks[r].name; }
      return null;
    },
  };

})(window.PB = window.PB || {});
