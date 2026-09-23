# Active Context

_Last updated: 2026-09-23, `tower.js?v=98`. Live at https://phu-mui-robotics.github.io/ai-3d-interaction/tower.html — see `progress.md` for full detail._

## What's next
**The project is now deployed** — public GitHub repo `Phu-MUI-Robotics/ai-3d-interaction`,
served via GitHub Pages at `https://phu-mui-robotics.github.io/ai-3d-interaction/tower.html`
(root `/` redirects there; the old 2D version lives on at `/legacy-2d.html`, not deleted).
`.gitignore` excludes `.claude/` and `.impeccable/`. **This sandbox cannot `git push`** — no
GitHub credentials configured here — so every push in this project's history so far has needed
the user to run `git push` themselves from their own Terminal after I commit locally; expect the
same next time there's something to ship.

Round 33 then fixed a real bug the user found on the live site: near the lift, the movement
clamp used to disable ALL bounds checking within a radius of 5.6 around the lift — chosen only
so the handoff from the deck felt smooth, but it also left the player free to wander into the
~90% of that circle that has no floor at all, ending up stranded in the exterior backdrop. Fixed
with a proper three-shape nearest-point clamp (deck rectangle, a bridging corridor rectangle,
the pad as a circle) instead of the zone-detect-then-clamp pattern every other special zone in
this game uses — that pattern doesn't work here because the deck and the pad are genuinely
disjoint with a real gap between them. Verified via Python sweep before shipping: zero invalid
landings, zero snapping (max frame displacement exactly matched the simulated step size), deck
interior never touched, the lift's exit docking position unaffected. **Committed locally
(`tower.js?v=98`), not yet pushed** — needs the user to push from their own Terminal, then
GitHub Pages needs ~1-2 minutes to rebuild before the fix is live to test.

On resuming: confirm the push landed, then have the user re-test the exact scenario from their
screenshots (walking to the lift on any floor 1-6) to confirm they can no longer end up outside
the tower structure.

## How floor 6 got here (chronological — see `progress.md` for full detail per round)
1. Built end-to-end: concept, PM/UX/UI/Frontend/Backend/Infra-DevOps/QA + Data/Security bench,
   the scripted 4-scene watch-only flow (`AGN_GOALS`/`AGN_SCENES`/`A` state object).
2. User play-tested (text only), gave 3 pieces of feedback, paused before any fix.
3. Round 2: `/impeccable` consultation on all 3, implemented (list-style board block,
   node-track flow diagram v1, roster standee).
4. Round 3: first real screenshots surfaced 3 bugs (stale "5 ชั้น" lobby line, unreachable
   roster marker, flow diagram v1 reading as a generic stepper) — all 3 fixed and later
   confirmed working via screenshot.
5. Round 4: added a "meeting" beat to Planning by highlighting `#agn-team`'s row — **user
   rejected this**, wanted an actual seated-people table, not a row highlight.
6. Round 5: replaced it with `.mini.table` — a small table+seats widget living on the track's
   own Planning box (`agnTrackRender()`), not `#agn-team`.
7. Round 6: confirmed round 5's diagram/chips are correct via real screenshot.
   Nudged the roster standee off a desk-column x-alignment it was accidentally sitting on.
   Rebuilt `#agn-stage`'s three phases per explicit user request (table above): a bigger
   center-stage version of the meeting table that breaks into task cards (Planning), cards
   that fly to their owner's `#agn-team` box instead of fading in place (MultiAgent), and a
   card that visibly bounces between QA and BE (Reflection) — see `progress.md` round 6 for
   the implementation details (`A.flown`, `agnFlyCards()`).
8. Round 7: fixed the `#agn-flow` flex bug that put the action buttons off-screen, plus two
   of round 6's own bugs, then rebuilt the stage as one persistent seats/table/seats room —
   `#agn-team` and `#agn-meeting` both deleted.
9. Round 8: that layout still overflowed — six full-width cards don't fit whatever the CSS
   says. Replaced with a round table, task **tokens** on the tabletop, and `#agn-status`
   restyled as a game text box reading out one task at a time.
10. Round 9: the text box was rejected — one box can only show one task then
    overwrite it. Each task moved onto **its owner's seat** where it stays; layout became a
    3-column grid (seats / round table / seats); the box kept for the lesson only.
11. Round 10: fixed the Reflection card parking on a seat after the run ended — user then
    confirmed the whole Mission Control panel works.
12. Round 11 first tried folding Jev/System-One content (`source-docs/jev.txt`) straight into
    `DOCS[4]`/`DOCS[5]` as extra board blocks. User asked whether floor 5 got a separate room;
    a character count showed the board had become 69% Jev, repeating a failure mode
    `README.md` already documents (content appended to a section's end doesn't get read).
    Round 12 cut `DOCS[4]` back to a short teaser and gave Jev its own standee on floor 5
    (`jevPos`, `openDocs(JEV_DOC)`) — same pattern as floor 6's roster standee.
13. Round 13: user explicitly asked for "ห้องแยก" (a separate room). Confirmed via
    `AskUserQuestion` this meant a small enclosed room in floor 5, not a literal floor 7. The
    standee was replaced with `jevRoom` — an actual 3-walled, roofed nook, its footprint found
    by sweeping the deepest-reachable pocket in Python rather than eyeballing a point.
14. Round 14: first screenshot of the room was facing the wrong direction entirely (room out
    of frame). Second screenshot, facing the right way, showed the sign clearly but no
    legible walls — the doorway's orientation (matching the natural approach vector) put the
    camera looking straight down the booth, edge-on to both side walls. Added a torii-gate
    frame (posts + crossbeam) at the doorway, legible from exactly that angle.
15. Round 15: user clarified "ห้องแยก" meant a connecting path to a dedicated separate room,
    not a nook in the main hall. Replaced with `JEV_BRIDGE` + `JEV_ROOM`, a detached room off
    floor 5's open west edge, plus a movement-clamp exemption (`JEV_ZONE`) and a wayfinding
    sign back on the main deck.
16. Round 16: the west-side bridge read as a disconnected floating platform in screenshot.
    Confirmed via `AskUserQuestion` this meant reroute through the back wall (`JEV_GATE`, a
    real doorway cut into the shared per-floor wall loop) with solid parapets instead of
    posts. Bridge/room re-oriented along z; `JEV_ZONE` reworked for that axis.
17. Round 17 (this session): two explicit asks before any screenshot — the rail should
    physically stop the player, and the bridge should be much longer. Movement clamp rewritten
    as a segment-aware two-stage boundary (bridge-width vs room-width); bridge length
    5.8→15.6, lanterns generalized to space themselves along whatever length it is.
18. Round 18: unrelated `/impeccable` polish pass surfaced a real WCAG contrast defect in the
    crew-identity colors (`.agn-tok`, crew chips, speaker pill) — added `textOn()` to compute
    max-contrast text color per chip instead of a fixed white.
19. Round 19: user reported the walkable bridge's camera got pinned against the parapet — the
    game has no camera-collision system at all. Replaced "walk the bridge" with `jevWarp()`, a
    fade-and-snap teleport (door + warp instead of a walkable corridor).
20. Round 20: shrank `nearJevDoor`'s trigger box to zero-overlap against ยูนิต 05's/the word
    press's talk radii, after confirming via Python corner-sweep that the original box sat
    entirely inside both (margins as negative as -2.48).
21. Round 21: user reported the shrunk trigger was unusably small, AND that entering warped the
    camera onto the tower's exterior. Root-caused the exterior bug to the shared camera's flat
    `FZ-2` look-at z constant flipping `atan2` past z≈-22.5 (the room was out there from round
    17's "make it longer" ask) — shrank bridge+room back to z≈-14.5..-19.1.
22. Round 22: moved the door crossing off E entirely onto a dedicated **F** key (explicit
    instruction), which also let the trigger box go back to being comfortably large since there
    was no more E-ambiguity to avoid. First tried containing the camera's view with a
    `THREE.BackSide` dome; Python-tested the shared camera formula's actual reachable swing
    (~23 units, including onto the tower's own side of the doorway) and abandoned the dome
    before shipping — no static enclosure can contain a camera that can end up outside it. Gave
    the room its own dedicated camera branch instead.
23. Round 23: first screenshot since round 19 confirmed the door/F-key/warp mechanics worked,
    but the view was near-black with the player's own back filling the frame. Root cause: the
    dedicated camera's ceiling (`min(player.z+4.5, -13)`) placed it at z=-13, on the unlit
    bridge, not inside the lit room (zNear=-14.6). Fixed with `camZ` pinned to a point verified
    inside the room, and a look-at target *always derived by subtracting from camZ* — making it
    structurally impossible to look back toward the doorway regardless of where camZ sits. Also
    added a lift-menu "+ Jev" mention to floor 5's row.
24. Round 24 (this session): user confirmed round 23's fix via screenshot, then asked to expand
    the room a lot in every dimension. Enlarged `JEV_ROOM` (5→14 wide, 4.5→12 deep, `zNear`
    left unchanged to protect the bridge-junction/camera-flip math round 21 fixed) and `wallH`
    (2.9→6, which auto-scaled every wall/roof/trim/torii-post expression already written in
    terms of it). Turned the fixed-point camera from round 23 into a follow-with-ceiling
    (`min(player.z+4.5, zNear-1.2)`) since a pin only worked for the old shallow room, keeping
    the same subtract-from-camZ look-at guarantee. Scaled up the sign, torii gate thickness, and
    glow sprites to match. Not yet confirmed by screenshot.

## Established conventions worth knowing before touching floor 6 again
- The flow-diagram track (`agnTrackRender()`) is the reference pattern for "state that must
  persist instead of being overwritten" — `agnNodeCaption[]` is set once per node and never
  cleared until a new goal starts. Reuse this pattern for any future multi-step sequence
  rather than a single rewritten status line.
- `.blk-list`/`.blk-item` (learning-board CSS) is the reusable pattern for any dense board
  block going forward — extend a `DOCS[]` block with `list:[[label,desc],...]` instead of
  writing another long `·`-joined paragraph.
- Manual "ต่อไป" gating between scripted scenes (vs auto-chaining) is the established choice
  for floor 6 specifically, per explicit user preference for pacing control. Don't assume
  this generalizes to other floors without asking.
- **Any new child of `.box` must declare its own flex behaviour.** `.box` is a flex column
  with `max-height:92vh` and no `overflow`, so a child that can't shrink doesn't scroll — it
  pushes everything after it (including the action buttons) outside the panel where the user
  can't reach it. `#agn-flow` sat broken this way from the day it was written until round 7.
- **Before placing any new interactable marker, check its distance against every
  earlier-checked marker's own radius in the `onKeyDown` if-chain**, not just "is it visually
  near the thing it's next to" — and now also check it isn't sitting on another prop's exact
  x/z (the roster standee hit both failure modes in two different rounds: unreachable in
  round 3, visually overlapping a figure in round 6).
- **`agnPaint()` is the single source of truth for every visible state in Mission Control** —
  every scene mutates `A` then calls `agnPaint()`, never touches the DOM directly outside it
  (two deliberate exceptions, both documented in `progress.md`: `agnFlyCards()` sets a flown
  card's transform/opacity once and `agnPaint()` skips re-touching it, and `agnBugRender()`
  measures from the table's rect rather than the card's own so a repaint can't compound an
  offset). Keep new visual state driven off `A` fields read inside `agnPaint()`/its helpers,
  not off ad-hoc `agnAt()` timelines, so replay/seed-jumping (`agnActs()`'s "ดูซ้ำ" buttons)
  keeps working without needing its own copy of the animation logic.
- Jev / System-One-model content (the user's separate ask this session, paused before floor-6
  verification took priority) is written up in `source-docs/jev.txt`, staged to land as a full
  block on `DOCS[4]` (LLM floor) and a short block on `DOCS[5]` (Agentic floor) — not a new
  floor. Not yet wired into `js/tower.js`.
