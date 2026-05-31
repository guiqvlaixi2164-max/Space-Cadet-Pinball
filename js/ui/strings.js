// strings.js - all user-facing text in one place to ease future localization.
// No long-dash characters anywhere (project constraint): use a hyphen.

(function (PB) {
  'use strict';

  PB.strings = {
    title: 'SPACE CADET',
    subtitle: 'Deluxe Edition',
    hello: 'Hello, Cadet',
    pressToStart: 'Press SPACE to launch',
    booting: 'Systems online',
  };

})(window.PB = window.PB || {});
