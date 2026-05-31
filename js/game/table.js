// table.js - builds a live simulation from a table data object (js/tables/*.js).
// It populates the physics world (walls, slingshots, drop targets, bumpers,
// flippers) and records references the game and renderer need.

(function (PB) {
  'use strict';

  PB.Table = {
    build: function (sim, def) {
      var cfg = PB.config;
      var world = sim.world;
      var S = PB.makeSegment;
      var i;

      // Walls.
      for (i = 0; i < def.walls.length; i++) {
        var w = def.walls[i];
        world.segments.push(S(w[0], w[1], w[2], w[3]));
      }

      // Curved guides.
      if (def.arcs) {
        for (i = 0; i < def.arcs.length; i++) {
          var a = def.arcs[i];
          var segs = PB.Ramp.arc(a.cx, a.cy, a.r, a.a0, a.a1, a.steps);
          for (var j = 0; j < segs.length; j++) world.segments.push(segs[j]);
        }
      }

      // Slingshots.
      var slOpts = {
        kind: 'slingshot',
        restitution: cfg.slingshots.restitution,
        kick: cfg.slingshots.kick,
        score: cfg.score.slingshot,
      };
      for (i = 0; i < def.slingshots.length; i++) {
        var p = def.slingshots[i];
        world.segments.push(S(p[0], p[1], p[2], p[3], slOpts));
      }

      // Drop-target bank.
      sim.bank = PB.Target.createBank(def.dropTargets);
      for (i = 0; i < sim.bank.targets.length; i++) world.segments.push(sim.bank.targets[i]);

      // Flippers.
      sim.left = PB.Flipper.create(def.flippers.left);
      sim.right = PB.Flipper.create(def.flippers.right);
      world.flippers.push(sim.left, sim.right);

      // Pop bumpers.
      for (i = 0; i < def.bumpers.length; i++) world.circles.push(PB.Bumper.create(def.bumpers[i]));

      sim.spawn = def.spawn;
      sim.lane = def.lane;
      sim.tableName = def.name;
    },
  };

})(window.PB = window.PB || {});
