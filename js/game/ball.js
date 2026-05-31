// ball.js - rendering for the ball. The ball's physical state is a plain body
// from physics.js (PB.makeBall); this module only knows how to draw it, using
// the interpolated position so motion looks smooth between fixed steps.

(function (PB) {
  'use strict';

  PB.Ball = {
    // Linear interpolation between the previous and current step positions.
    lerpPos: function (body, alpha) {
      return {
        x: body.prev.x + (body.pos.x - body.prev.x) * alpha,
        y: body.prev.y + (body.pos.y - body.prev.y) * alpha,
      };
    },

    draw: function (ctx, body, alpha) {
      var p = PB.Ball.lerpPos(body, alpha);
      var r = body.radius;

      // Soft glow.
      ctx.save();
      ctx.shadowColor = 'rgba(180,220,255,0.9)';
      ctx.shadowBlur = 16;

      // Chrome sphere with a directional highlight (faux-3D shading).
      var g = ctx.createRadialGradient(
        p.x - r * 0.35, p.y - r * 0.4, r * 0.15,
        p.x, p.y, r
      );
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#dfeaff');
      g.addColorStop(1, '#5e7196');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
