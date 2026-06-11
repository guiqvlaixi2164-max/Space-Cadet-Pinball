// plunger.js - the launch plunger. Hold to charge (the head pulls down and the
// meter fills); release to fire, which imparts an upward velocity to the ball
// when it is resting in the launch lane. Charge accumulates per fixed step, so
// the same hold duration always produces the same launch (deterministic).

(function (PB) {
  'use strict';

  PB.Plunger = {
    create: function () {
      return {
        charge: 0,        // 0..1
        prevHeld: false,
        fired: 0,         // launch speed of the most recent fire (for feedback)
      };
    },

    // Advance plunger state for one fixed step and launch on release.
    // Returns the launch speed if it fired this step, else 0.
    update: function (plunger, ball, held, dt) {
      var cfg = PB.config.plunger;

      var inLane = ball.active &&
        ball.pos.x > cfg.laneXMin &&
        ball.pos.y > cfg.laneYMin &&
        (ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y) <
          cfg.launchSpeedMax * cfg.launchSpeedMax;

      var launched = 0;

      if (held && inLane) {
        plunger.charge += dt / cfg.chargeSeconds;
        if (plunger.charge > 1) plunger.charge = 1;
      }

      // Release edge: fire if we had charge and the ball is launchable.
      if (plunger.prevHeld && !held) {
        if (inLane && plunger.charge > 0) {
          var speed = cfg.minLaunch + plunger.charge * (cfg.maxLaunch - cfg.minLaunch);
          ball.vel.y = -speed;
          ball.vel.x = 0;
          launched = speed;
          plunger.fired = speed;
        }
        plunger.charge = 0;
      }

      plunger.prevHeld = held;
      return launched;
    },

    draw: function (ctx, plunger, laneX, laneW) {
      var cfg = PB.config.plunger, theme = PB.config.theme;
      var headY = cfg.restY + plunger.charge * cfg.maxPull;
      var cx = laneX + laneW / 2;
      var innerX = laneX + 4, innerW = laneW - 8;

      // Charge readout lives inside the launch lane (on-playfield, where the player
      // aims), not in the off-field gutter. It appears only while charging: the
      // lane fills amber from the bottom, with a brighter green "skill shot" band
      // near the top and tick marks for repeatable power.
      if (plunger.charge > 0) {
        var trackBot = 890, trackTop = 700, trackH = trackBot - trackTop;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(innerX, trackTop, innerW, trackH);
        ctx.fillStyle = 'rgba(124,255,178,0.16)';      // skill-shot band (top ~16%)
        ctx.fillRect(innerX, trackTop, innerW, trackH * 0.16);
        var fillH = trackH * plunger.charge;
        var skill = plunger.charge >= 0.84;
        ctx.fillStyle = skill ? theme.neonGreen : theme.neonAmber;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = PB.reduced ? 0 : 8;
        ctx.fillRect(innerX, trackBot - fillH, innerW, fillH);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        for (var k = 1; k < 4; k++) {
          var ty = trackBot - trackH * (k / 4);
          ctx.beginPath(); ctx.moveTo(innerX, ty); ctx.lineTo(innerX + innerW, ty); ctx.stroke();
        }
      }

      // Shaft.
      ctx.fillStyle = '#3a4566';
      ctx.fillRect(cx - 3, headY, 6, PB.config.view.height - headY);

      // Head.
      ctx.fillStyle = plunger.charge > 0 ? theme.neonAmber : '#9fb0d8';
      ctx.fillRect(laneX + 4, headY, laneW - 8, 10);
    },
  };

})(window.PB = window.PB || {});
