// transform.js - Innovation 1: Dynamic Table Transformation.
//
// The table reconfigures between two modes: Station (the classic layout) and
// Asteroid Field. On a toggle the change animates over a fixed duration: the pop
// bumpers glide to a new formation and resize, and two deflector walls deploy by
// growing out from a point into full segments. Because the morph is driven from
// the fixed-step update and every body position is a pure function of a single
// progress value, the reconfiguration is deterministic and the swept collision
// keeps working against the interpolated bodies.
//
// State lives on sim.transform. toggle() flips the target mode; update() eases
// the live progress toward it each step and writes the interpolated geometry
// straight onto the live collision bodies.

(function (PB) {
  'use strict';

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  PB.transform = {
    // Pair each pop bumper with its Asteroid position and create the (initially
    // retracted, inactive) deflector segments. Called once the table bodies exist.
    build: function (sim, def) {
      var T = def.transform || {};
      var state = { mode: 0, t: 0, p: 0, bumpers: [], deflectors: [] };

      var circles = sim.world.circles, alts = T.bumpers || [];
      for (var i = 0; i < circles.length; i++) {
        var c = circles[i];
        var alt = (alts[i] && alts[i].alt) || { x: c.x, y: c.y, r: c.r };
        state.bumpers.push({ body: c, home: { x: c.x, y: c.y, r: c.r }, alt: alt });
      }

      var defl = T.deflectors || [];
      for (i = 0; i < defl.length; i++) {
        var dd = defl[i];                       // [ax, ay, bx, by] when deployed
        var mx = (dd[0] + dd[2]) / 2, my = (dd[1] + dd[3]) / 2;
        var seg = PB.makeSegment(mx, my, mx, my, { kind: 'wall' });
        seg.active = false;
        seg.morph = true;                       // renderer draws these specially
        sim.world.segments.push(seg);
        state.deflectors.push({ seg: seg, mid: { x: mx, y: my },
          end: { ax: dd[0], ay: dd[1], bx: dd[2], by: dd[3] } });
      }

      sim.transform = state;
      PB.transform._assertClear(sim, state);
    },

    // Dev assertion: warn if any bumper disc (in either mode) would overlap a
    // drop-target or standup segment, which would make that target unhittable.
    _assertClear: function (sim, state) {
      if (!window.console || !console.warn) return;
      var segs = [];
      if (sim.bank) segs = segs.concat(sim.bank.targets);
      if (sim.standups) segs = segs.concat(sim.standups);
      var ballR = PB.config.physics.ballRadius;
      for (var i = 0; i < state.bumpers.length; i++) {
        var m = state.bumpers[i];
        checkDisc(m.home, i, 'Station'); checkDisc(m.alt, i, 'Asteroid');
      }
      function checkDisc(c, idx, mode) {
        for (var j = 0; j < segs.length; j++) {
          var s = segs[j], ax = s.a.x, ay = s.a.y, ex = s.b.x - ax, ey = s.b.y - ay;
          var L2 = ex * ex + ey * ey || 1;
          var tt = ((c.x - ax) * ex + (c.y - ay) * ey) / L2;
          tt = tt < 0 ? 0 : (tt > 1 ? 1 : tt);
          var dx = c.x - (ax + ex * tt), dy = c.y - (ay + ey * tt);
          var min = c.r + ballR;
          if (dx * dx + dy * dy < min * min) {
            console.warn('transform: bumper ' + idx + ' (' + mode + ') overlaps a ' +
              s.kind + ' target; it may be unhittable.');
          }
        }
      }
    },

    // Push any ball that a moving bumper or deploying deflector has grown into
    // back out along the surface normal, cancelling the inward velocity. The
    // swept ball-vs-static solver cannot see an obstacle moving into a still
    // ball, so without this a morph can pin or jolt a resting ball. Cheap: only
    // runs while the table is actually morphing.
    depenetrate: function (sim) {
      var s = sim.transform;
      if (!s) return;
      var bodies = sim.world.bodies, skin = sim.world.skin, i, k;
      for (i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (!b.active) continue;
        for (k = 0; k < s.bumpers.length; k++) {
          var c = s.bumpers[k].body;
          var dx = b.pos.x - c.x, dy = b.pos.y - c.y, rr = b.radius + c.r;
          var d2 = dx * dx + dy * dy;
          if (d2 < rr * rr && d2 > 1e-9) pushOut(b, dx, dy, Math.sqrt(d2), rr, skin);
        }
        for (k = 0; k < s.deflectors.length; k++) {
          var seg = s.deflectors[k].seg;
          if (!seg.active) continue;
          var ax = seg.a.x, ay = seg.a.y, ex = seg.b.x - ax, ey = seg.b.y - ay;
          var L2 = ex * ex + ey * ey;
          if (L2 < 1e-9) continue;
          var tt = ((b.pos.x - ax) * ex + (b.pos.y - ay) * ey) / L2;
          tt = tt < 0 ? 0 : (tt > 1 ? 1 : tt);
          var qx = b.pos.x - (ax + ex * tt), qy = b.pos.y - (ay + ey * tt);
          var dd2 = qx * qx + qy * qy;
          if (dd2 < b.radius * b.radius && dd2 > 1e-9) pushOut(b, qx, qy, Math.sqrt(dd2), b.radius, skin);
        }
      }
      function pushOut(b, dx, dy, d, target, skin) {
        var nx = dx / d, ny = dy / d, push = target - d + skin;
        b.pos.x += nx * push; b.pos.y += ny * push;
        var vn = b.vel.x * nx + b.vel.y * ny;
        if (vn < 0) { b.vel.x -= vn * nx; b.vel.y -= vn * ny; }
      }
    },

    // Flip the target mode; update() animates the rest.
    toggle: function (sim) {
      if (!sim.transform) return;
      sim.transform.mode = sim.transform.mode ? 0 : 1;
    },

    mode: function (sim) { return sim.transform ? sim.transform.mode : 0; },
    morphing: function (sim) { var s = sim.transform; return s && s.t !== s.mode; },

    // Advance the morph and write interpolated geometry onto the bodies.
    update: function (sim, dt) {
      var s = sim.transform;
      if (!s) return;
      var dur = PB.config.transform.duration;

      if (s.t !== s.mode) {
        var dir = s.mode > s.t ? 1 : -1;
        s.t += dir * dt / dur;
        if (dir > 0 && s.t > s.mode) s.t = s.mode;
        if (dir < 0 && s.t < s.mode) s.t = s.mode;
      }
      var p = smoothstep(s.t);
      s.p = p;

      var i, m;
      for (i = 0; i < s.bumpers.length; i++) {
        m = s.bumpers[i];
        m.body.x = lerp(m.home.x, m.alt.x, p);
        m.body.y = lerp(m.home.y, m.alt.y, p);
        m.body.r = lerp(m.home.r, m.alt.r, p);
      }
      for (i = 0; i < s.deflectors.length; i++) {
        var d = s.deflectors[i];
        d.seg.a.x = lerp(d.mid.x, d.end.ax, p);
        d.seg.a.y = lerp(d.mid.y, d.end.ay, p);
        d.seg.b.x = lerp(d.mid.x, d.end.bx, p);
        d.seg.b.y = lerp(d.mid.y, d.end.by, p);
        d.seg.active = p > 0.04;                // dormant when fully retracted
      }
    },

    // Draw the deployed deflectors as glowing rock-amber bars. (The bumpers are
    // drawn by the bumper renderer from their live, morphed positions.)
    draw: function (ctx, sim, reduced) {
      var s = sim.transform;
      if (!s || s.p <= 0.04) return;
      var t = PB.config.theme;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = t.neonAmber;
      ctx.shadowColor = t.neonAmber;
      ctx.shadowBlur = reduced ? 0 : 16 * s.p;
      ctx.globalAlpha = s.p;
      for (var i = 0; i < s.deflectors.length; i++) {
        var d = s.deflectors[i].seg;
        ctx.beginPath();
        ctx.moveTo(d.a.x, d.a.y);
        ctx.lineTo(d.b.x, d.b.y);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
