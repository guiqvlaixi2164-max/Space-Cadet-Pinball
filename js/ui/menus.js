// menus.js - canvas-drawn menus: attract/title, pause, settings, and game over
// with arcade-style initials entry. The state machine and navigation live in
// main.js; this module renders a menu model and a few specific screens. Items
// are pre-formatted strings so settings can show their current values.

(function (PB) {
  'use strict';

  function dimBackground(ctx) {
    var cfg = PB.config;
    ctx.save();
    ctx.fillStyle = cfg.theme.dim;
    ctx.fillRect(0, 0, cfg.view.width, cfg.view.height);
    ctx.restore();
  }

  function titleBlock(ctx, y) {
    var cfg = PB.config, t = cfg.theme, w = cfg.view.width, s = PB.strings;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.neonCyan;
    ctx.shadowColor = t.neonCyan; ctx.shadowBlur = 22;
    ctx.font = '800 52px "Segoe UI", Arial, sans-serif';
    ctx.fillText(s.title, w / 2, y);
    ctx.fillStyle = t.neonMagenta;
    ctx.shadowColor = t.neonMagenta; ctx.shadowBlur = 16;
    ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(s.subtitle.toUpperCase(), w / 2, y + 40);
    ctx.shadowBlur = 0;
  }

  PB.Menus = {
    dimBackground: dimBackground,

    drawAttract: function (ctx, save, blinkOn) {
      var cfg = PB.config, t = cfg.theme, w = cfg.view.width, s = PB.strings;
      titleBlock(ctx, 220);

      // Top high scores.
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(223,241,255,0.85)';
      ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(s.highScores, w / 2, 360);

      ctx.font = '500 15px "Consolas", "Segoe UI", monospace';
      var hs = save.highScores;
      if (!hs.length) {
        ctx.fillStyle = 'rgba(223,241,255,0.45)';
        ctx.fillText(s.noScores, w / 2, 392);
      } else {
        for (var i = 0; i < Math.min(hs.length, 6); i++) {
          var row = (i + 1) + '.  ' + hs[i].name + '   ' + PB.format.commas(hs[i].score);
          ctx.fillStyle = i === 0 ? t.neonAmber : 'rgba(223,241,255,0.8)';
          ctx.fillText(row, w / 2, 388 + i * 24);
        }
      }

      if (blinkOn) {
        ctx.fillStyle = t.neonAmber;
        ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
        ctx.fillText(s.pressStart, w / 2, 600);
      }
      ctx.fillStyle = 'rgba(223,241,255,0.6)';
      ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(s.settingsHint, w / 2, 640);
    },

    // Generic vertical menu. lines: array of strings. index: highlighted row.
    drawMenu: function (ctx, title, lines, index, footer) {
      var cfg = PB.config, t = cfg.theme, w = cfg.view.width;
      dimBackground(ctx);
      ctx.textAlign = 'center';
      ctx.fillStyle = t.neonCyan;
      ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText(title, w / 2, 240);

      var y0 = 320, dy = 42;
      for (var i = 0; i < lines.length; i++) {
        var sel = i === index;
        ctx.font = (sel ? '700 ' : '500 ') + '20px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = sel ? t.neonAmber : 'rgba(223,241,255,0.8)';
        if (sel) {
          ctx.fillStyle = 'rgba(255,194,75,0.14)';
          ctx.fillRect(w / 2 - 200, y0 + i * dy - 16, 400, 32);
          ctx.fillStyle = t.neonAmber;
        }
        ctx.fillText(lines[i], w / 2, y0 + i * dy - 10);
      }

      if (footer) {
        ctx.fillStyle = 'rgba(223,241,255,0.55)';
        ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(footer, w / 2, 760);
      }
    },

    drawGameOver: function (ctx, ctxData) {
      // ctxData: { score, rankName, entering, initials, pos, highScores, blinkOn }
      var cfg = PB.config, t = cfg.theme, w = cfg.view.width, s = PB.strings;
      dimBackground(ctx);
      ctx.textAlign = 'center';

      ctx.fillStyle = t.neonRed;
      ctx.shadowColor = t.neonRed; ctx.shadowBlur = 18;
      ctx.font = '800 40px "Segoe UI", Arial, sans-serif';
      ctx.fillText(s.gameOver, w / 2, 200);
      ctx.shadowBlur = 0;

      ctx.fillStyle = t.text;
      ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
      ctx.fillText(PB.format.commas(ctxData.score), w / 2, 256);
      ctx.fillStyle = 'rgba(223,241,255,0.8)';
      ctx.font = '500 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(ctxData.rankName, w / 2, 286);

      if (ctxData.entering) {
        ctx.fillStyle = t.neonGreen;
        ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
        ctx.fillText(s.newHighScore, w / 2, 350);
        ctx.fillText(s.enterInitials, w / 2, 374);

        var initials = ctxData.initials;
        var spacing = 56, startX = w / 2 - spacing;
        for (var i = 0; i < 3; i++) {
          var x = startX + i * spacing;
          var sel = i === ctxData.pos;
          ctx.fillStyle = sel ? t.neonAmber : 'rgba(223,241,255,0.85)';
          ctx.font = '800 44px "Consolas", monospace';
          ctx.fillText(initials[i], x, 440);
          if (sel) {
            ctx.fillStyle = t.neonAmber;
            ctx.fillRect(x - 18, 458, 36, 4);
          }
        }
        ctx.fillStyle = 'rgba(223,241,255,0.55)';
        ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(s.initialsHint, w / 2, 500);
      } else {
        ctx.fillStyle = 'rgba(223,241,255,0.85)';
        ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
        ctx.fillText(s.highScores, w / 2, 360);
        ctx.font = '500 15px "Consolas", monospace';
        var hs = ctxData.highScores;
        for (var j = 0; j < Math.min(hs.length, 6); j++) {
          ctx.fillStyle = j === 0 ? t.neonAmber : 'rgba(223,241,255,0.8)';
          ctx.fillText((j + 1) + '.  ' + hs[j].name + '   ' + PB.format.commas(hs[j].score),
                       w / 2, 390 + j * 24);
        }
        if (ctxData.blinkOn) {
          ctx.fillStyle = t.neonAmber;
          ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
          ctx.fillText(s.continuePrompt, w / 2, 600);
        }
      }
    },
  };

})(window.PB = window.PB || {});
