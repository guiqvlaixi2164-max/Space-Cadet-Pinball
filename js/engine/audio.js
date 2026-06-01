// audio.js - Web Audio synthesized SFX and layered dynamic music. No audio files.
//
// Everything is synthesized at runtime from oscillators and noise buffers, so the
// repo stays clone-and-play with zero audio assets. The AudioContext is created
// lazily on the first user gesture (browser autoplay policy) via ensure(); every
// public method is a safe no-op until then, so the headless self-test, which
// never gestures, runs untouched.
//
// Routing: master gain -> destination, with a music bus and an sfx bus under it.
// The music bus feeds four layer gains (pad, bass, drums, lead) whose levels are
// ramped by intensity so the score thickens during missions and multiball. A
// small lookahead scheduler, driven once per render frame from tick(), queues the
// next fraction of a second of music against the audio clock for glitch-free
// timing independent of the render frame rate.

(function (PB) {
  'use strict';

  var cfg = PB.config;

  // Four-bar minor progression (Am - F - C - G), one chord per bar, as MIDI note
  // numbers. Spacey and a touch melancholic, which suits the setting.
  var CHORDS = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ];

  var A = {
    ctx: null,
    master: null, musicBus: null, sfxBus: null,
    layers: null,      // { pad, bass, drums, lead } gain nodes
    music: null,       // scheduler state
    noiseBuf: null,
    settings: { volume: 0.7, muted: false },
  };

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function applyMaster() {
    if (!A.master) return;
    var v = A.settings.muted ? 0 : A.settings.volume * (cfg.audio.master);
    A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.02);
  }

  function noiseBuffer() {
    if (A.noiseBuf) return A.noiseBuf;
    var n = Math.floor(A.ctx.sampleRate * 0.5);
    var b = A.ctx.createBuffer(1, n, A.ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = b;
    return b;
  }

  // ---- Low-level voice helpers -------------------------------------------------

  // A pitched blip with an exponential decay envelope. f1 sweeps the pitch toward
  // it over the note (set equal to f0 for a steady tone). Returns nothing.
  function tone(when, type, f0, f1, dur, peak, dest) {
    var o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest || A.sfxBus);
    o.start(when); o.stop(when + dur + 0.02);
  }

  // A filtered noise burst (impacts, hats, whooshes).
  function noise(when, dur, peak, filterType, freq, dest) {
    var s = A.ctx.createBufferSource();
    s.buffer = noiseBuffer();
    var f = A.ctx.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.setValueAtTime(freq || 1000, when);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(dest || A.sfxBus);
    s.start(when); s.stop(when + dur + 0.02);
  }

  // A short run of tones (a chime or fanfare). Notes play in sequence, gap apart.
  function arp(when, freqs, gap, peak, type) {
    for (var i = 0; i < freqs.length; i++) {
      tone(when + i * gap, type, freqs[i], freqs[i], gap * 1.8, peak);
    }
  }

  // ---- SFX library -------------------------------------------------------------
  // Each entry is keyed by the cue name pushed from the game layer.

  var SFX = {
    plunger: function (t) {
      noise(t, 0.3, 0.5, 'lowpass', 1400);
      tone(t, 'sawtooth', 170, 70, 0.32, 0.3);
    },
    flipper: function (t) {
      tone(t, 'square', 200, 120, 0.05, 0.16);
      noise(t, 0.03, 0.18, 'highpass', 2200);
    },
    bumper: function (t) {
      tone(t, 'sine', 540, 180, 0.16, 0.5);
      noise(t, 0.04, 0.22, 'bandpass', 900);
    },
    sling: function (t) { tone(t, 'triangle', 740, 320, 0.10, 0.34); },
    target: function (t) {
      tone(t, 'square', 880, 880, 0.07, 0.28);
      tone(t + 0.03, 'square', 1320, 1320, 0.06, 0.2);
    },
    standup: function (t) { tone(t, 'square', 680, 980, 0.09, 0.26); },
    bank: function (t) { arp(t, [660, 880, 1320], 0.09, 0.3, 'triangle'); },
    select: function (t) { tone(t, 'square', 600, 900, 0.08, 0.24); },
    missionStart: function (t) { arp(t, [440, 587, 740], 0.12, 0.32, 'sawtooth'); },
    lock: function (t) {
      tone(t, 'sine', 150, 90, 0.18, 0.4);
      tone(t + 0.05, 'square', 440, 660, 0.12, 0.24);
    },
    multiball: function (t) { arp(t, [440, 554, 659, 880, 1108, 1318], 0.10, 0.4, 'sawtooth'); },
    jackpot: function (t) {
      arp(t, [523, 659, 784, 1046], 0.10, 0.42, 'square');
      arp(t + 0.12, [659, 784, 988, 1318], 0.10, 0.34, 'triangle');
    },
    rankup: function (t) { arp(t, [523, 659, 784, 1046, 1318], 0.11, 0.4, 'triangle'); },
    ballSaved: function (t) {
      tone(t, 'sine', 520, 780, 0.18, 0.34);
      tone(t + 0.12, 'sine', 780, 1040, 0.22, 0.3);
    },
    fail: function (t) {
      tone(t, 'sawtooth', 330, 160, 0.3, 0.34);
      tone(t + 0.08, 'sawtooth', 247, 110, 0.34, 0.28);
    },
    drain: function (t) { tone(t, 'sine', 300, 70, 0.6, 0.4); },
    balldrain: function (t) { tone(t, 'sine', 260, 110, 0.24, 0.24); },
    tilt: function (t) {
      for (var i = 0; i < 6; i++) tone(t + i * 0.09, 'square', 150, 150, 0.06, 0.3);
    },
    // Time dilation engaging: a slow downward sweep with a shimmer on top.
    dilate: function (t) {
      tone(t, 'sine', 880, 220, 0.7, 0.32);
      tone(t, 'triangle', 1760, 660, 0.6, 0.12);
    },
  };

  // ---- Music: layers + lookahead scheduler ------------------------------------

  function buildMusic() {
    var ctx = A.ctx;
    function layer(initial) {
      var n = ctx.createGain();
      n.gain.value = initial;
      n.connect(A.musicBus);
      return n;
    }
    A.layers = { pad: layer(0), bass: layer(0), drums: layer(0), lead: layer(0) };
    A.music = { started: false, nextTime: 0, step16: 0, intensity: -1 };
  }

  // A music note: like tone() but with a gentle attack so layered notes do not
  // click, routed into one of the layer gain nodes.
  function musicNote(layer, type, freq, dur, peak, when) {
    var o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + Math.min(0.04, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(layer);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function padChord(chord, when, dur) {
    for (var i = 0; i < chord.length; i++) {
      musicNote(A.layers.pad, 'triangle', mtof(chord[i]), dur, 0.16, when);
    }
  }

  function kick(when) {
    var o = A.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.6, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    o.connect(g); g.connect(A.layers.drums);
    o.start(when); o.stop(when + 0.2);
  }
  function snare(when) { noise(when, 0.14, 0.4, 'bandpass', 1800, A.layers.drums); }
  function hat(when) { noise(when, 0.04, 0.22, 'highpass', 7000, A.layers.drums); }

  // Set the target gain of each layer for the requested intensity and ramp toward
  // it. 0 = menus (pad only), 1 = play (pad + bass), 2 = mission (+ drums),
  // 3 = multiball (+ lead).
  function setIntensity(level) {
    var m = A.music;
    if (level === m.intensity) return;
    m.intensity = level;
    var tc = (cfg.audio.layerFade || 0.8) / 3;
    var t = A.ctx.currentTime;
    A.layers.pad.gain.setTargetAtTime(level >= 1 ? 0.6 : 0.45, t, tc);
    A.layers.bass.gain.setTargetAtTime(level >= 1 ? 0.7 : 0.0, t, tc);
    A.layers.drums.gain.setTargetAtTime(level >= 2 ? 0.8 : 0.0, t, tc);
    A.layers.lead.gain.setTargetAtTime(level >= 3 ? 0.65 : 0.0, t, tc);
  }

  // Queue every musical event in [now, now + lookahead). All layers are always
  // scheduled; the per-layer gains (set by intensity) decide what is heard, which
  // is what makes layers fade in and out smoothly.
  function schedule() {
    var m = A.music, ctx = A.ctx;
    if (!m.started) { m.started = true; m.nextTime = ctx.currentTime + 0.06; m.step16 = 0; }
    var s16 = (60 / cfg.audio.bpm) / 4;       // seconds per sixteenth
    var ahead = ctx.currentTime + 0.12;
    while (m.nextTime < ahead) {
      playStep(m.step16, m.nextTime, s16);
      m.nextTime += s16;
      m.step16++;
    }
  }

  function playStep(step, t, s16) {
    var bar = Math.floor(step / 16) % 4;
    var s = step % 16;                         // sixteenth within the bar
    var chord = CHORDS[bar];

    if (s === 0) padChord(chord, t, s16 * 16); // sustain the chord for the bar
    if (s % 4 === 0) musicNote(A.layers.bass, 'triangle', mtof(chord[0] - 12), s16 * 3, 0.5, t);

    if (s === 0 || s === 8) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (s % 2 === 0) hat(t);

    if (s % 2 === 0) {                          // lead arpeggio on the eighths
      var note = chord[(s / 2) % 3] + 12;
      musicNote(A.layers.lead, 'sawtooth', mtof(note), s16 * 1.4, 0.26, t);
    }
  }

  // ---- Public API --------------------------------------------------------------

  PB.audio = {
    // Create (or resume) the audio context. Must be called from a user gesture.
    ensure: function () {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.connect(A.ctx.destination);
      A.sfxBus = A.ctx.createGain();
      A.sfxBus.gain.value = cfg.audio.sfxLevel;
      A.sfxBus.connect(A.master);
      A.musicBus = A.ctx.createGain();
      A.musicBus.gain.value = cfg.audio.musicLevel;
      A.musicBus.connect(A.master);
      buildMusic();
      applyMaster();
    },

    ready: function () { return !!A.ctx; },

    // Push current volume/mute from settings to the master bus.
    applySettings: function (s) {
      if (s) { A.settings.volume = s.volume; A.settings.muted = s.muted; }
      applyMaster();
    },

    // Play a one-shot effect by cue name. No-op before ensure() or for unknown
    // names (so new cues degrade gracefully).
    sfx: function (name) {
      if (!A.ctx) return;
      var f = SFX[name];
      if (f) f(A.ctx.currentTime);
    },

    // Drive the music: set the layering intensity and advance the scheduler.
    // Call once per render frame.
    tick: function (intensity) {
      if (!A.ctx) return;
      setIntensity(intensity | 0);
      schedule();
    },
  };

})(window.PB = window.PB || {});
