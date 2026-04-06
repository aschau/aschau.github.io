# Examined

A philosophical alignment quiz. Answer 12 everyday moral dilemmas to discover which school of philosophy you align with most.

## Files
- `index.html` — start screen, question screen, result screen (result screen is outside `.game-container` for consistent header/footer)
- `style.css` — dark theme, responsive, glassmorphic design (includes about page, archetypes page, and compass styles)
- `game.js` — core engine: questions, scoring, screen flow, image capture, sharing, localStorage, compass rendering
- `about.html` — about page with school explainers, alignment compass, glance cards, FAQ, credits, and "See Something Wrong?" feedback link to GitHub issues
- `archetypes.html` — all 20 archetypes with filter chips, per-card mini compass, interactive explore compass with Voronoi zones
- `favicon.svg` — simple SVG favicon
- `og-image.png` — Open Graph social preview image (1200x630)
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
Keyed by `primary-secondary` school combo. The archetype name is the hero of the ID card (not just the school). Each has:
- Humorous Good Place-style description
- Shown in card header alongside both school emojis
- "The Mix" section explains how the secondary school modifies the primary

### UI Flow
1. **Start screen** — title, subtitle, philosopher tags, begin button, view last result (if saved), Socrates quote, fixed footer
2. **Question screen** — progress bar, scenario label, scenario text, two choices. After choosing: buttons disable, witty reaction quip appears, philosopher quote fades in, "Next" button appears. User advances manually.
3. **Result screen** — sticky header (Home + Archetypes), Philosopher ID card (archetype-focused), "How does this work?" link, action buttons (Share > Copy Image > Save > Retake), alignment compass, Learn More (expandable school explanations with SEP links), answer breakdown, fixed footer

### Alignment Compass
CSS-based 2D scatter plot on about, results, and archetypes pages:
- X axis: individual focus ↔ collective focus
- Y axis: rules matter most ↔ outcomes matter most
- School dots positioned at fixed coordinates (`COMPASS_POSITIONS` in game.js)
- Result screen adds a "You" dot at the weighted average
- Archetypes page has interactive explore compass with Voronoi zone highlighting
- All compasses include disclaimer: "Approximate positions — real philosophy is messier than a 2D chart."

### Archetypes Page
- Sticky header with back nav + "Take quiz" CTA
- Horizontal filter chips by school (scrollable on mobile)
- Interactive explore compass: tap anywhere to find the nearest archetype using nearest-neighbor over 20 pre-computed positions. Canvas overlay draws soft gradient zones (distance-based opacity fade at boundaries).
- Per-card expandable "Where on the compass" toggle that lazily builds a mini compass
- Fixed footer

### Philosopher Profiles (ID Card)
Each school has a full profile used on the ID card:
- Icon, motto, strengths, weaknesses, catchphrases
- Peer reviews from other philosophers
- Hidden talent
- "Your Philosopher At..." scenarios (coffee, party, argument)
- Compatibility (best with / avoid)

### Reaction Quips
Each question choice has a `react` property — a witty one-liner shown immediately after choosing, before the philosopher quote fades in. These add personality to the quiz flow.

## Sharing & Image Export
- **Platform detection**: `isIOS` (UA + iPad check), `isMobile` (iOS or Android). Defined *before* `captureCard()` so the values are initialized when the function runs.
- **`captureCard()`**: Waits for `document.fonts.ready` (custom @font-face fonts must load before html2canvas can render them), then strips `background-clip: text` gradient CSS, captures via html2canvas, and restores. Scale is 1x on mobile (iOS canvas memory limits) and 2x on desktop. Uses `allowTaint: true` for font/resource compatibility.
- **Share** (primary button):
  - **Mobile** (iOS/Android) — calls `navigator.share({ title, text, url })` synchronously in the click handler (same pattern as Parsed/Beamlab). No image generation — async html2canvas loses the user gesture context on iOS, causing silent failure.
  - **Desktop** (Windows/Mac/Linux) — copies ID card image to clipboard via `ClipboardItem`. Falls back to copying text + quiz link.
- **Copy Image** — captures card, copies to clipboard as PNG. Falls back to text.
- **Save Image**:
  - **Mobile** (iOS/Android) — opens native share sheet via Web Share API so users can save to Photos (not Files). iOS toast hints "Use Save Image to add to Photos". If capture fails, shows "Try a screenshot instead!" toast.
  - **Desktop** — triggers PNG download via blob URL.

### Dependencies
- `html2canvas` 1.4.1 from cdnjs (SRI hash included)
- Self-hosted fonts: Inter, JetBrains Mono, Playfair Display (via `../../fonts/fonts.css`)

## Persistence
`localStorage` key `examined_result`: stores archetype name, raw scores, answer array, and ISO date. Start screen shows "View Last Result" button if saved data exists.

## Page Structure
The result screen is a **sibling** of `.game-container`, not a child. This matches the about/archetypes page structure so sticky headers and footers work identically:
```
<body>
  <div class="game-container">  ← start + question screens
  <div id="result-screen">      ← result screen (hidden by default)
    <div class="arch-header">   ← sticky header
    <div class="result-content"> ← content container
    <div class="arch-footer">   ← footer
```
`showScreen()` hides `.game-container` when result screen is active.

## Adding/Editing Questions
Each question in the `QUESTIONS` array has:
- `label`: short name (e.g., "The White Lie")
- `scenario`: the dilemma text
- `a` / `b`: each with `text` (choice text), `scores` array `[kantian, utilitarian, virtue, contractualist, existentialist]`, and `react` (witty reaction quip)
- `quote`: philosopher quote shown after choosing — must be relevant to the question's topic

When adding questions, ensure each choice awards exactly 3 total points (typically 2 to primary school, 1 to secondary) to maintain balanced scoring.

## Privacy
No cookies, no analytics, no external data collection. Results stored only in browser localStorage. html2canvas renders locally — no data sent to any server. Fonts are self-hosted (no Google Fonts requests). Only external CDN request is html2canvas from cdnjs.cloudflare.com (static file with SRI verification).
