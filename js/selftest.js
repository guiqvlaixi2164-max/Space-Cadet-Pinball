// selftest.js - the headless self-test suite for the simulation and game-rules
// layers. Extracted from main.js so test code lives on its own (and so main.js
// stays closer to a single responsibility). Run it in a browser via
// index.html?selftest, or in CI via tools/selftest-node.js. All functions read
// PB.* at call time, so this file can load before main.js (which defines PB.sim
// and PB.Game); by the time run() is invoked, everything exists.

(function (PB) {
  'use strict';

  var cfg = PB.config;

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
      var migrated = PB.storage.migrate({ version: 99 }).version === 1 + 1; // newer save -> defaults (v2)
      return sorted && cap && q && migrated;
    },

    // A versioned save upgrades in place, preserving the player's scores and
    // settings while backfilling new bindings (no data loss on schema bumps).
    migration: function () {
      var old = { version: 1,
        highScores: [{ name: 'ZZ', score: 12345, rank: 'Cadet' }],
        settings: { volume: 0.3, keymap: { flipperLeft: 'KeyA' } } };
      var up = PB.storage.migrate(old);
      return up.version === 2 &&
             up.highScores.length === 1 && up.highScores[0].score === 12345 &&
             up.settings.volume === 0.3 &&
             up.settings.keymap.flipperLeft === 'KeyA' &&     // custom bind kept
             up.settings.keymap.nudgeLeft === 'ArrowLeft' &&  // new bind backfilled
             up.settings.keymap.pause === 'KeyP';
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

    missions: function () {
      var g = PB.Game.create(PB.storage.defaults().settings);
      PB.Game.start(g);
      var m = g.missions;

      // Select Warp Survey, start it, then satisfy the bumper objective.
      PB.Missions.onEvent(g, { type: 'standup', seg: { role: 'select', id: 0 } });
      var sel = m.state === 'selected' && m.selected === 0;
      PB.Missions.onEvent(g, { type: 'standup', seg: { role: 'start', id: 3 } });
      var act = m.state === 'active' && m.active === 0;
      var before = g.scoring.score;
      for (var i = 0; i < cfg.missions.warp.need; i++) {
        PB.Missions.onEvent(g, { type: 'bumper' });
      }
      var done = m.state === 'idle' &&
                 g.scoring.score >= before + cfg.missions.warp.jackpot;

      // Start Rescue, then let the timer run out to verify the fail path.
      PB.Missions.onEvent(g, { type: 'standup', seg: { role: 'select', id: 2 } });
      PB.Missions.onEvent(g, { type: 'standup', seg: { role: 'start', id: 3 } });
      PB.Missions.tick(g, cfg.missions.rescue.time + 1);
      var failed = m.state === 'idle';

      return sel && act && done && failed;
    },

    multiball: function () {
      var g = PB.Game.create(PB.storage.defaults().settings);
      PB.Game.start(g);
      var empty = { plungerHeld: false, flipperLeft: false, flipperRight: false,
                    nudgeL: false, nudgeR: false, nudgeU: false };
      var expect = 1 + cfg.missions.mbSpawns.length;

      for (var i = 0; i < cfg.missions.lockNeed; i++) {
        PB.Missions.onEvent(g, { type: 'standup', seg: { role: 'lock', id: 4 } });
      }
      var spawned = g.missions.multiball && g.sim.world.bodies.length === expect;

      // Force the extra balls (not the primary) off the table. They should drain
      // as ball losses with no life lost, ending multiball.
      var ballsBefore = g.ballsLeft;
      var bodies = g.sim.world.bodies;
      for (var j = bodies.length - 1; j >= 1; j--) {
        bodies[j].pos.x = 300; bodies[j].pos.y = 5000;
        bodies[j].prev.x = 300; bodies[j].prev.y = 5000;
        bodies[j].vel.x = 0; bodies[j].vel.y = 0;
      }
      g.state = 'playing';
      PB.Game.update(g, empty, 1 / cfg.sim.hz);
      var ended = g.sim.world.bodies.length === 1 &&
                  g.ballsLeft === ballsBefore && !g.missions.multiball;

      return spawned && ended;
    },

    // Two overlapping balls moving toward each other must separate and stop
    // approaching after a step (multiball ball-to-ball collision).
    ballPairs: function () {
      var sim = PB.sim.create(), dt = 1 / cfg.sim.hz;
      var a = sim.ball;
      a.pos.x = 200; a.pos.y = 400; a.prev.x = 200; a.prev.y = 400; a.vel.x = 120; a.vel.y = 0;
      var b = PB.sim.addBall(sim, 210, 400, -120, 0);   // 10px apart, overlapping
      PB.sim.step(sim, {}, dt);
      var dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var separated = dist >= (a.radius + b.radius) - 0.5;
      var apart = (b.vel.x - a.vel.x) >= 0;             // no longer approaching
      return separated && apart;
    },

    // Innovation 2: a primed ball entering the zone activates slow motion (its
    // dtScale drops) and moves much less in a step than it otherwise would.
    dilation: function () {
      var sim = PB.sim.create(), dt = 1 / cfg.sim.hz, z = sim.dilation.zone, dc = cfg.dilation;
      // Boundary easing: ~1 at the rim, slowScale at the centre, monotonic in
      // between (so the ball does not pop at the edge).
      var sRim = PB.timedilation.scaleAt(z.r * z.r * 0.999, z, dc);
      var sMid = PB.timedilation.scaleAt(z.r * z.r * 0.81, z, dc);   // within the band
      var sCen = PB.timedilation.scaleAt(0, z, dc);
      var eased = sRim > sMid && sMid > sCen && sRim <= 1.0001 &&
                  Math.abs(sCen - dc.slowScale) < 1e-9;
      // Activation and slowing for a ball at the centre.
      sim.dilation.charge = 1;
      var b = sim.ball;
      b.pos.x = z.x; b.pos.y = z.y; b.prev.x = z.x; b.prev.y = z.y;
      b.vel.x = 0; b.vel.y = 300;
      PB.sim.step(sim, {}, dt);
      var active = sim.dilation.active === true;
      var scaled = Math.abs(b.dtScale - dc.slowScale) < 1e-9;
      var slowed = (b.pos.y - z.y) < 300 * dt * 0.6;   // vs ~300*dt undilated
      return eased && active && scaled && slowed;
    },

    // Innovation 1: toggling the table morphs bumper 0 to its Asteroid position
    // and deploys a deflector, and toggling back restores Station exactly.
    transform: function () {
      var sim = PB.sim.create(), dt = 1 / cfg.sim.hz, empty = {};
      var m = sim.transform.bumpers[0], d0 = sim.transform.deflectors[0];
      var steps = Math.ceil(cfg.transform.duration / dt) + 20, i;
      PB.transform.toggle(sim);
      for (i = 0; i < steps; i++) PB.sim.step(sim, empty, dt);
      var atAlt = Math.abs(m.body.x - m.alt.x) < 0.5 && d0.seg.active === true;
      PB.transform.toggle(sim);
      for (i = 0; i < steps; i++) PB.sim.step(sim, empty, dt);
      var atHome = Math.abs(m.body.x - m.home.x) < 0.5 && d0.seg.active === false;
      return atAlt && atHome;
    },

    // A compact hash of a canned 2000-step run. Because the simulation now uses
    // only IEEE-deterministic operations (PB.dsin/dcos instead of Math.sin/cos),
    // this signature should be identical on every conformant engine; compare it
    // across browsers/Node to verify cross-machine reproducibility.
    signature: function () {
      var sim = PB.sim.create(), dt = 1 / cfg.sim.hz, h = 0;
      for (var i = 0; i < 2000; i++) {
        PB.sim.step(sim, {
          plungerHeld: i < 60, flipperLeft: i > 200 && i < 240,
          flipperRight: i > 900 && i < 940, nudgeR: i === 300,
        }, dt);
        h = (h * 31 + Math.round(sim.ball.pos.x * 1000)) | 0;
        h = (h * 31 + Math.round(sim.ball.pos.y * 1000)) | 0;
      }
      return (h >>> 0).toString(16);
    },

    run: function () {
      var r = {
        det: PB.selfTest.determinism(),
        tun: PB.selfTest.noTunneling(),
        kick: PB.selfTest.flipperKick(),
        rank: PB.selfTest.scoringRanks(),
        store: PB.selfTest.storage(),
        balls: PB.selfTest.ballManagement(),
        miss: PB.selfTest.missions(),
        multi: PB.selfTest.multiball(),
        dil: PB.selfTest.dilation(),
        trans: PB.selfTest.transform(),
        pairs: PB.selfTest.ballPairs(),
        mig: PB.selfTest.migration(),
      };
      var ok = r.det && r.tun && r.kick && r.rank && r.store && r.balls &&
               r.miss && r.multi && r.dil && r.trans && r.pairs && r.mig;
      var msg = 'SELFTEST det=' + b(r.det) + ' tunnel=' + b(r.tun) +
                ' flipper=' + b(r.kick) + ' ranks=' + b(r.rank) +
                ' store=' + b(r.store) + ' balls=' + b(r.balls) +
                ' missions=' + b(r.miss) + ' multiball=' + b(r.multi) +
                ' dilation=' + b(r.dil) + ' transform=' + b(r.trans) +
                ' pairs=' + b(r.pairs) + ' migration=' + b(r.mig);
      function b(v) { return v ? 'OK' : 'FAIL'; }
      try { document.title = msg; } catch (e) {}
      if (window.console) {
        console.log(msg);
        console.log('SIGNATURE ' + PB.selfTest.signature());
      }
      return { ok: ok, msg: msg };
    },
  };

})(window.PB = window.PB || {});
