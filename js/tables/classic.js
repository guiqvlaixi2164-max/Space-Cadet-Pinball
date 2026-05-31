// classic.js - the v1 table definition as a plain JS data object (not fetched
// JSON, to sidestep the file:// fetch block). Registers onto PB.TABLES.classic.
// Phase 0 stub. Populated in Phase 3.
(function (PB) {
  'use strict';
  PB.TABLES = PB.TABLES || {};
  PB.TABLES.classic = PB.TABLES.classic || { name: 'Classic', bodies: [] };
})(window.PB = window.PB || {});
