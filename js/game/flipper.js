// flipper.js - a rotating flipper. The flipper is a line segment pinned at a
// pivot that slews between a rest angle and an active angle. Its angular velocity
// (omega) is imparted to the ball on contact, which is what makes a flip feel
// powerful. Collision while the BALL moves is handled by the swept solver in
// collision.js; resolveOverlap handles the other case, where the FLIPPER sweeps
// into a resting ball.

(function (PB) {
  'use strict';

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  PB.Flipper = {
    create: function (spec, opts) {
      opts = opts || {};
      var fl = {
        pivot: { x: spec.pivotX, y: spec.pivotY },
        length: opts.length || PB.config.flippers.length,
        rest: spec.rest,
        active: spec.active,
        angle: spec.rest,
        prevAngle: spec.rest,
        omega: 0,
        pressed: false,
        a: { x: spec.pivotX, y: spec.pivotY },
        b: { x: 0, y: 0 },
        lit: 0,
      };
      PB.Flipper._recompute(fl);
      return fl;
    },

    _recompute: function (fl) {
      // Deterministic trig (PB.dcos/dsin) keeps the flipper geometry, and thus
      // the whole simulation, bit-reproducible across JS engines.
      fl.a.x = fl.pivot.x;
      fl.a.y = fl.pivot.y;
      fl.b.x = fl.pivot.x + fl.length * PB.dcos(fl.angle);
      fl.b.y = fl.pivot.y + fl.length * PB.dsin(fl.angle);
    },

    // Slew the flipper toward its target angle for one fixed step.
    update: function (fl, pressed, dt) {
      fl.pressed = pressed;
      var target = pressed ? fl.active : fl.rest;
      var prev = fl.angle;
      var maxStep = PB.config.flippers.flipSpeed * dt;
      var delta = target - fl.angle;
      if (Math.abs(delta) <= maxStep) fl.angle = target;
      else fl.angle += (delta > 0 ? 1 : -1) * maxStep;
      fl.prevAngle = prev;
      fl.omega = (fl.angle - prev) / dt;
      PB.Flipper._recompute(fl);
    },

    // Catch a ball the flipper swept across this step. A hard flip can rotate the
    // tip by close to a ball diameter per step, so a single overlap test at the
    // final angle can miss the ball entirely (the classic "flipper pass-through").
    // We re-test resolveOverlap at a few intermediate angles between the previous
    // and current angle, then restore the final angle. omega is constant over the
    // step, so the imparted kick is the same at every sub-angle.
    sweepResolve: function (world, fl, ball, substeps) {
      var a0 = fl.prevAngle, a1 = fl.angle;
      if (a0 === a1 || substeps < 2) { PB.Flipper.resolveOverlap(world, fl, ball); return; }
      var saved = fl.angle;
      for (var k = 1; k <= substeps; k++) {
        fl.angle = a0 + (a1 - a0) * (k / substeps);
        PB.Flipper._recompute(fl);
        if (PB.Flipper.resolveOverlap(world, fl, ball)) break; // caught: stop early
      }
      fl.angle = saved;
      PB.Flipper._recompute(fl);
    },

    // Eject a ball that the moving flipper has swept into. Uses the contact-point
    // surface velocity so a rising flipper launches the ball.
    resolveOverlap: function (world, fl, ball) {
      var r = ball.radius;
      var ax = fl.a.x, ay = fl.a.y, bx = fl.b.x, by = fl.b.y;
      var ex = bx - ax, ey = by - ay;
      var L2 = ex * ex + ey * ey;
      var tt = L2 > 0 ? ((ball.pos.x - ax) * ex + (ball.pos.y - ay) * ey) / L2 : 0;
      tt = clamp01(tt);
      var qx = ax + ex * tt, qy = ay + ey * tt;
      var dx = ball.pos.x - qx, dy = ball.pos.y - qy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r + world.skin) return false;

      var nx, ny;
      if (d > 1e-6) { nx = dx / d; ny = dy / d; }
      else { nx = 0; ny = -1; } // degenerate: push up

      var surf = PB.collision.flipperSurfaceVel(fl, qx, qy);
      var rvx = ball.vel.x - surf.x, rvy = ball.vel.y - surf.y;
      var vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        var tnx = -ny, tny = nx;
        var vt = rvx * tnx + rvy * tny;
        var nvn = -PB.config.flippers.restitution * vn;
        vt *= (1 - world.friction);
        rvx = nx * nvn + tnx * vt;
        rvy = ny * nvn + tny * vt;
        ball.vel.x = rvx + surf.x;
        ball.vel.y = rvy + surf.y;
      }
      // Remove the penetration.
      var push = (r + world.skin) - d;
      ball.pos.x += nx * push;
      ball.pos.y += ny * push;

      var s2 = ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y;
      var m = world.maxSpeed;
      if (s2 > m * m) {
        var s = Math.sqrt(s2);
        ball.vel.x = ball.vel.x / s * m;
        ball.vel.y = ball.vel.y / s * m;
      }
      return true;
    },

    draw: function (ctx, fl) {
      var moving = Math.abs(fl.omega) > 2 || fl.pressed;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = PB.config.flippers.thickness;
      ctx.strokeStyle = moving ? PB.config.theme.neonCyan : '#aebbe6';
      ctx.shadowColor = PB.config.theme.neonCyan;
      ctx.shadowBlur = moving ? 18 : 8;
      ctx.beginPath();
      ctx.moveTo(fl.a.x, fl.a.y);
      ctx.lineTo(fl.b.x, fl.b.y);
      ctx.stroke();

      // Pivot hub.
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2a3358';
      ctx.beginPath();
      ctx.arc(fl.pivot.x, fl.pivot.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
