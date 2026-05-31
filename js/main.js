// main.js - entry point, the simulation/event layer (PB.sim), the game-rules
// state machine (PB.Game: balls, ball save, scoring, ranks), the screen state
// machine (attract / play / pause / settings / game over), rendering, and the
// self-test. Phase 3 makes this a complete basic game: start screen to game over,
// persistent high scores, promotions, and working menus.

(function (PB) {
  'use strict';

  var cfg = PB.config;
  var S = PB.strings;

  // ===========================================================================
  // Simulation layer: physics world + table elements. Emits gameplay events;
  // it does NOT keep score or manage lives (that is PB.Game). Deterministic.
  // ===========================================================================

  PB.sim = {
    create: function (tableDef) {
      tableDef = tableDef || PB.TABLES.classic;
      var sim = {
        world: PB.makeWorld(),
        ball: null, bank: null, left: null, right: null,
        spawn: null, lane: null,
        tilt: { bob: 0, tilted: false },
        plunger: PB.Plunger.create(),
        events: [],
        lastLaunch: 0,
      };
      sim.ball = PB.makeBall(tableDef.spawn.x, tableDef.spawn.y, cfg.physics.ballRadius);
      sim.world.bodies.push(sim.ball);
      PB.Table.build(sim, tableDef);
      return sim;
    },

    spawnBall: function (sim) {
      var b = sim.ball;
      b.pos.x = sim.spawn.x; b.pos.y = sim.spawn.y;
      b.prev.x = sim.spawn.x; b.prev.y = sim.spawn.y;
      b.vel.x = 0; b.vel.y = 0;
      b.active = true;
      sim.tilt.tilted = false;
      sim.tilt.bob = 0;
    },

    inLane: function (sim) {
      var b = sim.ball;
      return b.pos.x > cfg.plunger.laneXMin && b.pos.y > cfg.plunger.laneYMin;
    },

    step: function (sim, input, dt) {
      var world = sim.world, ball = sim.ball, tilt = sim.tilt, tc = cfg.tilt;
      sim.events.length = 0;

      if (tilt.bob > 0) { tilt.bob -= tc.bobDecay * dt; if (tilt.bob < 0) tilt.bob = 0; }
      if (!tilt.tilted) {
        if (input.nudgeL) { ball.vel.x -= tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (input.nudgeR) { ball.vel.x += tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (input.nudgeU) { ball.vel.y -= tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (tilt.bob >= tc.tiltAt) tilt.tilted = true;
      }

      var launched = PB.Plunger.update(sim.plunger, ball, !!input.plungerHeld, dt);
      if (launched) sim.lastLaunch = launched;

      PB.Flipper.update(sim.left, !!input.flipperLeft && !tilt.tilted, dt);
      PB.Flipper.update(sim.right, !!input.flipperRight && !tilt.tilted, dt);

      PB.step(world, dt);
      PB.Flipper.resolveOverlap(world, sim.left, ball);
      PB.Flipper.resolveOverlap(world, sim.right, ball);

      var c, i;
      for (i = 0; i < ball.contacts.length; i++) {
        c = ball.contacts[i];
        if (c.circle) {
          PB.Bumper.hit(c.circle);
          sim.events.push({ type: 'bumper', circle: c.circle });
        } else if (c.seg) {
          if (c.seg.kind === 'slingshot') {
            c.seg.lit = cfg.slingshots.litSeconds;
            sim.events.push({ type: 'slingshot', seg: c.seg });
          } else if (c.seg.kind === 'drop') {
            if (PB.Target.drop(c.seg)) {
              sim.events.push({ type: 'drop', seg: c.seg });
              if (PB.Target.allDown(sim.bank)) {
                sim.events.push({ type: 'dropbank' });
                sim.bank.resetTimer = cfg.dropTargets.resetSeconds;
              }
            }
          }
        }
      }

      for (i = 0; i < world.segments.length; i++) {
        if (world.segments[i].lit > 0) {
          world.segments[i].lit -= dt;
          if (world.segments[i].lit < 0) world.segments[i].lit = 0;
        }
      }
      for (i = 0; i < world.circles.length; i++) PB.Bumper.update(world.circles[i], dt);
      PB.Target.update(sim.bank, dt);

      if (ball.active && (ball.pos.y > cfg.physics.drainY ||
          ball.pos.x < -40 || ball.pos.x > cfg.view.width + 40)) {
        ball.active = false;
        sim.events.push({ type: 'drain' });
      }
    },
  };

  // ===========================================================================
  // Game-rules layer: score, multiplier, ranks, ball count, ball save. Pure
  // enough to drive headlessly from the self-test.
  // ===========================================================================

  PB.Game = {
    create: function (settings) {
      return {
        state: 'attract',
        settings: settings,
        scoring: PB.Scoring.create(),
        sim: PB.sim.create(),
        ballsLeft: cfg.game.balls,
        ballNumber: 1,
        ballSaveTimer: 0,
        ballSaveArmed: true,
        message: '', messageTimer: 0,
      };
    },

    start: function (g) {
      g.scoring = PB.Scoring.create();
      g.sim = PB.sim.create();
      g.ballsLeft = cfg.game.balls;
      g.ballNumber = 1;
      g.ballSaveTimer = 0;
      g.ballSaveArmed = true;
      g.message = ''; g.messageTimer = 0;
      PB.sim.spawnBall(g.sim);
      g.state = 'ready';
    },

    setMessage: function (g, msg) {
      g.message = msg;
      g.messageTimer = cfg.game.messageSeconds;
    },

    update: function (g, input, dt) {
      if (g.state !== 'ready' && g.state !== 'playing') return;
      if (g.messageTimer > 0) { g.messageTimer -= dt; if (g.messageTimer < 0) g.messageTimer = 0; }

      PB.sim.step(g.sim, input, dt);

      if (g.state === 'ready' && g.sim.ball.active && !PB.sim.inLane(g.sim)) {
        g.state = 'playing';
        if (g.ballSaveArmed) g.ballSaveTimer = cfg.game.ballSaveSeconds;
      }
      if (g.state === 'playing' && g.ballSaveTimer > 0) {
        g.ballSaveTimer -= dt;
        if (g.ballSaveTimer < 0) g.ballSaveTimer = 0;
      }

      var ev = g.sim.events;
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        if (e.type === 'bumper') PB.Scoring.add(g.scoring, e.circle.score);
        else if (e.type === 'slingshot') PB.Scoring.add(g.scoring, e.seg.score);
        else if (e.type === 'drop') PB.Scoring.add(g.scoring, e.seg.score);
        else if (e.type === 'dropbank') {
          PB.Scoring.addRaw(g.scoring, cfg.score.dropBank);
          PB.Scoring.bumpMultiplier(g.scoring, 1, cfg.game.multiplierCap);
          PB.Game.setMessage(g, S.bankCleared);
        } else if (e.type === 'drain') {
          PB.Game.onDrain(g);
        }
      }

      var promo = PB.Scoring.updateRank(g.scoring);
      if (promo) PB.Game.setMessage(g, S.promoted + promo);
    },

    onDrain: function (g) {
      if (g.state === 'playing' && g.ballSaveTimer > 0) {
        g.ballSaveArmed = false;
        g.ballSaveTimer = 0;
        PB.sim.spawnBall(g.sim);
        g.state = 'ready';
        PB.Game.setMessage(g, S.ballSaved);
        return;
      }
      g.ballsLeft--;
      if (g.ballsLeft > 0) {
        g.ballNumber++;
        g.scoring.multiplier = 1;
        g.ballSaveArmed = true;
        g.ballSaveTimer = 0;
        PB.sim.spawnBall(g.sim);
        g.state = 'ready';
        PB.Game.setMessage(g, S.ballLabel + g.ballNumber);
      } else {
        g.state = 'gameover';
      }
    },
  };

  // ===========================================================================
  // Self-test
  // ===========================================================================

  PB.selfTest = {
    determinism: function () {
      function run() {
        var sim = PB.sim.create();
        var dt = 1 / cfg.sim.hz, out = [];
        for (var i = 0; i < 1600; i++) {
          PB.sim.step(sim, {
            plungerHeld: i < 60,
            flipperLeft: i > 200 && i < 240,
            flipperRight: i > 900 && i < 940,
            nudgeR: i === 300,
          }, dt);
          if (i % 50 === 0) out.push(sim.ball.pos.x.toFixed(6) + ',' + sim.ball.pos.y.toFixed(6));
        }
        return out.join('|');
      }
      return run() === run();
    },

    noTunneling: function () {
      var sim = PB.sim.create(), b = sim.ball;
      b.pos.x = 300; b.pos.y = 420; b.prev.x = 300; b.prev.y = 420;
      b.vel.x = 80000; b.vel.y = 0;
      var dt = 1 / cfg.sim.hz;
      for (var i = 0; i < 6; i++) PB.step(sim.world, dt);
      return b.pos.x > 24 && b.pos.x < 566 && b.pos.y < cfg.physics.drainY;
    },

    flipperKick: function () {
      var sim = PB.sim.create(), b = sim.ball;
      b.pos.x = 235; b.pos.y = 805; b.prev.x = 235; b.prev.y = 805;
      b.vel.x = 0; b.vel.y = 0;
      var dt = 1 / cfg.sim.hz, minVy = 0;
      for (var i = 0; i < 24; i++) {
        PB.sim.step(sim, { flipperLeft: true }, dt);
        if (b.vel.y < minVy) minVy = b.vel.y;
      }
      return minVy < -250;
    },

    scoringRanks: function () {
      var sc = PB.Scoring.create();
      PB.Scoring.addRaw(sc, 25000);
      var p1 = PB.Scoring.updateRank(sc);   // Ensign at 20000
      PB.Scoring.addRaw(sc, 100000);
      var p2 = PB.Scoring.updateRank(sc);   // 125000 -> Captain at 120000
      return p1 === 'Ensign' && p2 === 'Captain' && PB.Scoring.rank(sc).name === 'Captain';
    },

    storage: function () {
      var d = PB.storage.defaults();
      PB.storage.addHighScore(d, 'AAA', 5000, 'Cadet');
      PB.storage.addHighScore(d, 'BBB', 9000, 'Ensign');
      PB.storage.addHighScore(d, 'CCC', 1000, 'Cadet');
      var sorted = d.highScores[0].score === 9000 && d.highScores[2].score === 1000;
      var cap = d.highScores.length === 3;
      var q = PB.storage.qualifies(d, 2000) === true;
      var migrated = PB.storage.migrate({ version: 99 }).version === 1; // garbage -> defaults
      return sorted && cap && q && migrated;
    },

    ballManagement: function () {
      var g = PB.Game.create(PB.storage.defaults().settings);
      PB.Game.start(g);
      var dt = 1 / cfg.sim.hz;
      var empty = { plungerHeld: false, flipperLeft: false, flipperRight: false,
                    nudgeL: false, nudgeR: false, nudgeU: false };
      for (var life = 0; life < cfg.game.balls; life++) {
        g.state = 'playing';
        g.ballSaveArmed = false;
        g.ballSaveTimer = 0;
        g.sim.ball.active = true;
        g.sim.ball.pos.y = 2000;     // force a drain
        PB.Game.update(g, empty, dt);
      }
      return g.state === 'gameover';
    },

    run: function () {
      var r = {
        det: PB.selfTest.determinism(),
        tun: PB.selfTest.noTunneling(),
        kick: PB.selfTest.flipperKick(),
        rank: PB.selfTest.scoringRanks(),
        store: PB.selfTest.storage(),
        balls: PB.selfTest.ballManagement(),
      };
      var ok = r.det && r.tun && r.kick && r.rank && r.store && r.balls;
      var msg = 'SELFTEST det=' + b(r.det) + ' tunnel=' + b(r.tun) +
                ' flipper=' + b(r.kick) + ' ranks=' + b(r.rank) +
                ' store=' + b(r.store) + ' balls=' + b(r.balls);
      function b(v) { return v ? 'OK' : 'FAIL'; }
      try { document.title = msg; } catch (e) {}
      if (window.console) console.log(msg);
      return { ok: ok, msg: msg };
    },
  };

  // ===========================================================================
  // App: input, loop, screen state machine, rendering, menus.
  // ===========================================================================

  var app = {
    canvas: null, ctx: null, input: null, game: null,
    save: null, stars: [], screen: 'attract',
    menuIndex: 0, settingsFrom: 'attract',
    capturing: false, capIdx: -1,
    go: { entering: false, initials: ['A', 'A', 'A'], pos: 0, qualifies: false },
    reduced: false,
  };

  function keyName(code) {
    if (!code) return '?';
    return code
      .replace('Arrow', '').replace('Key', '').replace('Digit', '')
      .replace('Left', ' L').replace('Right', ' R');
  }

  // ---- Starfield ----
  function buildStarfield() {
    var w = cfg.view.width, h = cfg.view.height, stars = [];
    cfg.starfield.layers.forEach(function (layer, li) {
      for (var i = 0; i < layer.count; i++) {
        stars.push({ x: Math.random() * w, y: Math.random() * h,
          r: layer.size * (0.6 + Math.random() * 0.8), speed: layer.speed,
          color: layer.color, layer: li });
      }
    });
    return stars;
  }
  function updateStars(dt) {
    if (app.reduced) return;
    var h = cfg.view.height;
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      s.y += s.speed * dt;
      if (s.y > h + 2) { s.y = -2; s.x = Math.random() * cfg.view.width; }
    }
  }
  function drawBackground(ctx, w, h) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.3, 40, w * 0.5, h * 0.5, h * 0.8);
    g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- Table rendering ----
  function drawTable(ctx, sim) {
    var world = sim.world;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = cfg.theme.wall;
    ctx.shadowColor = 'rgba(88,112,200,0.8)';
    ctx.shadowBlur = app.reduced ? 0 : 10; ctx.lineWidth = 4;
    ctx.beginPath();
    for (var i = 0; i < world.segments.length; i++) {
      var s = world.segments[i];
      if (s.kind !== 'wall') continue;
      ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    ctx.restore();

    var slingColor = app.save.settings.colorblind ? cfg.theme.neonCyan : cfg.theme.neonMagenta;
    for (i = 0; i < world.segments.length; i++) {
      s = world.segments[i];
      if (s.kind === 'slingshot') {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineWidth = 9;
        var lit = s.lit > 0;
        ctx.strokeStyle = lit ? cfg.theme.neonAmber : slingColor;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = app.reduced ? 0 : (lit ? 22 : 10);
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
        ctx.restore();
      } else if (s.kind === 'drop') {
        PB.Target.draw(ctx, s);
      }
    }

    for (i = 0; i < world.circles.length; i++) PB.Bumper.draw(ctx, world.circles[i]);
    PB.Flipper.draw(ctx, sim.left);
    PB.Flipper.draw(ctx, sim.right);
    PB.Plunger.draw(ctx, sim.plunger, sim.lane.x, sim.lane.w);
    if (sim.ball.active) PB.Ball.draw(ctx, sim.ball, app._alpha || 0);
  }

  // ---- Screen input handlers ----
  function handleAttract(e) {
    if (e.enter) { PB.Game.start(app.game); app.screen = 'play'; }
    else if (e.escape) { app.screen = 'settings'; app.settingsFrom = 'attract'; app.menuIndex = 0; }
  }

  function handlePlay(e, dt) {
    if (e.pause || e.escape) { app.screen = 'pause'; app.menuIndex = 0; return; }
    PB.Game.update(app.game, {
      plungerHeld: app.input.plungerHeld,
      flipperLeft: app.input.flipperLeft,
      flipperRight: app.input.flipperRight,
      nudgeL: e.left, nudgeR: e.right, nudgeU: e.up,
    }, dt);
    if (app.game.state === 'gameover') enterGameOver();
  }

  var PAUSE_ITEMS = 3;
  function handlePause(e) {
    if (e.escape || e.pause) { app.screen = 'play'; return; }
    if (e.up) app.menuIndex = (app.menuIndex + PAUSE_ITEMS - 1) % PAUSE_ITEMS;
    if (e.down) app.menuIndex = (app.menuIndex + 1) % PAUSE_ITEMS;
    if (e.enter) {
      if (app.menuIndex === 0) app.screen = 'play';
      else if (app.menuIndex === 1) { app.screen = 'settings'; app.settingsFrom = 'pause'; app.menuIndex = 0; }
      else { app.screen = 'attract'; }
    }
  }

  var SETTINGS_ITEMS = 8; // volume, mute, reducedMotion, colorblind, L, R, plunger, back
  function handleSettings(e) {
    if (app.capturing) return; // waiting for a key; ignore navigation
    var st = app.save.settings;
    if (e.escape) { backFromSettings(); return; }
    if (e.up) app.menuIndex = (app.menuIndex + SETTINGS_ITEMS - 1) % SETTINGS_ITEMS;
    if (e.down) app.menuIndex = (app.menuIndex + 1) % SETTINGS_ITEMS;

    var i = app.menuIndex;
    if (e.left || e.right) {
      var dir = e.right ? 1 : -1;
      if (i === 0) { st.volume = Math.max(0, Math.min(1, st.volume + dir * 0.1)); }
      else if (i === 1) st.muted = !st.muted;
      else if (i === 2) { st.reducedMotion = !st.reducedMotion; app.reduced = st.reducedMotion; }
      else if (i === 3) st.colorblind = !st.colorblind;
      PB.storage.save(app.save);
    }
    if (e.enter) {
      if (i >= 4 && i <= 6) startRebind(i);
      else if (i === 1) { st.muted = !st.muted; PB.storage.save(app.save); }
      else if (i === 2) { st.reducedMotion = !st.reducedMotion; app.reduced = st.reducedMotion; PB.storage.save(app.save); }
      else if (i === 3) { st.colorblind = !st.colorblind; PB.storage.save(app.save); }
      else if (i === 7) backFromSettings();
    }
  }

  function startRebind(i) {
    app.capturing = true; app.capIdx = i;
    var field = i === 4 ? 'flipperLeft' : (i === 5 ? 'flipperRight' : 'plunger');
    app.input.captureKey(function (code) {
      if (code) { // null means the rebind was cancelled with Escape
        app.save.settings.keymap[field] = code;
        app.input.setKeymap(app.save.settings.keymap);
        PB.storage.save(app.save);
      }
      app.capturing = false; app.capIdx = -1;
    });
  }

  function backFromSettings() {
    app.screen = app.settingsFrom === 'pause' ? 'pause' : 'attract';
    app.menuIndex = 0;
  }

  function enterGameOver() {
    app.screen = 'gameover';
    var q = PB.storage.qualifies(app.save, app.game.scoring.score) && app.game.scoring.score > 0;
    app.go = { entering: q, initials: ['A', 'A', 'A'], pos: 0, qualifies: q };
  }

  function handleGameOver(e) {
    if (app.go.entering) {
      var ini = app.go.initials;
      if (e.left) app.go.pos = (app.go.pos + 2) % 3;
      if (e.right) app.go.pos = (app.go.pos + 1) % 3;
      if (e.up || e.down) {
        var c = ini[app.go.pos].charCodeAt(0);
        c += e.up ? 1 : -1;
        if (c > 90) c = 65; if (c < 65) c = 90;
        ini[app.go.pos] = String.fromCharCode(c);
      }
      if (e.enter) {
        PB.storage.addHighScore(app.save, ini.join(''), app.game.scoring.score,
                                PB.Scoring.rank(app.game.scoring).name);
        app.go.entering = false;
      }
    } else if (e.enter) {
      app.screen = 'attract';
    }
  }

  // ---- Loop ----
  function update(dt) {
    updateStars(dt);
    var e = app.input.consume();
    switch (app.screen) {
      case 'attract': handleAttract(e); break;
      case 'play': handlePlay(e, dt); break;
      case 'pause': handlePause(e); break;
      case 'settings': handleSettings(e); break;
      case 'gameover': handleGameOver(e); break;
    }
  }

  function blinkOn() { return Math.floor(performance.now() / 450) % 2 === 0; }

  function settingsLines() {
    var st = app.save.settings;
    function val(i, txt) { return (app.capturing && app.capIdx === i) ? S.pressAKey : txt; }
    return [
      S.volume + ':  ' + Math.round(st.volume * 100) + '%',
      S.mute + ':  ' + (st.muted ? S.on : S.off),
      S.reducedMotion + ':  ' + (st.reducedMotion ? S.on : S.off),
      S.colorblind + ':  ' + (st.colorblind ? S.on : S.off),
      S.rebindLeft + ':  ' + val(4, keyName(st.keymap.flipperLeft)),
      S.rebindRight + ':  ' + val(5, keyName(st.keymap.flipperRight)),
      S.rebindPlunger + ':  ' + val(6, keyName(st.keymap.plunger)),
      S.back,
    ];
  }

  function render(alpha) {
    var ctx = app.ctx, w = cfg.view.width, h = cfg.view.height;
    app._alpha = alpha;
    drawBackground(ctx, w, h);

    switch (app.screen) {
      case 'attract':
        PB.Menus.drawAttract(ctx, app.save, blinkOn());
        break;
      case 'play':
        drawTable(ctx, app.game.sim);
        PB.Hud.draw(ctx, app.game);
        break;
      case 'pause':
        drawTable(ctx, app.game.sim);
        PB.Menus.drawMenu(ctx, S.paused,
          [S.resume, S.settings, S.quitToTitle], app.menuIndex, S.pauseFooter);
        break;
      case 'settings':
        if (app.settingsFrom === 'pause' && app.game) drawTable(ctx, app.game.sim);
        PB.Menus.drawMenu(ctx, S.settingsTitle, settingsLines(), app.menuIndex, S.settingsFooter);
        break;
      case 'gameover':
        if (app.game) drawTable(ctx, app.game.sim);
        PB.Menus.drawGameOver(ctx, {
          score: app.game.scoring.score,
          rankName: PB.Scoring.rank(app.game.scoring).name,
          entering: app.go.entering,
          initials: app.go.initials,
          pos: app.go.pos,
          highScores: app.save.highScores,
          blinkOn: blinkOn(),
        });
        break;
    }
  }

  // ---- Boot ----
  function init() {
    app.canvas = document.getElementById('game');
    if (!app.canvas) { console.error('Canvas #game not found.'); return; }
    app.ctx = app.canvas.getContext('2d');
    app.stars = buildStarfield();

    if (/(?:^|[?&])selftest/.test(location.search)) {
      app.save = PB.storage.defaults();
      app.game = PB.Game.create(app.save.settings);
      var res = PB.selfTest.run();
      drawBackground(app.ctx, cfg.view.width, cfg.view.height);
      app.ctx.fillStyle = res.ok ? cfg.theme.neonGreen : cfg.theme.neonRed;
      app.ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
      app.ctx.textAlign = 'center';
      app.ctx.fillText(res.msg, cfg.view.width / 2, cfg.view.height / 2);
      return;
    }

    app.save = PB.storage.load();
    app.reduced = !!app.save.settings.reducedMotion;
    app.game = PB.Game.create(app.save.settings);
    app.input = PB.input.create(app.save.settings.keymap);

    var loop = PB.loop.create({
      hz: cfg.sim.hz, maxSubSteps: cfg.sim.maxSubSteps,
      update: update, render: render,
    });
    loop.start();
    PB.app = app;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.PB = window.PB || {});
