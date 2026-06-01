// particles.js - a pooled particle system for sparks and floating score popups.
//
// The pool is allocated once and slots are reused, so steady play produces no
// garbage and no GC spikes. Two particle kinds share the pool: short-lived
// "spark" dots (impact bursts) and "text" popups (rising, fading score numbers).
// This is pure presentation: it never touches the simulation, so it runs on the
// render clock and is skipped entirely under reduced motion where appropriate.

(function (PB) {
  'use strict';

  PB.particles = {
    create: function (max) {
      max = max || 280;
      var pool = new Array(max);
      for (var i = 0; i < max; i++) {
        pool[i] = { alive: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0,
          life: 0, maxLife: 1, size: 1, color: '#fff', text: '' };
      }
      return { pool: pool, max: max, next: 0 };
    },

    // Grab the next free slot (oldest is overwritten if the pool is saturated).
    _alloc: function (sys) {
      var pool = sys.pool, n = sys.max, start = sys.next;
      for (var k = 0; k < n; k++) {
        var idx = (start + k) % n;
        if (!pool[idx].alive) { sys.next = (idx + 1) % n; return pool[idx]; }
      }
      var p = pool[start]; sys.next = (start + 1) % n; return p;
    },

    // A burst of sparks flung outward from a point.
    burst: function (sys, x, y, count, color, speed) {
      speed = speed || 220;
      for (var i = 0; i < count; i++) {
        var p = PB.particles._alloc(sys);
        var ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
        var sp = speed * (0.4 + Math.random() * 0.9);
        p.alive = true; p.kind = 'spark';
        p.x = x; p.y = y;
        p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
        p.life = 0; p.maxLife = 0.4 + Math.random() * 0.4;
        p.size = 1.4 + Math.random() * 1.8;
        p.color = color;
      }
    },

    // A floating score (or label) that rises and fades.
    popup: function (sys, x, y, text, color) {
      var p = PB.particles._alloc(sys);
      p.alive = true; p.kind = 'text';
      p.x = x; p.y = y;
      p.vx = 0; p.vy = -42;
      p.life = 0; p.maxLife = 1.1;
      p.size = 15;
      p.color = color;
      p.text = text;
    },

    update: function (sys, dt) {
      var pool = sys.pool;
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.maxLife) { p.alive = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') {
          p.vy += 520 * dt;            // light gravity on sparks
          p.vx *= (1 - 1.4 * dt);      // air drag
        } else {
          p.vy *= (1 - 0.9 * dt);      // popups ease to a stop as they rise
        }
      }
    },

    draw: function (ctx, sys) {
      var pool = sys.pool;
      ctx.save();
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if (!p.alive) continue;
        var a = 1 - p.life / p.maxLife;
        if (p.kind === 'spark') {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8 * a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10 * a;
          ctx.font = '700 ' + p.size + 'px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        }
      }
      ctx.restore();
    },
  };

})(window.PB = window.PB || {});
