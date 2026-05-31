// ramp.js - helpers for guided lanes and curved guides. In a top-down 2D table,
// a ramp or orbit is a smooth wall that routes the ball; we approximate curves
// with short chained segments so the existing collision solver handles them.

(function (PB) {
  'use strict';

  PB.Ramp = {
    // Return an array of segments approximating an arc centered at (cx, cy) from
    // angle a0 to a1 (radians), with the given radius and number of steps.
    arc: function (cx, cy, radius, a0, a1, steps, opts) {
      var segs = [];
      var prevx = cx + radius * Math.cos(a0);
      var prevy = cy + radius * Math.sin(a0);
      for (var i = 1; i <= steps; i++) {
        var t = a0 + (a1 - a0) * (i / steps);
        var x = cx + radius * Math.cos(t);
        var y = cy + radius * Math.sin(t);
        segs.push(PB.makeSegment(prevx, prevy, x, y, opts));
        prevx = x; prevy = y;
      }
      return segs;
    },

    // A straight guide lane: two parallel walls forming a channel. Returns the
    // wall segments (the lane itself is empty space between them).
    lane: function (ax, ay, bx, by, halfWidth, opts) {
      var dx = bx - ax, dy = by - ay;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len * halfWidth, ny = dx / len * halfWidth;
      return [
        PB.makeSegment(ax + nx, ay + ny, bx + nx, by + ny, opts),
        PB.makeSegment(ax - nx, ay - ny, bx - nx, by - ny, opts),
      ];
    },
  };

})(window.PB = window.PB || {});
