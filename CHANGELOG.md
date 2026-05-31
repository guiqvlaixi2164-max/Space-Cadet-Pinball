# Changelog

All notable changes to this project are documented here, one entry per phase.
This project follows the phased build plan in `PLAN.md`.

## Phase 0 - Skeleton and feasibility

Foundation laid. The repository opens and renders, and the `file://` module
loading question is settled.

### Added
- Full repository directory structure from `PLAN.md` section 3, with stub files
  for every module so the script load order is fixed now and never changes.
- `index.html` with a fixed-resolution `<canvas>` and the locked script-loading
  strategy (ordered classic `<script>` tags, single `window.PB` namespace).
- `css/main.css` (stage layout, aspect-ratio-preserving canvas scaling, neon
  framing) and `css/ui.css` (overlay placeholders).
- `js/config.js` (centralized tuning constants), `js/ui/strings.js` (all
  user-facing text in one place), and `js/main.js` (render bootstrap).
- A live parallax starfield background and the neon "Hello, Cadet" title screen
  to prove the rendering pipeline works end to end.
- `README.md`, `LICENSE` (MIT), `.gitignore`, `CHANGELOG.md`, and `BACKLOG.md`
  (populated with the out-of-scope ideas fenced off from v1).

### Feasibility test result (file:// ES module loading)

Tested empirically with headless Chrome 2026 loading a page that imports a
sibling ES module via a relative path from the `file://` origin.

Result: BLOCKED. Chrome refuses cross-origin module requests from origin "null"
(the file:// origin), reporting that cross-origin requests are only supported
for http, https, data, and a few privileged schemes. Safari enforces the same
restriction; Firefox behavior is inconsistent across versions.

Because the project must be clone-and-play across all target browsers under
`file://`, ES modules are rejected.

Decision (locked): use ordered classic `<script>` tags with a single global
`window.PB` namespace. Table data is stored as JavaScript objects (registered on
`window.PB.TABLES`), never fetched as JSON, for the same `file://` reason.

### Exit criteria

Met. Opening `index.html` directly via `file://` shows the animated starfield
and title with no console errors, fully offline.
