// target.js - drop targets. A drop target is a short segment the ball knocks
// down (deactivates) for points. When the whole bank is down it awards a bonus
// and pops back up after a short delay. Lit targets (used to select missions)
// arrive in Phase 4; the data model here already carries a "lit" field.

(function (PB) {
  'use strict';

  PB.Target = {
    // Build a vertical bank of drop targets as collision segments.
    createBank: function () {
      var c = PB.config.dropTargets;
      var targets = [];
      for (var i = 0; i < c.ys.length; i++) {
        var seg = PB.makeSegment(c.x, c.ys[i], c.x, c.ys[i] + c.height, {
          kind: 'drop',
          score: PB.config.score.dropTarget,
          restitution: 0.3,
        });
        seg.down = false; // visual state; seg.active drives collision
        targets.push(seg);
      }
      return { targets: targets, resetTimer: 0 };
    },

    // Knock a target down. Returns true if it was standing.
    drop: function (seg) {
      if (!seg.active) return false;
      seg.active = false;
      seg.down = true;
      return true;
    },

    allDown: function (bank) {
      for (var i = 0; i < bank.targets.length; i++) {
        if (bank.targets[i].active) return false;
      }
      return true;
    },

    raiseAll: function (bank) {
      for (var i = 0; i < bank.targets.length; i++) {
        bank.targets[i].active = true;
        bank.targets[i].down = false;
      }
    },

    update: function (bank, dt) {
      if (bank.resetTimer > 0) {
        bank.resetTimer -= dt;
        if (bank.resetTimer <= 0) PB.Target.raiseAll(bank);
      }
    },

    draw: function (ctx, seg) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      if (seg.active) {
        ctx.strokeStyle = seg.lit > 0 ? PB.config.theme.neonMagenta : PB.config.theme.neonGreen;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = 'rgba(120,140,180,0.25)'; // dropped: dim stub
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
      }
      ctx.beginPath();
      ctx.moveTo(seg.a.x, seg.a.y);
      ctx.lineTo(seg.b.x, seg.b.y);
      ctx.stroke();
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
