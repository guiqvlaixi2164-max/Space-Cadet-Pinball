// collision.js - swept (continuous) collision of a moving circle against static
// line segments, plus the bounce response. Continuous detection is mandatory:
// the ball is small and fast, so a discrete overlap test would let it tunnel
// straight through thin walls. We instead find the earliest time of impact along
// the ball's path each step and resolve contacts one at a time.

(function (PB) {
  'use strict';

  // Time of impact of a circle (center C, radius r) swept by displacement D
  // against the segment A..B. Returns { t, nx, ny } with t in [0, 1] (fraction
  // of D consumed) and a unit contact normal pointing back toward the ball, or
  // null if no contact happens within this displacement.
  function toiSegment(Cx, Cy, Dx, Dy, Ax, Ay, Bx, By, r) {
    var best = null;

    // Flat side of the segment (treated as an inflated slab of half-width r).
    var ex = Bx - Ax, ey = By - Ay;
    var elen = Math.sqrt(ex * ex + ey * ey);
    if (elen > 1e-9) {
      var ux = ex / elen, uy = ey / elen;     // along the segment
      var nx = -uy, ny = ux;                   // segment normal
      var d0 = (Cx - Ax) * nx + (Cy - Ay) * ny; // signed distance to the line
      var sign = d0 >= 0 ? 1 : -1;
      var Nx = nx * sign, Ny = ny * sign;      // normal on the ball's side
      var gap = Math.abs(d0) - r;              // ball-surface gap to the line
      var approach = -(Dx * Nx + Dy * Ny);     // closing speed toward the line
      if (approach > 1e-9) {
        var t = gap / approach;
        if (t < 0) t = 0;                      // already grazing: resolve now
        if (t <= 1) {
          var ccx = Cx + Dx * t, ccy = Cy + Dy * t;
          var q = (ccx - Ax) * ux + (ccy - Ay) * uy; // projection along segment
          if (q >= 0 && q <= elen) {
            best = { t: t, nx: Nx, ny: Ny };
          }
        }
      }
    }

    // Rounded end caps: sweep the moving point against a circle of radius r at
    // each endpoint (this is how a real capsule cast handles the corners).
    best = capToi(Cx, Cy, Dx, Dy, Ax, Ay, r, best);
    best = capToi(Cx, Cy, Dx, Dy, Bx, By, r, best);
    return best;
  }

  function capToi(Cx, Cy, Dx, Dy, Px, Py, r, best) {
    var fx = Cx - Px, fy = Cy - Py;
    var a = Dx * Dx + Dy * Dy;
    if (a < 1e-12) return best;
    var b = 2 * (fx * Dx + fy * Dy);
    var c = fx * fx + fy * fy - r * r;
    var disc = b * b - 4 * a * c;
    if (disc < 0) return best;
    var sq = Math.sqrt(disc);
    var t1 = (-b - sq) / (2 * a);
    var cand = null;
    if (t1 >= -1e-6 && t1 <= 1) {
      cand = t1 < 0 ? 0 : t1;
    } else if (c < 0) {
      cand = 0; // center already within the cap: resolve immediately
    }
    if (cand === null) return best;
    if (best && best.t <= cand) return best;
    var ccx = Cx + Dx * cand, ccy = Cy + Dy * cand;
    var nx = ccx - Px, ny = ccy - Py;
    var nl = Math.sqrt(nx * nx + ny * ny) || 1;
    return { t: cand, nx: nx / nl, ny: ny / nl };
  }

  // Move one body through the world for this step, resolving every contact along
  // the way. We consume the displacement in fractions: travel to the first hit,
  // reflect the velocity, then continue with the remaining fraction. Bounded
  // iterations guard against pathological geometry.
  PB.collision = {
    toiSegment: toiSegment,

    moveBody: function (world, body, dt) {
      var segs = world.segments;
      var r = body.radius;
      var Vx = body.vel.x, Vy = body.vel.y;
      var remaining = 1.0;
      var iter = 0;

      while (remaining > 1e-5 && iter < world.maxMoveIters) {
        iter++;
        var Dx = Vx * dt * remaining;
        var Dy = Vy * dt * remaining;

        var hit = null, hitSeg = null;
        for (var i = 0; i < segs.length; i++) {
          var s = segs[i];
          var h = toiSegment(body.pos.x, body.pos.y, Dx, Dy,
                             s.a.x, s.a.y, s.b.x, s.b.y, r);
          if (h && (hit === null || h.t < hit.t)) { hit = h; hitSeg = s; }
        }

        if (hit === null) {
          body.pos.x += Dx;
          body.pos.y += Dy;
          break;
        }

        // Advance to the contact point.
        body.pos.x += Dx * hit.t;
        body.pos.y += Dy * hit.t;

        var rest = hitSeg.restitution != null ? hitSeg.restitution : world.restitution;
        var fric = hitSeg.friction != null ? hitSeg.friction : world.friction;

        // Split velocity into normal and tangential parts.
        var vn = Vx * hit.nx + Vy * hit.ny;     // along contact normal
        var tnx = -hit.ny, tny = hit.nx;        // tangent
        var vt = Vx * tnx + Vy * tny;

        var nvn = vn < 0 ? -rest * vn : vn;     // bounce only if moving inward
        if (Math.abs(nvn) < world.restThreshold) nvn = 0; // let it rest
        vt *= (1 - fric);

        Vx = hit.nx * nvn + tnx * vt;
        Vy = hit.ny * nvn + tny * vt;

        // Nudge a hair off the surface so the next pass does not re-hit at t=0.
        body.pos.x += hit.nx * world.skin;
        body.pos.y += hit.ny * world.skin;

        remaining *= (1 - hit.t);
      }

      body.vel.x = Vx;
      body.vel.y = Vy;
    },
  };

})(window.PB = window.PB || {});
