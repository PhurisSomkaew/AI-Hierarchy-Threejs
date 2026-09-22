# Product Context

## Why this exists
Started as a single scroll page (`index.html`, still kept as a content/pacing reference)
that had already solved *what to say and in what order*. This tower is a front-end
rebuild of that same content into a walk-around 3D game — the teaching logic is inherited,
not reinvented.

## The five teaching principles (from README — violate these and the lesson breaks)
1. **Audience is general staff, not this field.** No term appears without a plain-language
   explanation the first time.
2. **The spine is evolution, not categorization.** Each floor is framed as "what this layer
   adds on top of the last," and the reason for adding it is always a limitation of the
   previous layer stated in the teacher's own docs — never invented.
3. **Plain language first, jargon second.** Every floor opens with one everyday-language
   sentence before naming the technical term.
4. **Content lives where it belongs.** Don't pile related-but-different material into an
   appendix; fold it into the floor it's actually part of (e.g. neuron-network content was
   folded into floor 3's board, not built as a separate floor).
5. **Always know where you are.** Persistent floor/quest HUD, not something the player has
   to hunt for.

## What "done" looks like per floor
- Learning board with real doc content, opened with **E**
- Guide character with a before-quest and after-quest line set
- A hands-on or watch-it-run mechanic that **demonstrates** the concept rather than just
  describing it
- A closing summary card (term glossary) shown on the second conversation with the guide
- Stage machine wired: `f{N}intro → f{N}quest → f{N}wrap → f{N}done`, any floor visitable
  in any order

## Floor map (current, 6 floors — see `systemPatterns.md` for the mechanism)
| # | Title | Teaches | Mechanic |
|---|---|---|---|
| 1 | AI | Rule-Based, fixed conditions | Vending machine: feed items against 2 rules |
| 2 | Machine Learning | Rules that update from data | Draw a classification boundary, watch it re-fit |
| 3 | Deep Learning | Neural nets find features themselves | Tune Weights + trigger Backpropagation |
| 4 | Generative AI | Generator vs Discriminator | Sculpt a fake, fool the Discriminator 3x |
| 5 | LLM | Predict the next token | 3-phase "word press": token-by-token → Attention → Pretrain/Instruct/RL |
| 6 | Agentic AI | Agentic = Manager, Agent = Engineer | Mission Control: pick one goal, watch Planning → Tool Use → MultiAgent → Reflection run without further input |

Floor 6 is deliberately **not** a minigame — see `activeContext.md` for why (the lesson is
"you decide once, the team finishes it," so making the player operate every step would
teach the opposite lesson).
