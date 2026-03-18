// ============================================
// Redirect — Core Game Engine
// Supports mirrors (/ \) and beam splitters
// ============================================

(function () {
    'use strict';

    const SAVE_VERSION = 11; // bump this when puzzle format changes to clear stale data
    const GRID_SIZE = 6;
    const SVG_SIZE = 600; // viewBox
    const CELL_SVG = SVG_SIZE / GRID_SIZE; // 100

    const DIRECTIONS = {
        up: { dr: -1, dc: 0 },
        down: { dr: 1, dc: 0 },
        left: { dr: 0, dc: -1 },
        right: { dr: 0, dc: 1 }
    };

    // Mirror reflection tables
    const FWD_REFLECT = { right: 'up', left: 'down', up: 'right', down: 'left' };
    const BCK_REFLECT = { right: 'down', left: 'up', up: 'left', down: 'right' };

    // Splitter: reflects one direction AND passes through
    // A splitter acts like a / mirror but also lets the beam continue straight
    const SPLIT_REFLECT = FWD_REFLECT; // reflected direction (same as / mirror)

    const EDGE_ENTRY_DIR = { left: 'right', right: 'left', top: 'down', bottom: 'up' };

    // Piece types
    const PIECE_TYPES = ['fwd', 'bck', 'split'];
    function isPiece(val) { return PIECE_TYPES.includes(val); }
    function isMirror(val) { return val === 'fwd' || val === 'bck'; }

    // --- Game State ---
    let puzzle = null;
    let grid = [];
    let inventory = { fwd: 0, bck: 0, split: 0 };
    let laserPath = [];       // [{r, c}] all cells any beam touches
    let targetsHit = [];
    let gemCollected = false;  // whether laser passed through the gem cell
    let solved = false;
    let moveHistory = [];
    let puzzleNumber = 0;
    let fixedCells = new Set();  // cells with pre-placed mirrors (can't be moved)
    let selectedMirrorType = 'fwd';

    // --- DOM refs ---
    const gridContainer = document.getElementById('grid-container');
    const laserSvg = document.getElementById('laser-svg');
    const edgeTop = document.getElementById('edge-top');
    const edgeRight = document.getElementById('edge-right');
    const edgeBottom = document.getElementById('edge-bottom');
    const edgeLeft = document.getElementById('edge-left');
    const invFwdCount = document.getElementById('inv-fwd-count');
    const invBckCount = document.getElementById('inv-bck-count');
    const invSplitCount = document.getElementById('inv-split-count');
    const invFwdBtn = document.getElementById('inv-fwd');
    const invBckBtn = document.getElementById('inv-bck');
    const invSplitBtn = document.getElementById('inv-split');
    const parValue = document.getElementById('par-value');
    const mirrorsUsedEl = document.getElementById('mirrors-used');
    const undoBtn = document.getElementById('undo-btn');
    const resetBtn = document.getElementById('reset-btn');
    const shareBtn = document.getElementById('share-btn');
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const helpClose = document.getElementById('help-close');
    const winModal = document.getElementById('win-modal');
    const winClose = document.getElementById('win-close');
    const winTitle = document.getElementById('win-title');
    const winPuzzle = document.getElementById('win-puzzle');
    const winScore = document.getElementById('win-score');
    const winStreak = document.getElementById('win-streak');
    const winShareBtn = document.getElementById('win-share-btn');
    const shareCopied = document.getElementById('share-copied');
    const puzzleNumberEl = document.getElementById('puzzle-number');
    const puzzleDateEl = document.getElementById('puzzle-date');

    // =============================================
    // Initialization
    // =============================================

    function init() {
        puzzle = getDailyPuzzle();
        puzzleNumber = getDailyPuzzleNumber();

        puzzleNumberEl.textContent = 'Puzzle #' + puzzleNumber;
        puzzleDateEl.textContent = getTodayDateString();
        parValue.textContent = puzzle.par;

        grid = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            grid[r] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                grid[r][c] = null;
            }
        }

        for (const wall of puzzle.walls) {
            grid[wall.r][wall.c] = 'wall';
        }

        // Place fixed (pre-placed) mirrors — part of the puzzle, can't be moved
        fixedCells = new Set();
        if (puzzle.fixed) {
            for (const f of puzzle.fixed) {
                grid[f.r][f.c] = f.type;
                fixedCells.add(f.r + ',' + f.c);
            }
        }

        inventory = { fwd: 0, bck: 0, split: 0, ...puzzle.inventory };

        solved = false;
        gemCollected = false;
        moveHistory = [];
        targetsHit = puzzle.targets.map(() => false);

        // Hide splitter inventory if puzzle has none
        const splitSection = document.getElementById('inv-split-section');
        if (splitSection) {
            splitSection.style.display = (puzzle.inventory.split || 0) > 0 ? '' : 'none';
        }

        if (!restoreState()) {
            // Fresh game
        }

        // Update SVG viewBox to match grid
        laserSvg.setAttribute('viewBox', '0 0 ' + SVG_SIZE + ' ' + SVG_SIZE);

        renderGrid();
        renderEdgeIndicators();
        traceLaser();
        updateInventoryUI();
        updateButtons();
        updateStatsDisplay();
        setupEventListeners();

        if (solved) {
            shareBtn.disabled = false;
        }

        // Show quick controls for first-time visitors
        if (!localStorage.getItem('beamlab_seen_controls')) {
            var controlsModal = document.getElementById('controls-modal');
            if (controlsModal) controlsModal.hidden = false;
            localStorage.setItem('beamlab_seen_controls', '1');
        }
    }

    // =============================================
    // Grid Rendering
    // =============================================

    function renderGrid() {
        gridContainer.innerHTML = '';
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;

                if (grid[r][c] === 'wall') {
                    cell.classList.add('wall');
                } else if (isPiece(grid[r][c])) {
                    addPieceVisual(cell, grid[r][c]);
                    if (fixedCells.has(r + ',' + c)) {
                        cell.classList.add('fixed');
                    }
                }

                // Add gem indicator if this cell has one
                if (puzzle.gem && puzzle.gem.r === r && puzzle.gem.c === c) {
                    var gemEl = document.createElement('span');
                    gemEl.className = 'gem-icon';
                    gemEl.id = 'gem-icon';
                    gemEl.textContent = '\uD83D\uDC8E';
                    cell.appendChild(gemEl);
                    cell.classList.add('gem-cell');
                }

                gridContainer.appendChild(cell);
            }
        }
    }

    function addPieceVisual(cell, type) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('mirror-line');
        svg.setAttribute('viewBox', '0 0 100 100');

        if (type === 'fwd') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '15'); line.setAttribute('y1', '85');
            line.setAttribute('x2', '85'); line.setAttribute('y2', '15');
            svg.appendChild(line);
        } else if (type === 'bck') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '15'); line.setAttribute('y1', '15');
            line.setAttribute('x2', '85'); line.setAttribute('y2', '85');
            svg.appendChild(line);
        } else if (type === 'split') {
            // Splitter: X shape (cross of both diagonals)
            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', '15'); line1.setAttribute('y1', '85');
            line1.setAttribute('x2', '85'); line1.setAttribute('y2', '15');
            line1.classList.add('split-line');
            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', '15'); line2.setAttribute('y1', '15');
            line2.setAttribute('x2', '85'); line2.setAttribute('y2', '85');
            line2.classList.add('split-line');
            // Center diamond
            const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            diamond.setAttribute('points', '50,35 65,50 50,65 35,50');
            diamond.classList.add('split-diamond');
            svg.appendChild(line1);
            svg.appendChild(line2);
            svg.appendChild(diamond);
        }

        cell.appendChild(svg);
    }

    function updateCellVisual(r, c) {
        const cell = gridContainer.children[r * GRID_SIZE + c];
        if (!cell) return;

        const existing = cell.querySelector('.mirror-line');
        if (existing) existing.remove();
        cell.classList.remove('wall', 'splitter', 'fixed');

        if (grid[r][c] === 'wall') {
            cell.classList.add('wall');
        } else if (isPiece(grid[r][c])) {
            addPieceVisual(cell, grid[r][c]);
            if (grid[r][c] === 'split') cell.classList.add('splitter');
            if (fixedCells.has(r + ',' + c)) cell.classList.add('fixed');
        }
    }

    // =============================================
    // Edge Indicators (Source & Targets)
    // =============================================

    function renderEdgeIndicators() {
        edgeTop.innerHTML = '';
        edgeBottom.innerHTML = '';
        edgeLeft.innerHTML = '';
        edgeRight.innerHTML = '';

        for (let i = 0; i < GRID_SIZE; i++) {
            edgeTop.appendChild(createEdgeSlot('top', i));
            edgeBottom.appendChild(createEdgeSlot('bottom', i));
            edgeLeft.appendChild(createEdgeSlot('left', i));
            edgeRight.appendChild(createEdgeSlot('right', i));
        }
    }

    function createEdgeSlot(edge, pos) {
        const slot = document.createElement('div');
        slot.className = 'edge-slot';

        if (puzzle.source.edge === edge && puzzle.source.pos === pos) {
            const wrapper = document.createElement('div');
            wrapper.className = 'edge-label source-label';
            const arrow = document.createElement('span');
            arrow.className = 'edge-icon source';
            arrow.textContent = getSourceArrow(edge);
            const label = document.createElement('span');
            label.className = 'edge-label-text source-text';
            label.textContent = 'LASER';
            wrapper.appendChild(arrow);
            wrapper.appendChild(label);
            wrapper.setAttribute('aria-label', 'Laser source');
            slot.appendChild(wrapper);
        }

        for (let t = 0; t < puzzle.targets.length; t++) {
            if (puzzle.targets[t].edge === edge && puzzle.targets[t].pos === pos) {
                const wrapper = document.createElement('div');
                wrapper.className = 'edge-label target-label';
                const icon = document.createElement('span');
                icon.className = 'edge-icon target';
                icon.id = 'target-' + t;
                icon.textContent = '\u25CE';
                const label = document.createElement('span');
                label.className = 'edge-label-text target-text';
                label.id = 'target-text-' + t;
                label.textContent = 'GOAL';
                wrapper.appendChild(icon);
                wrapper.appendChild(label);
                wrapper.setAttribute('aria-label', 'Target');
                slot.appendChild(wrapper);
            }
        }

        return slot;
    }

    function getSourceArrow(edge) {
        switch (edge) {
            case 'left': return '\u25B8';
            case 'right': return '\u25C2';
            case 'top': return '\u25BE';
            case 'bottom': return '\u25B4';
        }
    }

    function updateTargetIndicators() {
        var hitCount = 0;
        for (let t = 0; t < puzzle.targets.length; t++) {
            const el = document.getElementById('target-' + t);
            const textEl = document.getElementById('target-text-' + t);
            if (el) {
                if (targetsHit[t]) {
                    el.classList.add('hit');
                    el.textContent = '\u2713';
                    if (textEl) { textEl.textContent = 'HIT'; textEl.classList.add('hit'); }
                    hitCount++;
                } else {
                    el.classList.remove('hit');
                    el.textContent = '\u25CE';
                    if (textEl) { textEl.textContent = 'GOAL'; textEl.classList.remove('hit'); }
                }
            }
        }
        if (hitCount > 0 && hitCount < puzzle.targets.length) {
            announce('Target ' + hitCount + ' of ' + puzzle.targets.length + ' hit');
        }
    }

    // =============================================
    // Laser Tracing (supports beam splitting)
    // =============================================

    function getEntryCell(source) {
        const dir = EDGE_ENTRY_DIR[source.edge];
        let r, c;
        switch (source.edge) {
            case 'left': r = source.pos; c = 0; break;
            case 'right': r = source.pos; c = GRID_SIZE - 1; break;
            case 'top': r = 0; c = source.pos; break;
            case 'bottom': r = GRID_SIZE - 1; c = source.pos; break;
        }
        return { r, c, dir };
    }

    function traceLaser() {
        laserPath = [];
        targetsHit = puzzle.targets.map(() => false);

        const entry = getEntryCell(puzzle.source);

        // Starting point (from edge)
        let startX, startY;
        switch (puzzle.source.edge) {
            case 'left':
                startX = 0; startY = entry.r * CELL_SVG + CELL_SVG / 2; break;
            case 'right':
                startX = SVG_SIZE; startY = entry.r * CELL_SVG + CELL_SVG / 2; break;
            case 'top':
                startX = entry.c * CELL_SVG + CELL_SVG / 2; startY = 0; break;
            case 'bottom':
                startX = entry.c * CELL_SVG + CELL_SVG / 2; startY = SVG_SIZE; break;
        }

        // Trace all beams (BFS for splitters)
        const allPolylines = []; // each is an array of {x,y} points
        const globalVisited = new Set(); // prevents re-tracing same cell+dir across all beams

        // Queue of beams to trace: {r, c, dir, points}
        const beamQueue = [{
            r: entry.r, c: entry.c, dir: entry.dir,
            points: [{ x: startX, y: startY }]
        }];

        while (beamQueue.length > 0) {
            const beam = beamQueue.shift();
            let { r, c, dir, points } = beam;
            let maxSteps = 150;

            while (maxSteps-- > 0) {
                if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) {
                    checkTargetHit(r, c);
                    // Add exit point
                    const last = points[points.length - 1];
                    let exitX, exitY;
                    if (r < 0) { exitX = last.x; exitY = 0; }
                    else if (r >= GRID_SIZE) { exitX = last.x; exitY = SVG_SIZE; }
                    else if (c < 0) { exitX = 0; exitY = last.y; }
                    else if (c >= GRID_SIZE) { exitX = SVG_SIZE; exitY = last.y; }
                    if (exitX !== undefined) points.push({ x: exitX, y: exitY });
                    break;
                }

                const key = r + ',' + c + ',' + dir;
                if (globalVisited.has(key)) break;
                globalVisited.add(key);

                const cellContent = grid[r][c];
                const cx = c * CELL_SVG + CELL_SVG / 2;
                const cy = r * CELL_SVG + CELL_SVG / 2;

                if (cellContent === 'wall') {
                    points.push({ x: cx, y: cy });
                    laserPath.push({ r, c });
                    break;
                }

                points.push({ x: cx, y: cy });
                laserPath.push({ r, c });

                if (cellContent === 'split') {
                    // Splitter: beam continues straight AND spawns a reflected beam
                    const reflectedDir = SPLIT_REFLECT[dir];

                    // Spawn reflected beam (starts from this cell center)
                    const reflR = r + DIRECTIONS[reflectedDir].dr;
                    const reflC = c + DIRECTIONS[reflectedDir].dc;
                    beamQueue.push({
                        r: reflR, c: reflC, dir: reflectedDir,
                        points: [{ x: cx, y: cy }]
                    });

                    // Original beam continues straight (dir unchanged)
                } else if (isMirror(cellContent)) {
                    const reflectTable = cellContent === 'fwd' ? FWD_REFLECT : BCK_REFLECT;
                    dir = reflectTable[dir];
                } // else null: beam continues straight

                r += DIRECTIONS[dir].dr;
                c += DIRECTIONS[dir].dc;
            }

            allPolylines.push(points);
        }

        renderLaser(allPolylines);
        updateLaserActiveCells();
        updateTargetIndicators();

        if (!solved) {
            checkWinCondition();
        }
    }

    function checkTargetHit(r, c) {
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
    }

    function renderLaser(allPolylines) {
        laserSvg.innerHTML = '';

        for (const points of allPolylines) {
            if (points.length < 2) continue;

            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const pointStr = points.map(p => p.x + ',' + p.y).join(' ');
            polyline.setAttribute('points', pointStr);
            polyline.classList.add('laser-beam');

            let totalLength = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
            }

            polyline.classList.add('animated');
            polyline.style.setProperty('--beam-length', totalLength);

            laserSvg.appendChild(polyline);
        }
    }

    function updateLaserActiveCells() {
        const cells = gridContainer.querySelectorAll('.cell');
        cells.forEach(c => c.classList.remove('laser-active', 'gem-collected'));

        gemCollected = false;
        for (const { r, c } of laserPath) {
            const cell = gridContainer.children[r * GRID_SIZE + c];
            if (cell && isPiece(grid[r][c])) {
                cell.classList.add('laser-active');
            }
            // Check if laser passes through gem cell
            if (puzzle.gem && puzzle.gem.r === r && puzzle.gem.c === c) {
                gemCollected = true;
                if (cell) cell.classList.add('gem-collected');
            }
        }

        // Update gem icon visual
        var gemIcon = document.getElementById('gem-icon');
        if (gemIcon) {
            gemIcon.classList.toggle('collected', gemCollected);
        }
    }

    // =============================================
    // Win Condition
    // =============================================

    function checkWinCondition() {
        if (targetsHit.every(Boolean)) {
            solved = true;
            const used = countPiecesUsed();

            var data = loadData();
            var alreadySolvedToday = data.today && data.today.date === getTodayKey() && data.today.everSolved;

            // First solve of the day: record streak + initial stats
            if (!alreadySolvedToday) {
                updateStats(used);
            }

            // Always update best score and gem (improvements from replays)
            updateBestScore(used);

            saveState();
            updateStatsDisplay();
            shareBtn.disabled = false;

            setTimeout(function () { showWinModal(); }, 600);
        }
    }

    function showWinModal() {
        var data = loadData();
        var todayData = data.today || {};
        var bestScore = todayData.bestScore || countPiecesUsed();
        var everGotGem = todayData.gemEverCollected || gemCollected;
        var score = getScoreLabel(bestScore, puzzle.par);
        var stats = loadStats();

        winPuzzle.textContent = 'Beamlab #' + puzzleNumber;
        winScore.textContent = score;

        var streakText = '\uD83D\uDD25 ' + stats.currentStreak + ' day streak';
        if (stats.totalGems > 0) {
            streakText += ' \u00B7 \uD83D\uDC8E ' + stats.totalGems + ' total';
        }
        winStreak.textContent = streakText;

        var gemStatus = '';
        if (puzzle.gem) {
            gemStatus = everGotGem ? ' \uD83D\uDC8E' : '';
        }
        winTitle.textContent = 'Solved!' + gemStatus;
        shareCopied.hidden = true;

        // Share text uses best score and gem-ever status
        var sharePreview = document.getElementById('share-preview');
        if (sharePreview && typeof generateShareText === 'function') {
            sharePreview.textContent = generateShareText(puzzleNumber, bestScore, puzzle.par, stats.currentStreak, everGotGem, stats.totalGems, getUsername(), getPuzzleInfo());
        }

        // Hide Share button if Web Share API not available
        var winShareBtn2 = document.getElementById('win-share-btn');
        if (winShareBtn2 && !navigator.share) {
            winShareBtn2.style.display = 'none';
        }

        // Show username prompt if no username set and first time solving ever
        var usernamePrompt = document.getElementById('username-prompt');
        if (usernamePrompt) {
            if (!getUsername() && stats.solved <= 1) {
                usernamePrompt.hidden = false;
            } else {
                usernamePrompt.hidden = true;
            }
        }

        winModal.hidden = false;
        announce('Puzzle solved! ' + score);
    }

    function announce(message) {
        var el = document.getElementById('game-announcer');
        if (el) {
            el.textContent = '';
            setTimeout(function () { el.textContent = message; }, 50);
        }
    }

    function countPiecesUsed() {
        let count = 0;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (isPiece(grid[r][c]) && !fixedCells.has(r + ',' + c)) count++;
            }
        }
        return count;
    }

    function getScoreLabel(used, par) {
        const diff = used - par;
        if (diff < 0) return 'Under Par! (' + used + ' pieces)';
        if (diff === 0) return 'Par (' + used + ' pieces)';
        if (diff === 1) return 'Bogey (' + used + ' pieces)';
        if (diff === 2) return 'Double Bogey (' + used + ' pieces)';
        return '+' + diff + ' (' + used + ' pieces)';
    }

    // =============================================
    // Interaction
    // =============================================

    function setupEventListeners() {
        gridContainer.addEventListener('click', handleCellClick);
        gridContainer.addEventListener('contextmenu', handleCellRightClick);

        // Double tap for mobile removal
        let lastTapTime = 0;
        let lastTapCell = null;
        gridContainer.addEventListener('touchend', function (e) {
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const now = Date.now();
            if (lastTapCell === cell && now - lastTapTime < 350) {
                e.preventDefault();
                removePiece(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
                lastTapTime = 0;
                lastTapCell = null;
            } else {
                lastTapTime = now;
                lastTapCell = cell;
            }
        });

        // Inventory selection
        invFwdBtn.addEventListener('click', () => { selectedMirrorType = 'fwd'; updateInventoryUI(); });
        invBckBtn.addEventListener('click', () => { selectedMirrorType = 'bck'; updateInventoryUI(); });
        if (invSplitBtn) {
            invSplitBtn.addEventListener('click', () => { selectedMirrorType = 'split'; updateInventoryUI(); });
        }

        undoBtn.addEventListener('click', undo);
        resetBtn.addEventListener('click', resetBoard);
        shareBtn.addEventListener('click', function () {
            if (solved) showWinModal();
        });

        helpBtn.addEventListener('click', () => { helpModal.hidden = false; });
        helpClose.addEventListener('click', () => { helpModal.hidden = true; });

        var controlsModal = document.getElementById('controls-modal');
        var controlsClose = document.getElementById('controls-close');
        if (controlsClose) controlsClose.addEventListener('click', () => { controlsModal.hidden = true; });
        if (controlsModal) controlsModal.addEventListener('click', (e) => { if (e.target === controlsModal) controlsModal.hidden = true; });
        winClose.addEventListener('click', () => { winModal.hidden = true; });
        winShareBtn.addEventListener('click', webShareResults);
        var winCopyBtn = document.getElementById('win-copy-btn');
        if (winCopyBtn) winCopyBtn.addEventListener('click', copyResults);

        helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.hidden = true; });
        winModal.addEventListener('click', (e) => { if (e.target === winModal) winModal.hidden = true; });

        // Clear all stats & progress (inline confirm, no browser modal)
        var clearBtn = document.getElementById('clear-stats-btn');
        if (clearBtn) {
            var clearPending = false;
            var clearTimer = null;
            clearBtn.addEventListener('click', function () {
                if (!clearPending) {
                    clearPending = true;
                    clearBtn.textContent = 'Are you sure? Tap again to confirm';
                    clearBtn.classList.add('confirm');
                    clearTimer = setTimeout(function () {
                        clearPending = false;
                        clearBtn.textContent = 'Clear all stats & progress';
                        clearBtn.classList.remove('confirm');
                    }, 3000);
                } else {
                    clearTimeout(clearTimer);
                    localStorage.removeItem(getStorageKey());
                    localStorage.removeItem('beamlab_username');
                    localStorage.removeItem('beamlab_seen_controls');
                    location.reload();
                }
            });
        }

        // Theme toggle
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', toggleTheme);
        }

        // Username modal
        setupUsernameModal();
    }

    // =============================================
    // Theme Toggle
    // =============================================

    function initTheme() {
        const saved = localStorage.getItem('beamlab_theme');
        const themeBtn = document.getElementById('theme-btn');
        if (saved === 'light') {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
            if (themeBtn) themeBtn.textContent = '\u2600'; // sun
        } else if (saved === 'dark') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
            if (themeBtn) themeBtn.textContent = '\u263E'; // moon
        } else {
            // Auto (OS preference) — no class override
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (themeBtn) themeBtn.textContent = prefersDark ? '\u263E' : '\u2600';
        }
    }

    function toggleTheme() {
        const themeBtn = document.getElementById('theme-btn');
        const html = document.documentElement;
        const isCurrentlyLight = html.classList.contains('light-theme') ||
            (!html.classList.contains('dark-theme') && window.matchMedia('(prefers-color-scheme: light)').matches);

        if (isCurrentlyLight) {
            html.classList.remove('light-theme');
            html.classList.add('dark-theme');
            localStorage.setItem('beamlab_theme', 'dark');
            if (themeBtn) themeBtn.textContent = '\u263E'; // moon
        } else {
            html.classList.remove('dark-theme');
            html.classList.add('light-theme');
            localStorage.setItem('beamlab_theme', 'light');
            if (themeBtn) themeBtn.textContent = '\u2600'; // sun
        }
    }

    // =============================================
    // Username Modal
    // =============================================

    function setupUsernameModal() {
        var input = document.getElementById('username-input');
        var saveBtn = document.getElementById('username-save');
        var skipBtn = document.getElementById('username-skip');
        var openBtn = document.getElementById('username-btn');
        var prompt = document.getElementById('username-prompt');
        if (!input) return;

        function saveUsername() {
            var name = input.value.trim();
            if (name) {
                localStorage.setItem('beamlab_username', name);
            } else {
                localStorage.removeItem('beamlab_username');
            }
            if (prompt) prompt.hidden = true;
            // Refresh share preview
            refreshSharePreview();
        }

        function skipUsername() {
            if (prompt) prompt.hidden = true;
        }

        // Inline prompt in win modal
        if (saveBtn) saveBtn.addEventListener('click', saveUsername);
        if (skipBtn) skipBtn.addEventListener('click', skipUsername);
        if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveUsername(); });

        // Standalone modal (header button)
        var modal = document.getElementById('username-modal');
        var modalInput = document.getElementById('username-modal-input');
        var modalSave = document.getElementById('username-modal-save');
        var modalSkip = document.getElementById('username-modal-skip');
        var modalClose = document.getElementById('username-modal-close');

        function openModal() {
            if (modalInput) modalInput.value = getUsername();
            if (modal) modal.hidden = false;
            if (modalInput) modalInput.focus();
        }

        function closeModal() {
            if (modal) modal.hidden = true;
        }

        function saveModalUsername() {
            var name = modalInput ? modalInput.value.trim() : '';
            if (name) {
                localStorage.setItem('beamlab_username', name);
            } else {
                localStorage.removeItem('beamlab_username');
            }
            closeModal();
            refreshSharePreview();
        }

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (modalSave) modalSave.addEventListener('click', saveModalUsername);
        if (modalSkip) modalSkip.addEventListener('click', closeModal);
        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        if (modalInput) modalInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveModalUsername(); });
    }

    function refreshSharePreview() {
        var sharePreview = document.getElementById('share-preview');
        if (sharePreview && typeof generateShareText === 'function' && solved) {
            var data = loadData();
            var todayData = data.today || {};
            var bestScore = todayData.bestScore || countPiecesUsed();
            var everGotGem = todayData.gemEverCollected || gemCollected;
            var stats = loadStats();
            sharePreview.textContent = generateShareText(puzzleNumber, bestScore, puzzle.par, stats.currentStreak, everGotGem, stats.totalGems, getUsername(), getPuzzleInfo());
        }
    }

    function handleCellClick(e) {
        if (solved) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);

        if (grid[r][c] === 'wall') return;
        if (fixedCells.has(r + ',' + c)) return;  // can't modify fixed pieces

        if (isPiece(grid[r][c])) {
            rotatePiece(r, c);
        } else {
            placePiece(r, c);
        }
    }

    function handleCellRightClick(e) {
        e.preventDefault();
        if (solved) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;
        var r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
        if (fixedCells.has(r + ',' + c)) return;  // can't remove fixed pieces
        removePiece(r, c);
    }

    function placePiece(r, c) {
        let type = selectedMirrorType;
        if (inventory[type] <= 0) {
            // Try other types in order
            const fallback = PIECE_TYPES.filter(t => t !== type && inventory[t] > 0);
            if (fallback.length === 0) return;
            type = fallback[0];
            selectedMirrorType = type;
        }

        moveHistory.push({ action: 'place', r, c, type });
        grid[r][c] = type;
        inventory[type]--;

        updateCellVisual(r, c);
        traceLaser();
        updateInventoryUI();
        updateButtons();
        saveState();
    }

    function rotatePiece(r, c) {
        const oldType = grid[r][c];
        // Cycle through available types: fwd → bck → split → fwd (skip types with 0 total)
        const availableTypes = PIECE_TYPES.filter(t => {
            if (t === oldType) return true; // current type is always "available" for cycling
            return inventory[t] > 0;
        });

        const currentIdx = availableTypes.indexOf(oldType);
        const nextIdx = (currentIdx + 1) % availableTypes.length;
        const newType = availableTypes[nextIdx];

        if (newType === oldType) return; // only one type available

        moveHistory.push({ action: 'rotate', r, c, from: oldType, to: newType });

        // Return old type to inventory, take new type
        inventory[oldType]++;
        inventory[newType]--;
        grid[r][c] = newType;

        updateCellVisual(r, c);
        traceLaser();
        updateInventoryUI();
        updateButtons();
        saveState();
    }

    function removePiece(r, c) {
        if (!isPiece(grid[r][c])) return;

        const type = grid[r][c];
        moveHistory.push({ action: 'remove', r, c, type });
        grid[r][c] = null;
        inventory[type]++;

        updateCellVisual(r, c);
        traceLaser();
        updateInventoryUI();
        updateButtons();
        saveState();
    }

    function undo() {
        if (moveHistory.length === 0) return;
        const move = moveHistory.pop();

        switch (move.action) {
            case 'place':
                grid[move.r][move.c] = null;
                inventory[move.type]++;
                break;
            case 'rotate':
                grid[move.r][move.c] = move.from;
                inventory[move.to]++;
                inventory[move.from]--;
                break;
            case 'remove':
                grid[move.r][move.c] = move.type;
                inventory[move.type]--;
                break;
        }

        updateCellVisual(move.r, move.c);
        traceLaser();
        updateInventoryUI();
        updateButtons();
        saveState();
    }

    function resetBoard() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (isPiece(grid[r][c]) && !fixedCells.has(r + ',' + c)) {
                    grid[r][c] = null;
                }
            }
        }

        inventory = { fwd: 0, bck: 0, split: 0, ...puzzle.inventory };
        moveHistory = [];
        solved = false;
        gemCollected = false;
        shareBtn.disabled = true;

        renderGrid();
        traceLaser();
        updateInventoryUI();
        updateButtons();
        saveState();
    }

    // =============================================
    // UI Updates
    // =============================================

    function updateInventoryUI() {
        invFwdCount.textContent = inventory.fwd;
        invBckCount.textContent = inventory.bck;
        if (invSplitCount) invSplitCount.textContent = inventory.split;

        invFwdBtn.classList.toggle('selected', selectedMirrorType === 'fwd');
        invBckBtn.classList.toggle('selected', selectedMirrorType === 'bck');
        if (invSplitBtn) invSplitBtn.classList.toggle('selected', selectedMirrorType === 'split');

        invFwdBtn.classList.toggle('empty', inventory.fwd <= 0);
        invBckBtn.classList.toggle('empty', inventory.bck <= 0);
        if (invSplitBtn) invSplitBtn.classList.toggle('empty', inventory.split <= 0);

        mirrorsUsedEl.textContent = countPiecesUsed();
    }

    function updateButtons() {
        undoBtn.disabled = moveHistory.length === 0;
        shareBtn.disabled = !solved;
    }

    function updateBestScore(used) {
        var data = loadData();
        if (!data.today) return;

        // Update best score
        if (data.today.bestScore === null || used < data.today.bestScore) {
            data.today.bestScore = used;
        }

        // Award gem to total if first time collected today
        if (gemCollected && !data.today.gemEverCollected) {
            data.today.gemEverCollected = true;
            var stats = data.stats || { played: 0, solved: 0, currentStreak: 0, maxStreak: 0, totalGems: 0, distribution: {} };
            stats.totalGems = (stats.totalGems || 0) + 1;
            data.stats = stats;
        }

        try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch (e) { }
    }

    function updateStatsDisplay() {
        var stats = loadStats();
        var streakEl = document.getElementById('streak-count');
        var gemsEl = document.getElementById('gems-count');
        if (streakEl) streakEl.textContent = stats.currentStreak || 0;
        if (gemsEl) gemsEl.textContent = stats.totalGems || 0;
    }

    // =============================================
    // Persistence (localStorage)
    // =============================================

    function getStorageKey() { return 'beamlab_data'; }

    function saveState() {
        const pieces = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (isPiece(grid[r][c])) {
                    pieces.push({ r, c, type: grid[r][c] });
                }
            }
        }

        const data = loadData();
        data.version = SAVE_VERSION;
        var prevToday = data.today || {};
        data.today = {
            date: getTodayKey(),
            puzzleNumber: puzzleNumber,
            solved: solved,
            everSolved: prevToday.everSolved || solved,
            mirrors: pieces,
            score: solved ? countPiecesUsed() : null,
            bestScore: prevToday.bestScore || null,
            gemEverCollected: prevToday.gemEverCollected || false,
            par: puzzle.par
        };
        // Preserve best score and gem across resets
        if (solved) {
            var current = countPiecesUsed();
            if (data.today.bestScore === null || current < data.today.bestScore) {
                data.today.bestScore = current;
            }
            if (gemCollected) {
                data.today.gemEverCollected = true;
            }
        }

        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(data));
        } catch (e) { }
    }

    function restoreState() {
        const data = loadData();
        if (!data.today || data.today.date !== getTodayKey()) return false;

        if (data.today.mirrors) {
            for (const m of data.today.mirrors) {
                if (m.r < GRID_SIZE && m.c < GRID_SIZE && grid[m.r][m.c] === null) {
                    grid[m.r][m.c] = m.type;
                    if (inventory[m.type] !== undefined) inventory[m.type]--;
                }
            }
        }

        solved = !!data.today.solved;
        return true;
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(getStorageKey());
            if (raw) {
                const data = JSON.parse(raw);
                if (data.version !== SAVE_VERSION) {
                    // Version mismatch — clear stale data but keep stats
                    return { version: SAVE_VERSION, today: null, stats: data.stats || null, lastCompletedDate: data.lastCompletedDate || null };
                }
                return data;
            }
        } catch (e) { }
        return { version: SAVE_VERSION, today: null, stats: null, lastCompletedDate: null };
    }

    function getTodayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // =============================================
    // Stats
    // =============================================

    function loadStats() {
        const data = loadData();
        return data.stats || { played: 0, solved: 0, currentStreak: 0, maxStreak: 0, totalGems: 0, distribution: {} };
    }

    function updateStats(piecesUsedCount) {
        const data = loadData();
        const stats = data.stats || { played: 0, solved: 0, currentStreak: 0, maxStreak: 0, totalGems: 0, distribution: {} };

        stats.played++;
        stats.solved++;

        const today = getTodayKey();
        const yesterday = getYesterdayKey();

        if (data.lastCompletedDate === yesterday) {
            stats.currentStreak++;
        } else if (data.lastCompletedDate !== today) {
            stats.currentStreak = 1;
        }

        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        data.lastCompletedDate = today;

        const diff = piecesUsedCount - puzzle.par;
        const label = diff <= 0 ? 'par_or_under' : '+' + diff;
        stats.distribution[label] = (stats.distribution[label] || 0) + 1;

        data.stats = stats;
        try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch (e) { }
    }

    function getYesterdayKey() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // =============================================
    // Share
    // =============================================

    function getUsername() {
        return localStorage.getItem('beamlab_username') || '';
    }

    function getPuzzleInfo() {
        return {
            targets: puzzle.targets ? puzzle.targets.length : 1,
            fixed: puzzle.fixed ? puzzle.fixed.length : 0,
            walls: puzzle.walls ? puzzle.walls.length : 0
        };
    }

    function getShareText() {
        if (typeof generateShareText !== 'function') return '';
        var data = loadData();
        var todayData = data.today || {};
        var bestScore = todayData.bestScore || countPiecesUsed();
        var everGotGem = todayData.gemEverCollected || gemCollected;
        var stats = loadStats();
        return generateShareText(puzzleNumber, bestScore, puzzle.par, stats.currentStreak, everGotGem, stats.totalGems, getUsername(), getPuzzleInfo());
    }

    function copyResults() {
        var text = getShareText();
        if (!text) return;

        function onCopySuccess() {
            shareCopied.hidden = false;
            setTimeout(function () { shareCopied.hidden = true; }, 2000);
        }

        function fallbackCopy() {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try { document.execCommand('copy'); onCopySuccess(); }
            catch (e) { /* copy failed */ }
            document.body.removeChild(textarea);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onCopySuccess).catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
    }

    function webShareResults() {
        var text = getShareText();
        if (!text) return;

        if (navigator.share) {
            navigator.share({
                title: 'Beamlab #' + puzzleNumber,
                text: text
            }).catch(function () { /* user cancelled */ });
        } else {
            copyResults();
        }
    }

    // Expose for external scripts
    window.redirectGame = {
        getGrid: () => grid,
        getLaserPath: () => laserPath,
        getGridSize: () => GRID_SIZE,
        getPuzzle: () => puzzle,
        getPuzzleNumber: () => puzzleNumber,
        isSolved: () => solved
    };

    // =============================================
    // Start
    // =============================================

    initTheme();
    init();

})();
