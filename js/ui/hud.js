// hud.js - the in-play heads-up display: score, rank, ball count, multiplier,
// ball-save countdown, the tilt meter, and transient messages (promotions,
// jackpots, BALL SAVED). Drawn on the canvas over the playfield.

(function (PB) {
  'use strict';

  PB.format = {
    commas: function (n) {
      return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
  };

  PB.Hud = {
    draw: function (ctx, game) {
      var cfg = PB.config, t = cfg.theme, sc = game.scoring;
      var w = cfg.view.width;

      ctx.save();
      ctx.textBaseline = 'top';

      // Score, centered near the top.
      ctx.textAlign = 'center';
      ctx.fillStyle = t.neonCyan;
      ctx.shadowColor = t.neonCyan;
      ctx.shadowBlur = 10;
      ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
      ctx.fillText(PB.format.commas(sc.score), w / 2, 38);
      ctx.shadowBlur = 0;

      // Rank under the score.
      ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(223,241,255,0.85)';
      ctx.fillText(PB.Scoring.rank(sc).name, w / 2, 78);

      // Multiplier badge.
      if (sc.multiplier > 1) {
        ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = t.neonMagenta;
        ctx.fillText('x' + sc.multiplier, w / 2, 96);
      }

      // Ball number, top-left.
      ctx.textAlign = 'left';
      ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(223,241,255,0.7)';
      ctx.fillText('BALL ' + game.ballNumber + ' / ' + cfg.game.balls, 34, 44);

      // Remaining balls as dots, top-left.
      for (var i = 0; i < game.ballsLeft - 1; i++) {
        ctx.beginPath();
        ctx.fillStyle = t.text;
        ctx.arc(38 + i * 14, 70, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ball save countdown.
      if (game.ballSaveTimer > 0) {
        var frac = game.ballSaveTimer / cfg.game.ballSaveSeconds;
        ctx.textAlign = 'center';
        ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = t.neonGreen;
        ctx.fillText('BALL SAVE', w / 2, 820);
        ctx.fillStyle = 'rgba(124,255,178,0.25)';
        ctx.fillRect(w / 2 - 60, 838, 120, 5);
        ctx.fillStyle = t.neonGreen;
        ctx.fillRect(w / 2 - 60, 838, 120 * frac, 5);
      }

      // Tilt meter on the right edge.
      PB.Hud.drawTiltMeter(ctx, game);

      // Mission status and multiball lock (top center, under the rank/multiplier).
      var m = game.missions;
      if (m) {
        var S = PB.strings;
        ctx.textAlign = 'center';
        ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
        var defs = PB.Missions.defs();
        if (m.state === 'selected') {
          ctx.fillStyle = t.neonAmber;
          ctx.fillText(defs[m.selected].name + '  -  ' + S.mHitStart, w / 2, 150);
        } else if (m.state === 'active') {
          var d = defs[m.active];
          ctx.fillStyle = t.neonCyan;
          var prog = d.objective === 'bank' ? '' : ('  ' + m.progress + '/' + m.need);
          ctx.fillText(d.name + prog + '   ' + Math.ceil(m.timer) + 's', w / 2, 150);
        }
        if (m.multiball) {
          ctx.fillStyle = t.neonMagenta;
          ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
          ctx.fillText(S.mMultiballOn, w / 2, 170);
        } else if (m.lock > 0) {
          ctx.fillStyle = t.neonGreen;
          ctx.fillText(S.mLockLabel + m.lock + '/' + cfg.missions.lockNeed, w / 2, 170);
        }
      }

      // Transient message.
      if (game.messageTimer > 0 && game.message) {
        var a = Math.min(1, game.messageTimer * 2);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '800 26px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = t.neonAmber;
        ctx.shadowColor = t.neonAmber;
        ctx.shadowBlur = 16;
        ctx.fillText(game.message, w / 2, 470);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    },

    drawTiltMeter: function (ctx, game) {
      var cfg = PB.config, t = cfg.theme, tilt = game.sim.tilt;
      var bob = Math.min(tilt.bob / cfg.tilt.tiltAt, 1);
      var x = cfg.view.width - 22, y = 120, h = 150;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 8, h);
      var col = tilt.tilted ? t.neonRed
              : (tilt.bob > cfg.tilt.warnAt ? t.neonAmber : t.neonGreen);
      ctx.fillStyle = col;
      ctx.fillRect(x, y + h * (1 - bob), 8, h * bob);
      if (tilt.tilted) {
        ctx.fillStyle = t.neonRed;
        ctx.font = '800 28px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TILT', cfg.view.width / 2, 300);
      } else if (tilt.bob > cfg.tilt.warnAt) {
        ctx.fillStyle = t.neonAmber;
        ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAREFUL', cfg.view.width / 2, 300);
      }
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
