// loop.js - fixed-timestep accumulator loop with render interpolation.
// The simulation always advances in equal-sized steps (deterministic), while
// rendering runs at the display refresh rate and interpolates between the last
// two simulated states using the leftover-time fraction "alpha".

(function (PB) {
  'use strict';

  PB.loop = {
    create: function (opts) {
      var hz = opts.hz || 120;
      var step = 1 / hz;
      var maxSub = opts.maxSubSteps || 8;
      var update = opts.update;
      var render = opts.render;

      var acc = 0;
      var last = 0;
      var raf = 0;
      var running = false;

      function frame(ts) {
        if (!running) return;
        if (!last) last = ts;
        var dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.25) dt = 0.25; // ignore huge gaps (tab was backgrounded)

        acc += dt;
        var n = 0;
        while (acc >= step && n < maxSub) {
          update(step);
          acc -= step;
          n++;
        }
        if (n === maxSub) acc = 0; // drop the backlog rather than spiral

        render(acc / step);
        raf = requestAnimationFrame(frame);
      }

      return {
        start: function () {
          if (running) return;
          running = true;
          last = 0;
          raf = requestAnimationFrame(frame);
        },
        stop: function () {
          running = false;
          if (raf) cancelAnimationFrame(raf);
        },
      };
    },
  };

})(window.PB = window.PB || {});
