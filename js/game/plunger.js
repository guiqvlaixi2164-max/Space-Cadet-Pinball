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
      var cfg = PB.config.plunger;
      var headY = cfg.restY + plunger.charge * cfg.maxPull;
      var cx = laneX + laneW / 2;

      // Shaft.
      ctx.fillStyle = '#3a4566';
      ctx.fillRect(cx - 3, headY, 6, PB.config.view.height - headY);

      // Head.
      ctx.fillStyle = plunger.charge > 0 ? PB.config.theme.neonAmber : '#9fb0d8';
      ctx.fillRect(laneX + 4, headY, laneW - 8, 10);

      // Charge meter to the right of the lane.
      if (plunger.charge > 0) {
        var mx = laneX + laneW + 6;
        var mh = 120;
        var my = PB.config.view.height - 40 - mh;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(mx, my, 6, mh);
        ctx.fillStyle = PB.config.theme.neonAmber;
        ctx.fillRect(mx, my + mh * (1 - plunger.charge), 6, mh * plunger.charge);
      }
    },
  };

})(window.PB = window.PB || {});
