---
paths:
  - "games/*/generate.py"
  - "games/*/puzzles.js"
  - "games/*/puzzles.json"
---

# Puzzle Generation Rules

- Never edit `puzzles.js` or `puzzles.json` manually — always regenerate via `generate.py`.
- A PostToolUse hook auto-runs `verify_puzzles.py`/`validate.py` after `generate.py` and prompts for narrative review.
- Parsed uses standard operator precedence (* / before + -).
- Return variable names must match what the goal text asks about.
- Numbers mentioned in goal text should correspond to values in the code.
- Bump `SAVE_VERSION` in game.js when puzzle format changes (preserves stats, clears today's board).
