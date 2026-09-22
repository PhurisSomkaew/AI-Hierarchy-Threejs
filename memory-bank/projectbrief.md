# Project Brief

## What this is
**หอคอย AI (AI Tower)** — a walk-around 3D educational web experience (vanilla three.js,
third-person, no build step) that teaches a non-technical audience the hierarchy:

```
AI → Machine Learning → Deep Learning → Generative AI → LLM → Agentic AI
```

The player walks through a 6-floor tower. Each floor has a learning board (real docs
content), a guide character who talks before/after, a hands-on minigame (or, on floor 6,
a watch-it-run flow), and a closing summary card.

## Audience
General company staff with no AI background (`README.md` — "กลุ่มเป้าหมายคือคนทั่วไปที่ไม่มีพื้นฐาน
AI"). Delivered live via projector + played solo on a computer. Never opens with jargon —
every term gets a plain-language explanation the first time it appears.

## Source of truth for content
`source-docs/agentic.txt` and `source-docs/neuron_network.txt` are the teacher's own
documents. **Their wording is never altered** — only structure/visual/UX layers are open
to change. This is a standing, explicit constraint, not a style preference.

## Core files
| File | Role |
|---|---|
| `tower.html` | All CSS + DOM overlay markup |
| `js/tower.js` | All 3D scene/game logic (~3,700 lines) |
| `source-docs/*.txt` | Teacher's original content — the DOCS board text is copied from here |
| `README.md` | Original handoff doc — describes the project **before this session's work**; see `activeContext.md` for what has since changed |
| `.claude/skills/impeccable/` | Design-critique/polish skill used throughout for naming, chrome, and quality-floor passes |

## Non-goals (explicitly out of scope unless asked)
- No build step / no framework migration (stays vanilla three.js + ES modules via importmap)
- No mobile touch controls (desktop + projector only, per README)
- No save/progress persistence across refresh
- No audio
