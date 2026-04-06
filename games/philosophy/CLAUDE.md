# Examined

A philosophical alignment quiz. Answer 12 everyday moral dilemmas to discover which school of philosophy you align with most.

## Files
- `index.html` — page structure with start, question, and result screens
- `style.css` — dark theme, responsive, glassmorphic design (also contains about page styles)
- `game.js` — core engine: questions, scoring, screen flow, image capture, sharing, localStorage
- `about.html` — about page with school explainers, alignment compass, spectrum charts, FAQ, credits
- `favicon.svg` — simple SVG favicon
- `og-image.png` — Open Graph social preview image (1200×630)
- `og-image-generator.html` — dev tool to regenerate the OG image (not deployed)
- `LICENSE` — CC BY-NC 4.0

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
- Ties broken deterministically by SCHOOL_KEYS index order

### Archetypes
Keyed by `primary-secondary` school combo. Examples:
- Kantian + Existentialist = "The Principled Rebel"
- Utilitarian + Virtue = "The Compassionate Optimizer"
- Existentialist + Kantian = "The Absurd Knight"

Each has a humorous Good Place-style description.

### UI Flow
1. **Start screen** — title, subtitle, philosopher tags, begin button, Socrates quote
2. **Question screen** — progress bar, scenario label, scenario text, two choices. After choosing: buttons disable, philosopher quote fades in, "Next" button appears. User advances manually.
3. **Result screen** — Philosopher ID card, alignment compass ("Where you fall"), Learn More (expandable school explanations with SEP links), answer breakdown (expandable per-question influence), save/copy/share/retake buttons

### Alignment Compass
CSS-based 2D scatter plot on both the about page and result screen:
- X axis: individual focus ↔ collective focus
- Y axis: rules matter most ↔ outcomes matter most
- School dots positioned at fixed coordinates (`COMPASS_POSITIONS` in game.js)
- Result screen adds a "You" dot at the weighted average of school positions

## Sharing & Image Export
- **Save Image** — html2canvas captures the ID card at 2x scale, triggers PNG download
- **Copy Image** — html2canvas → ClipboardItem (image/png). Falls back to text copy if unsupported.
- **Share as Text** — Native Web Share API with clipboard fallback
- Share text includes emoji bar chart of school percentages

### Dependencies
- `html2canvas` 1.4.1 from cdnjs (SRI hash included)
- Google Fonts: Inter + Playfair Display

## Persistence
`localStorage` key `examined_result`: stores archetype name, raw scores, answer array, and ISO date.

## Adding/Editing Questions
Each question in the `QUESTIONS` array has:
- `label`: short name (e.g., "The White Lie")
- `scenario`: the dilemma text
- `a` / `b`: each with `text` (choice text) and `scores` array `[kantian, utilitarian, virtue, contractualist, existentialist]`
- `quote`: philosopher quote shown after choosing — must be relevant to the question's topic

When adding questions, ensure each choice awards exactly 3 total points (typically 2 to primary school, 1 to secondary) to maintain balanced scoring.

## Privacy
No cookies, no analytics, no external data collection. Results stored only in browser localStorage. html2canvas renders locally — no data sent to any server.
