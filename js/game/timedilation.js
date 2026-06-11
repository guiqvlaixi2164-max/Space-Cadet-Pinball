// timedilation.js - Innovation 2: the Time Dilation Zone.
//
// A circular region of the playfield holds a charge meter that fills as the ball
// works the bumpers and slingshots. Once the meter is full, the next time a ball
// rolls into the zone, time dilation activates: that ball integrates in slowed
// sim-time (its per-body dtScale drops) while the rest of the table runs at full
// speed, opening a window for a slow-motion skill shot. The meter drains while
// active and switches off when empty.
//
// All state lives on sim.dilation and is a pure function of the (deterministic)
// charge, ball positions, and zone, so the simulation stays reproducible. The
// charge responds to the same events the scoring layer reads, kept here so the
// physics layer owns the dt scaling end to end.

(function (PB) {
  'use strict';

  function inZone(z, b) {
    var dx = b.pos.x - z.x, dy = b.pos.y - z.y;
    return dx * dx + dy * dy <= z.r * z.r;
  }

  PB.timedilation = {
    inZone: inZone,

    build: function (sim, def) {
      sim.dilation = {
        zone: def.dilation || null,
        charge: 0,         // 0..1 meter
        active: false,     // slow motion currently running
        activeTime: 0,     // seconds the current activation has run
        anyInside: false,  // a ball is inside the zone this step
        ripple: 0,         // visual phase
      };
    },

    reset: function (sim) {
      var d = sim.dilation;
      if (!d) return;
      d.charge = 0; d.active = false; d.activeTime = 0; d.anyInside = false; d.ripple = 0;
    },

    // Smooth slow factor for a ball at squared-distance d2 from the zone centre:
    // 1 (no slowing) at the rim, easing to slowScale toward the interior, so the
    // ball does not jerk at the boundary.
    scaleAt: function (d2, z, cfg) {
      if (d2 >= z.r * z.r) return 1;
      var dist = Math.sqrt(d2);
      var band = z.r * cfg.edgeBand;
      var k = band > 0 ? (z.r - dist) / band : 1;
      k = k < 0 ? 0 : (k > 1 ? 1 : k);
      var s = k * k * (3 - 2 * k);                 // smoothstep
      return 1 + (cfg.slowScale - 1) * s;
    },

    // Before integration: decide activation and stamp each ball's dtScale so the
    // integrator slows the right balls. Pushes a 'dilate' event on the rising
    // edge so the game layer can play a sound and shake the camera.
    preStep: function (sim) {
      var d = sim.dilation;
      if (!d || !d.zone) return;
      var z = d.zone, bodies = sim.world.bodies, cfg = PB.config.dilation, i, b;

      if (!d.active && d.charge >= 1) {
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          if (b.active && inZone(z, b)) {
            d.active = true; d.activeTime = 0; sim.events.push({ type: 'dilate' }); break;
          }
        }
      }

      d.anyInside = false;
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (!d.active || !b.active) { b.dtScale = 1; continue; }
        var dx = b.pos.x - z.x, dy = b.pos.y - z.y, dd2 = dx * dx + dy * dy;
        b.dtScale = PB.timedilation.scaleAt(dd2, z, cfg);
        if (dd2 < z.r * z.r) d.anyInside = true;
      }
    },

    // After integration: charge from this step's events, drain only while a ball
    // is actually inside the active zone, enforce the duration cap, and advance
    // the ripple phase.
    postStep: function (sim, dt) {
      var d = sim.dilation;
      if (!d || !d.zone) return;
      var cfg = PB.config.dilation, ev = sim.events, i, t;

      if (!d.active) {
        for (i = 0; i < ev.length; i++) {
          t = ev[i].type;
          if (t === 'bumper') d.charge += cfg.chargePerBumper;
          else if (t === 'slingshot') d.charge += cfg.chargePerSling;
        }
        if (d.charge > 1) d.charge = 1;
      } else {
        d.activeTime += dt;
        if (d.anyInside) d.charge -= cfg.drainPerSecond * dt;  // only spend it in use
        if (d.charge <= 0 || d.activeTime >= cfg.maxActiveSeconds) {
          d.charge = d.charge < 0 ? 0 : d.charge;
          d.active = false;
          d.activeTime = 0;
        }
      }
      d.ripple += dt * cfg.rippleSpeed;
    },

    // Render the zone: a charged ring whose fill shows the meter, with animated
    // ripples while active. reduced skips the animated rings.
    draw: function (ctx, sim, reduced) {
      var d = sim.dilation;
      if (!d || !d.zone) return;
      var z = d.zone, t = PB.config.theme;
      ctx.save();

      // Base ring (dim when uncharged, bright cyan when armed/active).
      var armed = d.charge >= 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = armed ? t.neonCyan : 'rgba(70,120,170,0.35)';
      ctx.shadowColor = t.neonCyan;
      ctx.shadowBlur = reduced ? 0 : (d.active ? 22 : (armed ? 14 : 0));
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.stroke();

      // Charge arc, drawn from the top clockwise in proportion to the meter.
      if (d.charge > 0 && d.charge < 1) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = t.neonCyan;
        ctx.shadowBlur = reduced ? 0 : 8;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r - 5, -Math.PI / 2, -Math.PI / 2 + d.charge * Math.PI * 2);
        ctx.stroke();
      }

      // Active ripples: a couple of expanding rings driven by the phase.
      if (d.active && !reduced) {
        for (var k = 0; k < 2; k++) {
          var phase = (d.ripple + k * 0.5) % 1;
          ctx.globalAlpha = 0.5 * (1 - phase);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#aef6ff';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.r * (0.2 + phase * 0.85), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Tethered label under the ring so the charge meter reads as belonging to
      // this zone (it is the primary readout now that the edge meter is gone).
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
      if (d.active) { ctx.fillStyle = t.neonCyan; ctx.fillText(PB.strings.dilationLabel, z.x, z.y + z.r + 16); }
      else if (armed) { ctx.fillStyle = t.neonCyan; ctx.fillText(PB.strings.dilationLabel + ' READY', z.x, z.y + z.r + 16); }
      else { ctx.fillStyle = 'rgba(160,190,230,0.55)'; ctx.fillText(PB.strings.dilationLabel, z.x, z.y + z.r + 16); }

      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
