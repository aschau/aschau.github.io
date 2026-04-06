// ============================================
// Beamlab — Testable Engine Logic
// Pure functions extracted from game.js for unit testing.
// Browser code (game.js) keeps its own copies inside the IIFE;
// this module is the canonical reference for tests.
// ── Keep in sync with games/beamlab/game.js ──
// ============================================

'use strict';

const GRID_SIZE = 6;

const DIRECTIONS = {
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 }
};

const FWD_REFLECT = { right: 'up', left: 'down', up: 'right', down: 'left' };
const BCK_REFLECT = { right: 'down', left: 'up', up: 'left', down: 'right' };

const EDGE_ENTRY_DIR = { left: 'right', right: 'left', top: 'down', bottom: 'up' };

const PIECE_TYPES = ['fwd', 'bck', 'split_fwd', 'split_bck'];
function isPiece(val) { return PIECE_TYPES.includes(val); }
function isMirror(val) { return val === 'fwd' || val === 'bck'; }
function isSplitter(val) { return val === 'split_fwd' || val === 'split_bck'; }
function invKey(type) { return isSplitter(type) ? 'split' : type; }

function getEntryCell(source) {
    const dir = EDGE_ENTRY_DIR[source.edge];
    let r, c;
    switch (source.edge) {
        case 'top':    r = 0; c = source.pos; break;
        case 'bottom': r = GRID_SIZE - 1; c = source.pos; break;
        case 'left':   r = source.pos; c = 0; break;
        case 'right':  r = source.pos; c = GRID_SIZE - 1; break;
    }
    return { r, c, dir };
}

/**
 * Trace the laser beam through a grid, returning which cells are hit
 * and which targets are reached. Pure function — no DOM dependencies.
 *
 * Combines the logic of three game.js functions:
 *   - traceLaser()           — beam physics, BFS for splitters, visited set
 *   - checkTargetHit(r, c)   — exit-edge target matching
 *   - updateLaserActiveCells() — gem collection check over laserPath
 *
 * @param {object} puzzle - { source, targets, walls, fixed, gem }
 * @param {Array<Array<string|null>>} grid - 6x6 grid of cell contents
 * @returns {{ laserPath: Array<{r,c}>, targetsHit: boolean[], gemCollected: boolean }}
 */
function traceBeam(puzzle, grid) {
    const laserPath = [];
    const targetsHit = puzzle.targets.map(() => false);
    let gemCollected = false;

    const entry = getEntryCell(puzzle.source);
    const globalVisited = new Set();

    const beamQueue = [{ r: entry.r, c: entry.c, dir: entry.dir }];

    while (beamQueue.length > 0) {
        const beam = beamQueue.shift();
        let { r, c, dir } = beam;
        let maxSteps = 150;

        while (maxSteps-- > 0) {
            if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) {
                // Check target hit at exit
                let exitEdge, exitPos;
                if (r < 0) { exitEdge = 'top'; exitPos = c; }
                else if (r >= GRID_SIZE) { exitEdge = 'bottom'; exitPos = c; }
                else if (c < 0) { exitEdge = 'left'; exitPos = r; }
                else if (c >= GRID_SIZE) { exitEdge = 'right'; exitPos = r; }

                for (let t = 0; t < puzzle.targets.length; t++) {
                    if (puzzle.targets[t].edge === exitEdge && puzzle.targets[t].pos === exitPos) {
                        targetsHit[t] = true;
                    }
                }
                break;
            }

            const key = r + ',' + c + ',' + dir;
            if (globalVisited.has(key)) break;
            globalVisited.add(key);

            const cellContent = grid[r][c];

            if (cellContent === 'wall') {
                laserPath.push({ r, c });
                break;
            }

            laserPath.push({ r, c });

            // Check gem
            if (puzzle.gem && puzzle.gem.r === r && puzzle.gem.c === c) {
                gemCollected = true;
            }

            if (isSplitter(cellContent)) {
                const reflectTable = cellContent === 'split_fwd' ? FWD_REFLECT : BCK_REFLECT;
                const reflectedDir = reflectTable[dir];
                const reflR = r + DIRECTIONS[reflectedDir].dr;
                const reflC = c + DIRECTIONS[reflectedDir].dc;
                beamQueue.push({ r: reflR, c: reflC, dir: reflectedDir });
                // Original beam continues straight
            } else if (isMirror(cellContent)) {
                const reflectTable = cellContent === 'fwd' ? FWD_REFLECT : BCK_REFLECT;
                dir = reflectTable[dir];
            }

            r += DIRECTIONS[dir].dr;
            c += DIRECTIONS[dir].dc;
        }
    }

    return { laserPath, targetsHit, gemCollected };
}

function getScoreLabel(used, par) {
    const diff = used - par;
    if (diff <= -1) return 'Brilliant! (' + used + ' pieces)';
    if (diff === 0) return 'Focused (' + used + ' pieces)';
    if (diff === 1) return 'Aligned (' + used + ' pieces)';
    if (diff === 2) return 'Scattered (' + used + ' pieces)';
    return 'Refracted +' + (diff - 2) + ' (' + used + ' pieces)';
}

function countPiecesUsed(grid, fixedCells) {
    let count = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (isPiece(grid[r][c]) && !fixedCells.has(r + ',' + c)) count++;
        }
    }
    return count;
}

/**
 * Build a 6x6 grid from puzzle data plus user-placed pieces.
 * @param {object} puzzle - puzzle definition
 * @param {Array<{r,c,type}>} placements - user-placed pieces
 * @returns {{ grid: Array<Array<string|null>>, fixedCells: Set<string> }}
 */
function buildGrid(puzzle, placements) {
    const grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = null;
        }
    }

    for (const wall of puzzle.walls) {
        grid[wall.r][wall.c] = 'wall';
    }

    const fixedCells = new Set();
    if (puzzle.fixed) {
        for (const f of puzzle.fixed) {
            const ftype = f.type === 'split' ? 'split_fwd' : f.type;
            grid[f.r][f.c] = ftype;
            fixedCells.add(f.r + ',' + f.c);
        }
    }

    if (placements) {
        for (const p of placements) {
            grid[p.r][p.c] = p.type;
        }
    }

    return { grid, fixedCells };
}

module.exports = {
    GRID_SIZE,
    DIRECTIONS,
    FWD_REFLECT,
    BCK_REFLECT,
    EDGE_ENTRY_DIR,
    PIECE_TYPES,
    isPiece,
    isMirror,
    isSplitter,
    invKey,
    getEntryCell,
    traceBeam,
    getScoreLabel,
    countPiecesUsed,
    buildGrid,
};
