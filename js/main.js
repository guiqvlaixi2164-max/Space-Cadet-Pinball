// main.js - entry point, top-level state machine, and the render bootstrap.
// Phase 0 scope: prove the pipeline by rendering a parallax starfield and the
// "Hello, Cadet" title with zero console errors, offline, opened via file://.
// The real game loop (fixed-timestep simulation) arrives in Phase 1.

(function (PB) {
  'use strict';

  var cfg = PB.config;
  var strings = PB.strings;

  // Top-level application states. Expanded in later phases (PLAY, PAUSE, etc.).
  var STATE = {
    BOOT: 'BOOT',
    ATTRACT: 'ATTRACT',
  };

  var app = {
    canvas: null,
    ctx: null,
    state: STATE.BOOT,
    stars: [],
    lastTs: 0,
    started: false,
  };

  function buildStarfield() {
    var w = cfg.view.width;
    var h = cfg.view.height;
    var stars = [];
    cfg.starfield.layers.forEach(function (layer, layerIndex) {
      for (var i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer.size * (0.6 + Math.random() * 0.8),
          speed: layer.speed,
          color: layer.color,
          twinkle: Math.random() * Math.PI * 2,
          layer: layerIndex,
        });
      }
    });
    return stars;
  }

  function update(dt) {
    var h = cfg.view.height;
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      s.y += s.speed * dt;
      if (s.y > h + 2) {
        s.y = -2;
        s.x = Math.random() * cfg.view.width;
      }
      s.twinkle += dt * (1.5 + s.layer);
    }
  }

  function drawBackground(ctx, w, h) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.32, 40, w * 0.5, h * 0.5, h * 0.75);
    g.addColorStop(0, '#0b1026');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars(ctx) {
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      var alphaPulse = 0.65 + 0.35 * Math.sin(s.twinkle);
      ctx.globalAlpha = alphaPulse;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle(ctx, w, h) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Neon title with glow.
    ctx.shadowColor = cfg.theme.neonCyan;
    ctx.shadowBlur = 24;
    ctx.fillStyle = cfg.theme.neonCyan;
    ctx.font = '700 64px "Segoe UI", Arial, sans-serif';
    ctx.fillText(strings.title, w / 2, h * 0.40);

    ctx.shadowColor = cfg.theme.neonMagenta;
    ctx.shadowBlur = 18;
    ctx.fillStyle = cfg.theme.neonMagenta;
    ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText(strings.subtitle.toUpperCase(), w / 2, h * 0.40 + 50);

    // Hello, Cadet (the Phase 0 proof-of-pipeline line).
    ctx.shadowBlur = 0;
    ctx.fillStyle = cfg.theme.text;
    ctx.font = '400 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(strings.hello, w / 2, h * 0.58);

    // Blinking prompt.
    var blink = 0.5 + 0.5 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillStyle = cfg.theme.neonAmber;
    ctx.font = '500 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(strings.pressToStart, w / 2, h * 0.66);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function render() {
    var ctx = app.ctx;
    var w = cfg.view.width;
    var h = cfg.view.height;
    drawBackground(ctx, w, h);
    drawStars(ctx);
    drawTitle(ctx, w, h);
  }

  function frame(ts) {
    if (!app.lastTs) app.lastTs = ts;
    var dt = (ts - app.lastTs) / 1000;
    app.lastTs = ts;
    // Clamp dt so a backgrounded tab does not jump the starfield.
    if (dt > 0.1) dt = 0.1;

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function init() {
    app.canvas = document.getElementById('game');
    if (!app.canvas) {
      console.error('Canvas #game not found.');
      return;
    }
    app.ctx = app.canvas.getContext('2d');
    app.stars = buildStarfield();
    app.state = STATE.ATTRACT;
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging and later phases.
  PB.app = app;
  PB.STATE = STATE;

})(window.PB = window.PB || {});
