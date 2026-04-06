# SnapLayout

A free, mobile-friendly room layout planner. Import a floorplan image or draw rooms from scratch, set scale, and drag furniture with real dimensions.

## Files
- `index.html`, `style.css`, `app.js` (core engine), `conversions.module.js` (testable pure logic — keep in sync with app.js), `furniture.js` (furniture library data)

## Tech
- Fabric.js (CDN) for canvas manipulation (drag, rotate, resize, select, serialize, export)
- Internal unit: inches. Display: feet, inches, cm, meters via unit selector.
- Furniture library: 6 categories (Structure, Living Room, Bedroom, Dining, Kitchen, Bathroom). Items have optional `shape: 'circle'` and `style: 'room'|'door'|'window'`.

## Key Features
- Image import: file upload, drag & drop, clipboard paste, URL input
- Scale calibration: draw line between known points, enter real distance
- Wall drawing: click to place points, double-click to finish
- Z-ordering: grid → floorplan → rooms → furniture/doors/windows
- Undo/redo (50-state stack), Ctrl+Z/Y
- Export PNG at 2x resolution

## Persistence
`localStorage` key `snaplayout_data` (debounced 1s). `SAVE_VERSION` for migrations.
Theme in `snaplayout_theme`.

## Keyboard Shortcuts
V (select), H (pan), W (wall), R (scale), G (grid), S (snap), Delete, Ctrl+Z/Y, Ctrl+D (duplicate), arrows (nudge), Escape.
