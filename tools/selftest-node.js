// selftest-node.js - run the headless self-test under Node, no browser needed.
//
// Usage:  node tools/selftest-node.js
// Exit code 0 on all-OK, 1 otherwise. Intended for CI so regressions in the
// physics / game-rules layers are caught on every push. It also prints the
// determinism signature; run this under different engines (Node versions, or
// paste js into a browser console) and compare the signature to confirm the
// simulation is reproducible across machines.
//
// This is dev-only tooling. It does NOT affect the clone-and-play game, which
// still loads the same files via plain <script> tags in index.html.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// Minimal browser shims. The game modules attach to window.PB; we point window
// at the Node global so they share one namespace. readyState is 'loading' so
// main.js does NOT auto-run init() (we only want the self-test, not the app).
global.window = global;
global.document = {
  readyState: 'loading',
  hidden: false,
  title: '',
  addEventListener: function () {},
  getElementById: function () { return null; },
};
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.requestAnimationFrame = function () { return 0; };
global.cancelAnimationFrame = function () {};
global.performance = global.performance || { now: function () { return Date.now(); } };
global.localStorage = (function () {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
})();
// No AudioContext: PB.audio.ensure() becomes a no-op, which is what we want.

// Same order as index.html (dependency order).
var FILES = [
  'js/config.js',
  'js/util.js',
  'js/ui/strings.js',
  'js/physics/physics.js',
  'js/physics/collision.js',
  'js/engine/loop.js',
  'js/engine/input.js',
  'js/engine/audio.js',
  'js/engine/storage.js',
  'js/engine/particles.js',
  'js/engine/camera.js',
  'js/game/ball.js',
  'js/game/flipper.js',
  'js/game/bumper.js',
  'js/game/target.js',
  'js/game/ramp.js',
  'js/game/plunger.js',
  'js/tables/classic.js',
  'js/game/table.js',
  'js/game/scoring.js',
  'js/game/missions.js',
  'js/game/transform.js',
  'js/game/timedilation.js',
  'js/ui/hud.js',
  'js/ui/menus.js',
  'js/selftest.js',
  'js/main.js',
];

var root = path.join(__dirname, '..');
FILES.forEach(function (f) {
  var code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
});

// run() logs the SELFTEST line and the SIGNATURE line itself.
var res = global.PB.selfTest.run();
process.exit(res.ok ? 0 : 1);
