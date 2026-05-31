// missions.js - the mission state machine and the multiball lock sequence.
//
// Selection: the three "select" standup targets choose one of three missions
// while idle. Start: hitting the "start" gate begins the selected mission and
// its objective timer. Objectives complete for a jackpot or time out and fail.
//
// Three v1 missions (objectives reuse existing table elements where possible):
//   Warp Survey  - hit the pop bumpers a set number of times before the timer.
//   Target Lock  - clear the drop-target bank before the timer.
//   Rescue       - hit the lit rescue target a set number of times before time.
//
// Multiball is independent of missions: the "lock" standup banks balls; the
// final lock starts a basic 3-ball multiball by adding two more balls.
//
// State lives on g.missions; this module mutates the game (g) through PB.Game,
// PB.Scoring, and PB.sim so it stays the single owner of mission rules.

(function (PB) {
  'use strict';

  var cfg = PB.config;

  // Group with commas, locale-independent (no toLocaleString, for determinism).
  function commas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  PB.Missions = {
    // Built fresh from config + strings so tuning stays in one place.
    defs: function () {
      var mc = cfg.missions, s = PB.strings;
      return [
        { id: 0, name: s.mWarp,   objective: 'bumpers', need: mc.warp.need,   time: mc.warp.time,   jackpot: mc.warp.jackpot },
        { id: 1, name: s.mTarget, objective: 'bank',    need: mc.bank.need,   time: mc.bank.time,   jackpot: mc.bank.jackpot },
        { id: 2, name: s.mRescue, objective: 'rescue',  need: mc.rescue.need, time: mc.rescue.time, jackpot: mc.rescue.jackpot },
      ];
    },

    create: function () {
      return {
        state: 'idle',     // idle | selected | active
        selected: -1,      // index armed but not yet started
        active: -1,        // index of the running mission
        timer: 0,          // seconds remaining on the active mission
        progress: 0,       // objective progress
        need: 0,           // objective target
        lock: 0,           // multiball lock progress
        multiball: false,  // multiball in progress
      };
    },

    // Route a single simulation event into the mission/multiball logic.
    onEvent: function (g, e) {
      var m = g.missions, defs = PB.Missions.defs();

      if (e.type === 'standup') {
        var role = e.seg.role, id = e.seg.id;
        if (role === 'select') {
          if (m.state === 'idle') {
            PB.Missions.select(g, id);
          } else if (m.state === 'active' &&
                     defs[m.active].objective === 'rescue' && id === 2) {
            PB.Missions.advance(g, 1);   // the rescue target is select id 2
          }
        } else if (role === 'start') {
          PB.Missions.startSelected(g);
        } else if (role === 'lock') {
          PB.Missions.lockHit(g);
        }
        return;
      }

      if (m.state === 'active') {
        var d = defs[m.active];
        if (d.objective === 'bumpers' && e.type === 'bumper') PB.Missions.advance(g, 1);
        else if (d.objective === 'bank' && e.type === 'dropbank') PB.Missions.advance(g, d.need);
      }
    },

    select: function (g, id) {
      var m = g.missions;
      if (m.state !== 'idle') return;
      m.state = 'selected';
      m.selected = id;
      PB.Game.setMessage(g, PB.Missions.defs()[id].name + PB.strings.mSelected);
    },

    startSelected: function (g) {
      var m = g.missions;
      if (m.state !== 'selected') return;
      var d = PB.Missions.defs()[m.selected];
      m.state = 'active';
      m.active = m.selected;
      m.selected = -1;
      m.progress = 0;
      m.need = d.need;
      m.timer = d.time;
      PB.Game.setMessage(g, d.name + PB.strings.mStart);
    },

    advance: function (g, n) {
      var m = g.missions;
      if (m.state !== 'active') return;
      m.progress += n;
      if (m.progress >= m.need) PB.Missions.complete(g);
    },

    complete: function (g) {
      var d = PB.Missions.defs()[g.missions.active];
      PB.Scoring.addRaw(g.scoring, d.jackpot);
      PB.Game.setMessage(g, PB.strings.mJackpot + commas(d.jackpot));
      PB.Missions.reset(g.missions);
    },

    fail: function (g) {
      PB.Game.setMessage(g, PB.strings.mFailed);
      PB.Missions.reset(g.missions);
    },

    reset: function (m) {
      m.state = 'idle';
      m.active = -1;
      m.selected = -1;
      m.timer = 0;
      m.progress = 0;
      m.need = 0;
    },

    lockHit: function (g) {
      var m = g.missions;
      if (m.multiball) return;
      m.lock++;
      if (m.lock >= cfg.missions.lockNeed) PB.Missions.startMultiball(g);
      else PB.Game.setMessage(g, PB.strings.mLocked + m.lock + '/' + cfg.missions.lockNeed);
    },

    startMultiball: function (g) {
      var m = g.missions;
      m.lock = 0;
      m.multiball = true;
      var sp = cfg.missions.mbSpawns;
      for (var i = 0; i < sp.length; i++) {
        PB.sim.addBall(g.sim, sp[i].x, sp[i].y, sp[i].vx, sp[i].vy);
      }
      PB.Game.setMessage(g, PB.strings.mMultiball);
    },

    // Per-step bookkeeping: mission timer and multiball end detection.
    tick: function (g, dt) {
      var m = g.missions;
      if (m.state === 'active') {
        m.timer -= dt;
        if (m.timer <= 0) { m.timer = 0; PB.Missions.fail(g); }
      }
      if (m.multiball) {
        var bodies = g.sim.world.bodies, n = 0;
        for (var i = 0; i < bodies.length; i++) if (bodies[i].active) n++;
        if (n <= 1) m.multiball = false;
      }
    },

    // Highlight color for a standup, or null when it should render dim. Used by
    // the renderer so the lit-target state is visible.
    standupColor: function (g, seg) {
      var m = g.missions, t = cfg.theme;
      if (seg.lit > 0) return '#ffffff';                  // brief hit flash
      if (seg.role === 'select') {
        if (m.state === 'idle') return t.neonGreen;        // all available
        if (m.state === 'selected' && m.selected === seg.id) return t.neonAmber;
        if (m.state === 'active' &&
            PB.Missions.defs()[m.active].objective === 'rescue' && seg.id === 2) {
          return t.neonAmber;                              // active rescue target
        }
        return null;
      }
      if (seg.role === 'start') return m.state === 'selected' ? t.neonAmber : null;
      if (seg.role === 'lock') return m.multiball ? null : t.neonCyan;
      return null;
    },
  };

})(window.PB = window.PB || {});
