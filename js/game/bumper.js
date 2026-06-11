// bumper.js - pop bumpers. A bumper is a circular obstacle that bounces the ball
// with an extra outward impulse (kick) and awards score. The physical bounce is
// handled by the swept circle test in collision.js; this module owns the bumper
// data and its lit/flash animation.

(function (PB) {
  'use strict';

  PB.Bumper = {
    create: function (spec) {
      var b = PB.config.bumpers;
      return {
        x: spec.x, y: spec.y, r: spec.r,
        restitution: b.restitution,
        kick: b.kick,
        score: PB.config.score.bumper,
        kind: 'bumper',
        active: true,
        lit: 0,        // counts down after a hit, drives the flash
      };
    },

    hit: function (bumper) {
      bumper.lit = PB.config.bumpers.litSeconds;
    },

    update: function (bumper, dt) {
      if (bumper.lit > 0) {
        bumper.lit -= dt;
        if (bumper.lit < 0) bumper.lit = 0;
      }
    },

    draw: function (ctx, bumper) {
      var lit = bumper.lit > 0;
      var k = bumper.lit / PB.config.bumpers.litSeconds; // 1..0
      var reduced = PB.reduced;
      ctx.save();

      // Outer ring. Under reduced motion the glow does not pulse with the hit.
      ctx.strokeStyle = lit ? PB.config.theme.neonAmber : '#6f86d6';
      ctx.lineWidth = 4;
      ctx.shadowColor = lit ? PB.config.theme.neonAmber : 'rgba(111,134,214,0.7)';
      ctx.shadowBlur = reduced ? (lit ? 10 : 8) : (lit ? 24 * k + 8 : 10);
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
      ctx.stroke();

      // Cap.
      var g = ctx.createRadialGradient(
        bumper.x - bumper.r * 0.3, bumper.y - bumper.r * 0.3, bumper.r * 0.2,
        bumper.x, bumper.y, bumper.r
      );
      g.addColorStop(0, lit ? '#fff2cf' : '#cdd9ff');
      g.addColorStop(1, lit ? '#e7a52f' : '#3c4c80');
      ctx.shadowBlur = 0;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
