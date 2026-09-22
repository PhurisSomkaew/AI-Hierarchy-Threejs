# Tech Context

## Stack
- **three.js r184** via `<script type="importmap">` from unpkg, pinned with SRI hashes.
  No bundler, no npm install, no package.json.
- Postprocessing (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`) and
  extras (`RoundedBoxGeometry`, `GLTFLoader`) imported directly from
  `https://unpkg.com/three@0.184.0/examples/jsm/...` — verified safe because those modules
  only import from bare `'three'` plus relative sibling files under the same CDN path.
- Font: IBM Plex Sans Thai via Google Fonts `<link>`.
- No a11y/mobile layer — desktop + projector only, per product scope.

## Running it locally
```bash
cd ai-hierarchy-web
python3 -m http.server 8000
# open http://localhost:8000/tower.html
```
Must be served over http — `file://` blocks ES module imports and the page hangs on
"กำลังสร้างหอคอย…". This local server tends to go down across session interruptions/model
switches; check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/tower.html`
before assuming it's up, restart with `run_in_background:true` if not.

## Cache-busting
`tower.html`'s module import is `./js/tower.js?v=N` — **increment N after every JS change**.
Current: `v=63`.

## Player & character assets (external GLB, CC0)
- `assets/kaykit_Knight.glb` — the player model. Loaded via `GLTFLoader().loadAsync(...)`,
  auto-scaled to 3.2 units via `THREE.Box3().setFromObject()`, `root.rotation.y = Math.PI`
  (model's rest pose faces backward relative to the game's forward convention — do not
  remove this line). `AnimationMixer` drives Idle/Walking_A via crossfade.
- `assets/lantern.glb` — backdrop lanterns (28 instances) + one instance in the lift cabin.
- Every other file in `assets/` (Xbot, RobotExpressive, Soldier, Michelle, CesiumMan,
  kaykit_Rogue/Mage/Barbarian, kira, minion-a01, mixamo-lowpoly, readyplayer.me) is a
  **leftover candidate from model research, not referenced by any code**. Harmless but
  unused; safe to delete if someone wants to clean up, not currently requested.
- All 6 guide characters (`makeBot(era)`) and the floor-6 crew figures are still built from
  three.js primitives (`RoundedBoxGeometry`/`CapsuleGeometry`/etc.), not GLB — only the
  player was replaced with a real rigged model.

## The `impeccable` design skill
Installed at `.claude/skills/impeccable/`. Used throughout for naming decisions, modal
chrome critique, and pre-ship polish passes. Key commands used this project:
- `impeccable context` — run once per session before design work; this project has no
  `PRODUCT.md` yet (narrow refinements proceed on the incumbent code as authority anyway —
  `init` was never run, not currently blocking anything).
- `impeccable detect --json tower.html` — the mechanical quality-floor checker; run after
  every UI edit, expect `[]`.
- `reference/craft-floor.md` — the checklist to read before any UI edit; encodes the bans
  listed in `systemPatterns.md`.

## Token-economy notes (established with the user this session)
- Prefer Sonnet for straightforward implementation; switch to Opus only for design-judgment
  moments (naming, concept critique, polish direction).
- Don't invoke `/impeccable` for plain "continue implementing" requests — each invocation
  re-injects the full skill instruction text. Reserve it for requests that actually need
  design judgment.
- Read targeted line ranges of `js/tower.js` (currently ~3,700 lines) via `grep`/`sed`
  rather than reading the whole file.
