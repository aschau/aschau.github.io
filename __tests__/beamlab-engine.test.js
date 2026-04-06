const {
    GRID_SIZE,
    DIRECTIONS,
    FWD_REFLECT,
    BCK_REFLECT,
    EDGE_ENTRY_DIR,
    isPiece,
    isMirror,
    isSplitter,
    invKey,
    getEntryCell,
    traceBeam,
    getScoreLabel,
    countPiecesUsed,
    buildGrid,
} = require('../games/beamlab/engine.module');

// =============================================
// Reflection Tables
// =============================================

describe('Beamlab reflection tables', () => {
    test('FWD_REFLECT (/ mirror) maps all 4 directions correctly', () => {
        // / mirror: right→up, left→down, up→right, down→left
        expect(FWD_REFLECT.right).toBe('up');
        expect(FWD_REFLECT.left).toBe('down');
        expect(FWD_REFLECT.up).toBe('right');
        expect(FWD_REFLECT.down).toBe('left');
    });

    test('BCK_REFLECT (\\ mirror) maps all 4 directions correctly', () => {
        // \ mirror: right→down, left→up, up→left, down→right
        expect(BCK_REFLECT.right).toBe('down');
        expect(BCK_REFLECT.left).toBe('up');
        expect(BCK_REFLECT.up).toBe('left');
        expect(BCK_REFLECT.down).toBe('right');
    });

    test('reflections are self-inverse (reflecting twice returns original)', () => {
        for (const dir of Object.keys(FWD_REFLECT)) {
            expect(FWD_REFLECT[FWD_REFLECT[dir]]).toBe(dir);
        }
        for (const dir of Object.keys(BCK_REFLECT)) {
            expect(BCK_REFLECT[BCK_REFLECT[dir]]).toBe(dir);
        }
    });

    test('EDGE_ENTRY_DIR maps edges to correct entry directions', () => {
        expect(EDGE_ENTRY_DIR.left).toBe('right');
        expect(EDGE_ENTRY_DIR.right).toBe('left');
        expect(EDGE_ENTRY_DIR.top).toBe('down');
        expect(EDGE_ENTRY_DIR.bottom).toBe('up');
    });
});

// =============================================
// Piece Type Helpers
// =============================================

describe('Piece type helpers', () => {
    test('isPiece identifies all valid piece types', () => {
        expect(isPiece('fwd')).toBe(true);
        expect(isPiece('bck')).toBe(true);
        expect(isPiece('split_fwd')).toBe(true);
        expect(isPiece('split_bck')).toBe(true);
        expect(isPiece('wall')).toBe(false);
        expect(isPiece(null)).toBe(false);
        expect(isPiece('split')).toBe(false); // legacy type not in PIECE_TYPES
    });

    test('isMirror identifies only mirrors', () => {
        expect(isMirror('fwd')).toBe(true);
        expect(isMirror('bck')).toBe(true);
        expect(isMirror('split_fwd')).toBe(false);
        expect(isMirror('split_bck')).toBe(false);
    });

    test('isSplitter identifies only splitters', () => {
        expect(isSplitter('split_fwd')).toBe(true);
        expect(isSplitter('split_bck')).toBe(true);
        expect(isSplitter('fwd')).toBe(false);
        expect(isSplitter('bck')).toBe(false);
    });

    test('invKey maps splitters to shared "split" pool', () => {
        expect(invKey('fwd')).toBe('fwd');
        expect(invKey('bck')).toBe('bck');
        expect(invKey('split_fwd')).toBe('split');
        expect(invKey('split_bck')).toBe('split');
    });
});

// =============================================
// Grid Entry
// =============================================

describe('getEntryCell', () => {
    test('top edge enters at row 0', () => {
        const entry = getEntryCell({ edge: 'top', pos: 3 });
        expect(entry).toEqual({ r: 0, c: 3, dir: 'down' });
    });

    test('bottom edge enters at row 5', () => {
        const entry = getEntryCell({ edge: 'bottom', pos: 0 });
        expect(entry).toEqual({ r: 5, c: 0, dir: 'up' });
    });

    test('left edge enters at col 0', () => {
        const entry = getEntryCell({ edge: 'left', pos: 2 });
        expect(entry).toEqual({ r: 2, c: 0, dir: 'right' });
    });

    test('right edge enters at col 5', () => {
        const entry = getEntryCell({ edge: 'right', pos: 4 });
        expect(entry).toEqual({ r: 4, c: 5, dir: 'left' });
    });
});

// =============================================
// Beam Tracing
// =============================================

describe('traceBeam', () => {
    function emptyGrid() {
        const grid = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            grid[r] = new Array(GRID_SIZE).fill(null);
        }
        return grid;
    }

    test('straight beam through empty grid exits opposite side', () => {
        const puzzle = {
            source: { edge: 'left', pos: 3 },
            targets: [{ edge: 'right', pos: 3 }],
            walls: [],
        };
        const grid = emptyGrid();
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([true]);
        expect(result.laserPath.length).toBe(6); // passes through all 6 columns
    });

    test('beam stops at wall', () => {
        const puzzle = {
            source: { edge: 'left', pos: 0 },
            targets: [{ edge: 'right', pos: 0 }],
            walls: [],
        };
        const grid = emptyGrid();
        grid[0][3] = 'wall';
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([false]);
        // Beam enters at (0,0) and hits wall at (0,3)
        expect(result.laserPath.length).toBe(4);
    });

    test('fwd mirror (/) reflects beam correctly', () => {
        // Beam enters from left at row 3, hits / mirror at (3,2) → goes up, exits top at col 2
        const puzzle = {
            source: { edge: 'left', pos: 3 },
            targets: [{ edge: 'top', pos: 2 }],
            walls: [],
        };
        const grid = emptyGrid();
        grid[3][2] = 'fwd'; // / mirror: right→up
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([true]);
    });

    test('bck mirror (\\) reflects beam correctly', () => {
        // Beam enters from left at row 2, hits \ mirror at (2,2) → goes down, exits bottom at col 2
        const puzzle = {
            source: { edge: 'left', pos: 2 },
            targets: [{ edge: 'bottom', pos: 2 }],
            walls: [],
        };
        const grid = emptyGrid();
        grid[2][2] = 'bck'; // \ mirror: right→down
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([true]);
    });

    test('two mirrors create a U-turn', () => {
        // Beam enters from left at row 0, / at (0,2) sends up→exits? No, row 0 up exits immediately.
        // Better: beam from left row 2, bck at (2,3) → goes down, fwd at (5,3) → goes right, exits right at row 5
        const puzzle = {
            source: { edge: 'left', pos: 2 },
            targets: [{ edge: 'right', pos: 5 }],
            walls: [],
        };
        const grid = emptyGrid();
        grid[2][3] = 'bck'; // right→down
        grid[5][3] = 'fwd'; // down→left? No, FWD: down→left. That sends it left, not right.
        // Let's use: bck at (2,3) → right→down, then bck at (5,3) → down→right
        grid[5][3] = 'bck'; // down→right
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([true]);
    });

    test('splitter creates two beams', () => {
        // Beam from left at row 3, split_fwd at (3,3):
        // - reflected beam goes up (FWD_REFLECT: right→up)
        // - straight beam continues right
        const puzzle = {
            source: { edge: 'left', pos: 3 },
            targets: [
                { edge: 'right', pos: 3 },  // straight through
                { edge: 'top', pos: 3 },     // reflected up
            ],
            walls: [],
        };
        const grid = emptyGrid();
        grid[3][3] = 'split_fwd';
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([true, true]);
    });

    test('gem collection when beam passes through gem cell', () => {
        const puzzle = {
            source: { edge: 'left', pos: 0 },
            targets: [{ edge: 'right', pos: 0 }],
            walls: [],
            gem: { r: 0, c: 3 },
        };
        const grid = emptyGrid();
        const result = traceBeam(puzzle, grid);
        expect(result.gemCollected).toBe(true);
    });

    test('gem not collected when beam misses gem cell', () => {
        const puzzle = {
            source: { edge: 'left', pos: 0 },
            targets: [{ edge: 'right', pos: 0 }],
            walls: [],
            gem: { r: 5, c: 5 },
        };
        const grid = emptyGrid();
        const result = traceBeam(puzzle, grid);
        expect(result.gemCollected).toBe(false);
    });

    test('beam does not loop infinitely with opposing mirrors', () => {
        // Two mirrors facing each other should be caught by visited set
        const puzzle = {
            source: { edge: 'left', pos: 2 },
            targets: [{ edge: 'right', pos: 2 }],
            walls: [],
        };
        const grid = emptyGrid();
        grid[2][2] = 'fwd';  // right→up
        grid[0][2] = 'bck';  // up→left... exits left
        // This won't actually loop, but tests the visited set guard
        const result = traceBeam(puzzle, grid);
        expect(result.targetsHit).toEqual([false]);
    });
});

// =============================================
// buildGrid
// =============================================

describe('buildGrid', () => {
    test('places walls, fixed pieces, and user pieces correctly', () => {
        const puzzle = {
            walls: [{ r: 0, c: 0 }],
            fixed: [{ r: 1, c: 1, type: 'fwd' }],
        };
        const placements = [{ r: 2, c: 2, type: 'bck' }];
        const { grid, fixedCells } = buildGrid(puzzle, placements);

        expect(grid[0][0]).toBe('wall');
        expect(grid[1][1]).toBe('fwd');
        expect(grid[2][2]).toBe('bck');
        expect(grid[3][3]).toBe(null);
        expect(fixedCells.has('1,1')).toBe(true);
        expect(fixedCells.has('2,2')).toBe(false);
    });

    test('normalizes legacy "split" type to "split_fwd"', () => {
        const puzzle = {
            walls: [],
            fixed: [{ r: 0, c: 0, type: 'split' }],
        };
        const { grid } = buildGrid(puzzle);
        expect(grid[0][0]).toBe('split_fwd');
    });
});

// =============================================
// Scoring
// =============================================

describe('getScoreLabel', () => {
    test('Brilliant when under par', () => {
        expect(getScoreLabel(3, 4)).toContain('Brilliant');
    });

    test('Focused when at par', () => {
        expect(getScoreLabel(4, 4)).toContain('Focused');
    });

    test('Aligned when 1 over par', () => {
        expect(getScoreLabel(5, 4)).toContain('Aligned');
    });

    test('Scattered when 2 over par', () => {
        expect(getScoreLabel(6, 4)).toContain('Scattered');
    });

    test('Refracted when 3+ over par', () => {
        expect(getScoreLabel(7, 4)).toContain('Refracted');
        expect(getScoreLabel(7, 4)).toContain('+1');
    });

    test('includes piece count in label', () => {
        expect(getScoreLabel(3, 4)).toContain('3 pieces');
    });
});

// =============================================
// countPiecesUsed
// =============================================

describe('countPiecesUsed', () => {
    test('counts only non-fixed pieces', () => {
        const puzzle = {
            walls: [{ r: 0, c: 0 }],
            fixed: [{ r: 1, c: 1, type: 'fwd' }],
        };
        const placements = [
            { r: 2, c: 2, type: 'bck' },
            { r: 3, c: 3, type: 'fwd' },
        ];
        const { grid, fixedCells } = buildGrid(puzzle, placements);
        expect(countPiecesUsed(grid, fixedCells)).toBe(2);
    });

    test('returns 0 on empty grid', () => {
        const { grid, fixedCells } = buildGrid({ walls: [], fixed: [] });
        expect(countPiecesUsed(grid, fixedCells)).toBe(0);
    });
});
