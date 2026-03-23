# Parsed — Game Design Document

## Overview
A daily code puzzle game where players swap scrambled pseudocode tokens to fix buggy programs and produce the correct output. One puzzle per day, shared globally — everyone sees the same scramble.

## Core Loop
1. Player sees a scrambled program with a narrative goal (e.g., "A baker uses flour each batch. How many pastries?")
2. Movable tokens (numbers, variable names, operators) are out of place; fixed tokens (keywords, structure) are locked
3. Player swaps tokens to arrange them into working code
4. Pressing "Check" validates: does the code compile, execute, and produce a valid output?
5. On success: score based on swap count vs par, execution animation plays, share card generated

## Puzzle Types
| Type | Code Pattern | Difficulty | Example |
|------|-------------|-----------|---------|
| Arithmetic | `a op b op c` | Medium | Multiply ingredients, add seasoning |
| For loop | `for i = 1 to N { total += k }` | Medium | Bake cookies per batch |
| For + if | `for i { if i > k { total += i } }` | Medium | Only big orders get tips |
| While loop | `while resource > 0 { use resource }` | Medium | Fuel burns each trip |
| While + if | `while resource > 0 { if cond { adjust } }` | Hard | Diver ascends while breathing |
| If/else | `if cond { A } else { B }` | Medium | Enough gold? Buy sword, otherwise save |

## Validation Pipeline
1. **Structural**: Code must compile — valid `let` declarations, balanced braces, declared variables
2. **Execution**: PseudoInterpreter runs the code, captures output and variable states
3. **Return check**: Player must return the correct variable (not a different one)
4. **Multi-output check**: Output compared against `validOutputs` — multiple valid arrangements accepted
5. **No-negatives check**: Variables can't go negative during execution (when solution stays non-negative)
6. **Variable activity check**: Variables that actively change in the solution must take 3+ distinct values in the player's arrangement
7. **Loop-bypass check**: Player's execution must have at least half the steps of the solution (prevents skipping loops)

## Multi-Output System
Different arrangements of swappable numeric literals can produce different but equally valid programs. The generator:
1. Permutes all swappable literals
2. Runs each permutation through the interpreter
3. Rejects any where a variable goes negative
4. Stores all valid outputs as `validOutputs` per puzzle
5. At runtime, any output in this list is accepted — players can share different approaches

## Scoring
- **Par** = minimum swaps needed + 3 (computed from deterministic scramble)
- Par capped at 12 (medium) / 15 (hard) — excess tokens auto-fixed
- Score labels based on swaps vs par:
  - **Genius** (par - 3): Perfect minimum swaps
  - **Hacker** (par - 2)
  - **Optimized** (par - 1)
  - **Compiled** (par): Met par
  - **Verbose** (par + 1)
  - **Spaghetti** (par + 2+)

## Scrambling
- Seeded Fisher-Yates shuffle using `hashString(puzzle.id)` as seed
- Deterministic: all players see the same scramble on the same day
- Generator simulates this exact scramble to compute accurate par

## Execution Animation
- After solving, the code runs step-by-step with 1400ms per step
- Inline value annotations appear above variable names (green numbers)
- Themed scene strip: emoji progress bar driven by the key variable
- Step timeline with prev/next arrows, clickable dots (hidden if >20 steps)
- Clickable step counter — type a number to jump directly to that step
- Skip button jumps to final state with all variables updated
- Tappable lines for post-completion explanations
- Walkthrough button in win modal to re-watch

## Puzzle Generation Architecture
**Theme-centric** — each theme (cooking, combat, diving, etc.) is a first-class concept:
- Themes define bespoke puzzles per code pattern type
- Goal text is hand-written per puzzle to match code logic naturally
- Each theme controls which tokens are swappable
- No generic "plug variable names into template" — narratives are authored, not generated

**Builder functions** produce token arrays from named config dicts:
- Same code skeletons as templates, but explicit named parameters
- Theme authors specify values, goal text, share text, emoji per puzzle

**Quality guards in generator**:
- Par cap with automatic token fixing
- Anti-bypass: return variable init locked when output value is swappable
- while_if template: loop stop condition (0), if-body operator (-), and if-body step value are fixed
- No-negative filtering on valid output permutations

## Sharing
```
Username's Parsed #42 🟢
🏅 Hacker · 8 swaps (8/10)
🔥 12 day streak
https://aschau.github.io/games/parsed/
```
- Theme emoji from shareResult (spoiler-free — no answer values)
- Score label + swap count + par
- Streak shown if 2+ days

## Persistence
- `localStorage` key: `parsed_data` (SAVE_VERSION = 4)
- Tracks: board state, winning solution, first solve swaps, stats, streaks
- After first solve: board stays interactive for replay, score frozen to first attempt
- Restore button snaps back to winning arrangement
- Username in `parsed_username`, theme in `parsed_theme`

## Interpreter
- Supports: `let`, `return`, `while`, `if/else`, `for i = start to end { }` (inclusive range)
- Operator precedence: `* /` before `+ -`, integer division with floor
- Loop safety limits: 100 iterations (while), 50 iterations (for)
- `resolveValue` throws on undeclared variables

## Daily Selection
- 365 puzzles, cycling with `daysSinceEpoch % 365`
- Launch epoch: 2026-03-19
- Puzzles shuffled with seed 42 for even difficulty distribution across the year
