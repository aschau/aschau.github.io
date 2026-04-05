# Examined

A philosophical alignment quiz. Answer 12 everyday moral dilemmas to discover which school of philosophy you align with most.

## Files
- `index.html` — page structure with start, question, and result screens
- `style.css` — dark theme, responsive, glassmorphic design
- `game.js` — core engine: questions, scoring, radar chart (canvas), screen flow, localStorage
- `share.js` — share text generator with emoji bar and score distribution
- `favicon.svg` — simple SVG favicon

## Game Design

### Schools (5 axes)
- **Kantian** (Immanuel Kant) — duty, universal law, categorical imperative
- **Utilitarian** (John Stuart Mill / Bentham) — greatest good for greatest number
- **Virtue Ethics** (Aristotle) — character, excellence, golden mean
- **Contractualist** (T.M. Scanlon) — fairness, reasonable rejection, social contract
- **Existentialist** (Jean-Paul Sartre) — radical freedom, authenticity, self-determination

### Scoring
- 12 binary-choice questions, each awarding points to 2 schools (primary: 2 pts, secondary: 1 pt)
- Max theoretical score per school varies by question distribution
- Result determined by top two scoring schools → archetype name + description
- 20 unique archetypes (5 primary × 4 secondary combinations) + 1 fallback

### Archetypes
Keyed by `primary-secondary` school combo. Examples:
- Kantian + Existentialist = "The Principled Rebel"
- Utilitarian + Virtue = "The Compassionate Optimizer"
- Existentialist + Kantian = "The Absurd Knight"

Each has a humorous Good Place-style description.

### UI Flow
1. **Start screen** — title, subtitle, philosopher tags, begin button, Socrates quote
2. **Question screen** — progress bar, scenario label, scenario text, two choices, philosopher quote reveal (1.2s delay after choice)
3. **Result screen** — archetype name, description, radar chart (canvas pentagon), score breakdown tags, share/retake buttons

### Radar Chart
Canvas-rendered pentagon with:
- 4 grid rings for scale
- Axis lines to each vertex
- Filled data polygon (purple, 20% opacity)
- Colored dots and labels for each school
- DPI-aware rendering (`devicePixelRatio`)

## Sharing
- Native Web Share API with clipboard fallback
- Share text format:
  ```
  ⚖️📊🌿 I got "The Moral Compass" on Examined!
  
  Top schools:
    Kantian: ████ 4
    Virtue Ethics: ███ 3
    ...
  
  What's your moral philosophy?
  https://www.raggedydoc.com/games/philosophy/
  ```

## Persistence
`localStorage` key `examined_result`: stores archetype name, raw scores, answer array, and ISO date. Used for potential future "retake and compare" feature.

## Adding/Editing Questions
Each question in the `QUESTIONS` array has:
- `label`: short name (e.g., "The White Lie")
- `scenario`: the dilemma text
- `a` / `b`: each with `text` (choice text) and `scores` array `[kantian, utilitarian, virtue, contractualist, existentialist]`
- `quote`: philosopher quote shown after choosing (1.2s reveal)

When adding questions, ensure each choice awards exactly 3 total points (typically 2 to primary school, 1 to secondary) to maintain balanced scoring.
