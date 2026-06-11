// collision.js - swept (continuous) collision of a moving circle against static
// line segments, rotating flipper segments, and circular bumpers, plus the
// bounce response. Continuous detection is mandatory: the ball is small and
// fast, so a discrete overlap test would let it tunnel through thin walls. We
// find the earliest time of impact along the ball's path each step and resolve
// contacts one at a time. Moving surfaces (flippers) contribute their surface
// velocity to the response, which is what gives flippers their kick.

(function (PB) {
  'use strict';

  // Time of impact of a circle (center C, radius r) swept by displacement D
  // against the segment A..B. Returns { t, nx, ny } (t in [0,1], unit normal
  // pointing back toward the ball) or null.
  function toiSegment(Cx, Cy, Dx, Dy, Ax, Ay, Bx, By, r) {
    var best = null;
    var ex = Bx - Ax, ey = By - Ay;
    var elen = Math.sqrt(ex * ex + ey * ey);
    if (elen > 1e-9) {
      var ux = ex / elen, uy = ey / elen;
      var nx = -uy, ny = ux;
      var d0 = (Cx - Ax) * nx + (Cy - Ay) * ny;
      var sign = d0 >= 0 ? 1 : -1;
      var Nx = nx * sign, Ny = ny * sign;
      var gap = Math.abs(d0) - r;
      var approach = -(Dx * Nx + Dy * Ny);
      if (approach > 1e-9) {
        var t = gap / approach;
        if (t < 0) t = 0;
        if (t <= 1) {
          var ccx = Cx + Dx * t, ccy = Cy + Dy * t;
          var q = (ccx - Ax) * ux + (ccy - Ay) * uy;
          if (q >= 0 && q <= elen) best = { t: t, nx: Nx, ny: Ny };
        }
      }
    }
    best = capToi(Cx, Cy, Dx, Dy, Ax, Ay, r, best);
    best = capToi(Cx, Cy, Dx, Dy, Bx, By, r, best);
    return best;
  }

  // Sweep the moving point against a circle of radius r centered at P. Used for
  // segment end caps and (with r = ballR + bumperR) for circular bumpers.
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
    if (t1 >= -1e-6 && t1 <= 1) cand = t1 < 0 ? 0 : t1;
    else if (c < 0) cand = 0;
    if (cand === null) return best;
    if (best && best.t <= cand) return best;
    var ccx = Cx + Dx * cand, ccy = Cy + Dy * cand;
    var nx = ccx - Px, ny = ccy - Py;
    var nl = Math.sqrt(nx * nx + ny * ny) || 1;
    return { t: cand, nx: nx / nl, ny: ny / nl };
  }

  // Surface velocity of a rotating flipper at world point (px, py).
  function flipperSurfaceVel(fl, px, py) {
    var rx = px - fl.pivot.x, ry = py - fl.pivot.y;
    return { x: -fl.omega * ry, y: fl.omega * rx };
  }

  function clampSpeed(body, maxSpeed) {
    var s2 = body.vel.x * body.vel.x + body.vel.y * body.vel.y;
    if (s2 > maxSpeed * maxSpeed) {
      var s = Math.sqrt(s2);
      body.vel.x = body.vel.x / s * maxSpeed;
      body.vel.y = body.vel.y / s * maxSpeed;
    }
  }

  PB.collision = {
    toiSegment: toiSegment,
    capToi: capToi,
    flipperSurfaceVel: flipperSurfaceVel,

    moveBody: function (world, body, dt) {
      var r = body.radius;
      var Vx = body.vel.x, Vy = body.vel.y;
      var remaining = 1.0;
      var iter = 0;
      body.contacts = [];

      while (remaining > 1e-5 && iter < world.maxMoveIters) {
        iter++;
        var Dx = Vx * dt * remaining;
        var Dy = Vy * dt * remaining;

        var hit = null, hitSeg = null, hitFlip = null, hitCircle = null;
        var i, h, s;

        var segs = world.segments;
        for (i = 0; i < segs.length; i++) {
          s = segs[i];
          if (s.active === false) continue;
          h = toiSegment(body.pos.x, body.pos.y, Dx, Dy, s.a.x, s.a.y, s.b.x, s.b.y, r);
          if (h && (hit === null || h.t < hit.t)) { hit = h; hitSeg = s; hitFlip = null; hitCircle = null; }
        }

        var flips = world.flippers;
        for (i = 0; i < flips.length; i++) {
          var f = flips[i];
          h = toiSegment(body.pos.x, body.pos.y, Dx, Dy, f.a.x, f.a.y, f.b.x, f.b.y, r);
          if (h && (hit === null || h.t < hit.t)) { hit = h; hitSeg = null; hitFlip = f; hitCircle = null; }
        }

        var circles = world.circles;
        for (i = 0; i < circles.length; i++) {
          var cc = circles[i];
          if (cc.active === false) continue;
          h = capToi(body.pos.x, body.pos.y, Dx, Dy, cc.x, cc.y, r + cc.r, null);
          if (h && (hit === null || h.t < hit.t)) { hit = h; hitSeg = null; hitFlip = null; hitCircle = cc; }
        }

        if (hit === null) {
          body.pos.x += Dx;
          body.pos.y += Dy;
          break;
        }

        body.pos.x += Dx * hit.t;
        body.pos.y += Dy * hit.t;

        // Material and surface motion of whatever we hit.
        var rest, fric = world.friction, kick = 0, surfx = 0, surfy = 0;
        var px = body.pos.x - hit.nx * r;   // contact point on the surface
        var py = body.pos.y - hit.ny * r;

        if (hitFlip) {
          rest = PB.config.flippers.restitution;
          var sv = flipperSurfaceVel(hitFlip, px, py);
          surfx = sv.x; surfy = sv.y;
        } else if (hitCircle) {
          rest = hitCircle.restitution != null ? hitCircle.restitution : world.restitution;
          kick = hitCircle.kick || 0;
        } else {
          rest = hitSeg.restitution != null ? hitSeg.restitution : world.restitution;
          if (hitSeg.friction != null) fric = hitSeg.friction;
          kick = hitSeg.kick || 0;
        }

        // Reflect in the surface's reference frame so flipper motion transfers.
        var rvx = Vx - surfx, rvy = Vy - surfy;
        var vn = rvx * hit.nx + rvy * hit.ny;
        var tnx = -hit.ny, tny = hit.nx;
        var vt = rvx * tnx + rvy * tny;

        var nvn = vn < 0 ? -rest * vn : vn;
        var slow = Math.abs(nvn) < world.restThreshold;
        var flipperMoving = hitFlip && Math.abs(hitFlip.omega) > 2;
        if (slow && !flipperMoving) nvn = 0;
        vt *= (1 - fric);

        // Pop bumpers kick harder the faster the ball arrives, so a busy bumper
        // nest escalates instead of feeling uniform. Deterministic (a pure
        // function of the approach speed vn). Bumpers only; walls/slingshots keep
        // their fixed kick.
        if (hitCircle && kick > 0) {
          var bc = PB.config.bumpers;
          var approach = vn < 0 ? -vn : 0;
          kick += approach * bc.kickSpeedFactor;
          if (kick > bc.kickMax) kick = bc.kickMax;
        }

        rvx = hit.nx * nvn + tnx * vt;
        rvy = hit.ny * nvn + tny * vt;
        Vx = rvx + surfx + hit.nx * kick;
        Vy = rvy + surfy + hit.ny * kick;

        body.contacts.push({
          seg: hitSeg, flip: hitFlip, circle: hitCircle,
          x: px, y: py, speed: -vn,
        });

        body.pos.x += hit.nx * world.skin;
        body.pos.y += hit.ny * world.skin;
        remaining *= (1 - hit.t);
      }

      body.vel.x = Vx;
      body.vel.y = Vy;
      clampSpeed(body, world.maxSpeed);
    },
  };

})(window.PB = window.PB || {});
