# System Patterns

## Stack
Vanilla three.js r184 via ES-module importmap (no bundler, no framework). Everything lives
in two files: `tower.html` (CSS + DOM overlay) and `js/tower.js` (scene + game logic).

## Per-floor construction pattern (repeat this for any new floor)
Every floor is built the same way in `js/tower.js`:
1. Add an entry to `FLOORS[]` (title, subtitle, color, era label) and `CAM_TUNE[]` (per-floor
   camera fov/damp personality) — `TOP_Y = floorY(FLOORS.length)` derives automatically, so
   the building height, corner columns, roof, and lift rail all extend without hardcoding.
2. Add a `DOCS[]` entry — the learning-board content, copied verbatim from `source-docs/`.
3. Extend `makeBot(era, opt)` with a new era branch (color palette + one distinguishing
   chest/head detail) for the guide character.
4. Build the floor's 3D prop group (desk/machine/console) near the other `/* floor N: */`
   blocks.
5. Add `TALK_F{N}_A` (before quest) / `TALK_F{N}_B` (after quest) dialogue arrays.
6. Add markers (`marker()`) + `near*()` proximity checks, wire into `onKeyDown`'s `e` and
   `Escape` handlers.
7. Add the stage-machine branches in `advance()` (`f{N}intro→f{N}quest`, `f{N}wrap→f{N}done`)
   and the `ride()` function's per-floor `F` map entry.
8. Add visibility/animation wiring in `step()` (`level === N || level === 0` pattern).
9. Add a `CARDS[N]` glossary entry and update `CARD_CLOSE_MSG`.
10. Add the modal markup/CSS block in `tower.html` (`#llm`, `#agn`, etc. are the template —
    each floor gets its own themed color, not a shared generic panel).
11. Run the `impeccable` craft-floor pass before calling it done (see below).

## Recurring rendering bug: thin lit geometry → bright streak
Any long/thin mesh using a **lit** material (`toon()` or `metal()`) can catch the sun
edge-on and blow out to near-white once real shadows/tonemapping/bloom are active. Fixed
by converting the element to an **unlit** `MeshBasicMaterial`. Already applied to: `matWood`
backdrop elements, the two full-height corner columns, the lift guide rail, the floor-6
dividing-line strip/ticks. When adding new tall/thin structural elements, default to unlit
unless there's a specific reason it needs to catch light.

## Toon-shading pipeline
`MeshToonMaterial` + a 4-step gradient `RAMP` DataTexture (cached singleton via `ramp()`) +
`ink(mesh, w)` — an inverted-hull outline (BackSide duplicate scaled up by `1 + w*OUTLINE_BOLD`,
`OUTLINE_BOLD = 1.7` global). `metal()` is `MeshStandardMaterial({roughness:.58, metalness:.55})`
— deliberately detuned from a shinier default to avoid a generic "AI slop" specular pop.

## Lighting
Real shadows (`PCFSoftShadowMap`) + `ACESFilmicToneMapping` (`toneMappingExposure` currently
1.25) + per-floor ambient/sun tint via `FLOOR_TINT[]` lerped by `level` each frame.

## Shared texture factories
`surface(w,h,dpr)` — canvas+texture helper used for every hand-drawn 2D texture (screens,
name tags, glyphs). `shojiTex()/shojiMat()` — cached washi-paper + kumiko-lattice texture,
reused by backdrop rooms, tower windows, and the lift cabin to unify the Japanese theme.
`glowSprite(size, color, opacity)` — additive radial-gradient sprite for ambient glow under
characters/props.

## Stage-machine state
```
mode      // 'walk' | 'talk' | 'items' | 'docs' | 'ml' | 'dl' | 'ga' | 'llm' | 'agn' | 'lift' | 'ride' | 'card'
level     // 0 = lobby, 1-6 = floor
stage     // 'lobby' | 'toLift' | 'f{N}intro' | 'f{N}quest' | 'f{N}wrap' | 'f{N}done'
visited / cleared   // Set<number> — any floor visitable in any order, state remembered independently
```

## Floor 6 is architecturally different — read before extending it
Floors 1–5 are player-driven minigames. Floor 6 ("Mission Control") is a **scripted flow the
player watches**, because the lesson ("decide once, the team finishes it") would be
contradicted by a minigame that makes the player operate every step. Key mechanism in
`js/tower.js`:
- `AGN_GOALS[]` — 3 goal cards, each with its own `tasks[]`, `raw` (shuffled order to
  demonstrate Planning re-sorting it), `bench` (2 crew members deliberately not called, to
  demonstrate Tool Use pattern selectivity), and `bug` (the Reflection-pattern catch/fix pair).
- `AGN_SCENES[]` — 4 scenes (Planning / Tool Use / MultiAgent / Reflection), each with a
  `seed()` (snap to end-state, used by the per-scene replay buttons) and `run()` (the timed
  `agnAt(ms, fn)` sequence).
- `A` — the single mutable state object every scene mutates; `agnPaint()` reads it and is
  the only function that touches the DOM/3D desk state. This lets any scene's `seed()`
  reconstruct a valid mid-flow snapshot without replaying earlier scenes.
- `closeAGN()` **deliberately does not stop the running flow** — the team keeps working
  in the 3D scene while the player walks away and can visit other floors. This is the
  floor's signature moment, not an oversight.
- `agnPlainRun()` — the "if this were a plain Agent" contrast replay: same goal, same bug,
  but skips Planning/Tool Use/Reflection entirely and ships the bug uncaught. Only offered
  after the real flow has completed once (`agnEverFinished`).

## Craft-floor conventions already established this project (do not reintroduce)
- No colored `border-left`/`border-right` accents on cards/callouts/status boxes — use a
  full border + background tint instead (see `#llm-status`, `#agn-status`).
- No kicker/eyebrow caption stacked above an `<h2>` — if a phase name needs to change per
  state, mutate the `<h2>` text directly (see `llm-h2`, `agn-h2`), don't add a label above it.
- No emoji/Unicode glyphs standing in for an icon — floating "letter" decorations use
  Latin + Thai characters only (font stack doesn't guarantee CJK/Greek glyph coverage; a
  missing glyph renders as an empty box).
- Progress-bar-style fills animate `transform:scaleX()` with `transform-origin:left`, never
  animate `width` directly (layout-thrash; the design detector flags this).
- Run `.claude/skills/impeccable/scripts/impeccable detect --json tower.html` after any UI
  edit — expect `[]`. `node --check js/tower.js` after any JS edit.
