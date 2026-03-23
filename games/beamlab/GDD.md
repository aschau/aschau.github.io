# Beamlab — Game Design Document

## Overview
A daily laser puzzle game on a 6x6 grid. Players place mirrors and beam splitters to guide a laser from its source to all target exits. One puzzle per day, shared globally.

## Core Loop
1. Player sees a 6x6 grid with a laser source on one edge, target(s) on other edge(s), walls, and pre-placed fixed mirrors
2. Using a limited inventory of mirrors and splitters, route the laser beam to hit all targets
3. Laser traces in real-time as pieces are placed — immediate visual feedback
4. Win when all targets are hit; score based on pieces used vs par

## Pieces
| Piece | Symbol | Behavior |
|-------|--------|----------|
| Forward mirror | `/` | Reflects beam 90°: right→up, left→down, up→right, down→left |
| Backward mirror | `\` | Reflects beam 90°: right→down, left→up, up→left, down→right |
| Forward splitter | `X` (/ emphasized) | Splits beam in two: one reflects like `/`, one continues straight |
| Backward splitter | `X` (\ emphasized) | Splits beam in two: one reflects like `\`, one continues straight |
| Fixed mirror | Gold `/` or `\` | Pre-placed with lock icon, cannot be moved or removed |
| Wall | Black square | Blocks the laser, cannot be modified |

**Splitter rotation**: Forward and backward splitters share a single inventory pool. Clicking a placed splitter rotates between orientations for free.

## Laser Tracing
- Breadth-first search handles multiple beams from splitters
- Each beam traces from source/splitter through mirrors until exiting the grid or hitting a wall
- 100-step max per beam prevents infinite loops
- Visited cell tracking prevents re-entry loops
- Splitters spawn two beams: one reflected, one straight-through
- Animated SVG visualization with glowing beam effect and draw-in animation

## Scoring
- **Par** = solver's minimum pieces + 1
- Score labels based on pieces used vs par:
  - **Brilliant** (par - 1 or fewer): Under par
  - **Focused** (par): Met par exactly
  - **Aligned** (par + 1)
  - **Scattered** (par + 2)
  - **Refracted** (par + 3+)
- Only player-placed pieces count (fixed pieces excluded)
- Score frozen to first solve — replaying doesn't change it

## Gem System
- Optional collectible placed adjacent to the beam path
- Requires routing the laser through its cell — not on the direct solution path
- Frozen after first solve (collected or not)
- Tracked globally in stats (total gems across all puzzles)
- Shown in share text only if collected

## Puzzle Generation
**Walls-first approach**:
1. Place 4-7 structured maze-like walls (corridors, barriers, scattered)
2. Pick random entry edge and position for laser source
3. Build beam path via recursive backtracking through open cells
4. Exit points become targets
5. Select 1-2 mirrors from solution as fixed pieces (with safety validation)
6. Run full solver to find actual minimum piece count
7. Place gem adjacent to beam path (optional, verified solvable without it)

**Fixed piece safety**: Each fixed mirror is individually verified to NOT route the beam to any target on its own. Prevents trivial puzzles.

**Difficulty distribution** (of 365 puzzles):
| Difficulty | % | Mirrors | Walls | Fixed | Min Player Pieces |
|-----------|---|---------|-------|-------|-------------------|
| Medium | 20% | 3-4 | 4-6 | 1 | 3 |
| Hard | 45% | 4-6 | 4-7 | 1 | 4 |
| Expert | 35% | 5-7 | 4-6 | 1-2 | 4 |

**Splitter puzzles**: 25% of all puzzles include a splitter, creating two beam branches with unique targets each.

**Generation commands**:
- `python generate.py [count] [seed]` — Fresh generation
- `python generate.py --patch [seed]` — Keep valid, replace bad
- `python generate.py --regenerate-future [seed]` — Keep played puzzles, regenerate future (multiprocessing, ~90s on 24 threads)

## Interactions
| Action | Desktop | Mobile |
|--------|---------|--------|
| Place/rotate piece | Left click cell | Tap cell |
| Remove piece | Right click cell | Double tap |
| Select piece type | Click inventory button | Tap inventory button |

- Auto-switch: if selected piece type runs out, auto-selects next available type
- Undo: reverts last placement/removal
- Reset: clears all player-placed pieces
- Restore: appears after first solve, snaps board back to winning arrangement

## Sharing
```
Username's Beamlab #42 ⚡
Focused (5/5) 💎
🔒 1 fixed · 🎯 2 targets · 🧱 5 walls
🔥 7 day streak
https://aschau.github.io/games/beamlab/
```
- Puzzle info line is spoiler-free (piece counts, not positions)
- Gem shown only if collected on first solve
- Streak shown if 2+ days
- Native Web Share API with clipboard fallback

## Persistence
- `localStorage` key: `beamlab_data` (SAVE_VERSION = 12)
- **Daily state**: date, puzzle number, solved/everSolved flags, placed mirrors array, best score, first solve score, gem status, winning solution, par
- **Stats**: played, solved, current/max streak, total gems, score distribution
- **Streak logic**: increments if last completed = yesterday, resets if gap
- **Revisit protection**: if already solved today, restore winning solution on page load (prevents streak replay)
- Username in `beamlab_username`

## Visual Design
- Dark glassmorphism theme (default) with light mode toggle
- Blue accent color (#6478ff) for laser beams and highlights
- Glowing laser beam with SVG drop-shadow animation
- Target pulse animation until hit (opacity 0.6→1, 2s cycle)
- Draw-beam animation on laser path (0.5s ease-out stroke reveal)
- Fixed pieces shown in gold with lock icon
- Responsive layout (600px max-width, mobile-optimized)
- Xolonium font for header

## Daily Selection
- 365 puzzles stored in puzzles.json, compiled to puzzles.js
- Launch epoch: 2026-03-17
- `getDailyPuzzleIndex()`: `daysSinceEpoch % 365`
- Deterministic: all players get the same puzzle each day

## Architecture
| File | Purpose |
|------|---------|
| `game.js` | Game engine, state management, laser tracing, UI |
| `puzzles.js` | Auto-generated puzzle data + daily selection |
| `puzzles.json` | Raw puzzle JSON (source of truth) |
| `share.js` | Share text generation |
| `generate.py` | Puzzle generator with wall-first pipeline |
| `validate.py` | Solver + validator (backtracking with beam-aware pruning) |
| `style.css` | Glassmorphism styling, animations, responsive layout |

## Known Issues & History
- **Fixed (2026-03-20)**: Some puzzles trivially solvable — fixed mirrors alone could hit targets. Generator now validates fixed pieces individually.
- **Fixed (2026-03-21)**: Share text showed wrong score after board reset. Added `firstSolveScore` to freeze score at first solve.
- **Added (2026-03-21)**: Rotatable splitters with two orientations sharing single inventory pool. Performance fixed with inventory-based pruning in solver.
- **Fixed (2026-03-21)**: Revisit protection — winning state restored on page reload to prevent streak replay.
