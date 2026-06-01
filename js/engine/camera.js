// camera.js - screen shake for impact feedback (deluxe polish).
//
// Uses a "trauma" model: events add trauma (0..1), and the shake offset scales
// with trauma squared so small hits barely register while big ones (jackpot,
// multiball, drain) really kick. Trauma decays continuously, so the shake settles
// on its own. The offset is driven by sine waves of the elapsed time rather than
// a PRNG, so it never touches the simulation's deterministic random stream. This
// is render-only and is suppressed under reduced motion by the caller.

(function (PB) {
  'use strict';

  PB.camera = {
    create: function () {
      return { trauma: 0, t: 0, x: 0, y: 0, angle: 0, maxOffset: 16, maxAngle: 0.025 };
    },

    // Add trauma from an event (clamped to 1).
    shake: function (cam, amount) {
      cam.trauma = Math.min(1, cam.trauma + amount);
    },

    update: function (cam, dt) {
      cam.t += dt;
      cam.trauma -= 1.5 * dt;
      if (cam.trauma < 0) cam.trauma = 0;
      var s = cam.trauma * cam.trauma;       // ease the response
      cam.x = cam.maxOffset * s * Math.sin(cam.t * 57.3);
      cam.y = cam.maxOffset * s * Math.sin(cam.t * 49.1 + 1.7);
      cam.angle = cam.maxAngle * s * Math.sin(cam.t * 43.7 + 0.6);
    },

    // Push the shake transform around a draw; pair with end().
    begin: function (ctx, cam) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      if (cam.angle) {
        var cx = PB.config.view.width / 2, cy = PB.config.view.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(cam.angle);
        ctx.translate(-cx, -cy);
      }
    },

    end: function (ctx) { ctx.restore(); },
  };

})(window.PB = window.PB || {});
