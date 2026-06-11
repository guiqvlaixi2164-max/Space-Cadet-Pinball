// util.js - tiny shared helpers loaded early so every module can use one copy.
// Keeps formatting (and other cross-cutting utilities) in a single place rather
// than duplicated per file.

(function (PB) {
  'use strict';

  PB.format = {
    // Group an integer with thousands separators, locale-independent (no
    // toLocaleString) so output is identical on every machine.
    commas: function (n) {
      return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
  };

})(window.PB = window.PB || {});
