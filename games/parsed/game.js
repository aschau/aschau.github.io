// ============================================
// Parsed — Core Game Engine
// Tap-to-swap code tokens to fix buggy programs
// ============================================

(function () {
    'use strict';

    var SAVE_VERSION = 2;
    var STORAGE_KEY = 'parsed_data';

    // --- Game State ---
    var puzzle = null;
    var puzzleNumber = 0;
    var currentTokens = [];   // flat array: [{t, y, f, line, col, solutionIndex}]
    var movableTokens = [];   // subset of currentTokens where f===0
    var solutionOrder = [];   // the correct text values for each movable slot
    var solutionVars = null;  // expected final variable state from correct arrangement
    var selectedIndex = null; // index into movableTokens of currently selected token
    var swapCount = 0;
    var moveHistory = [];     // [{a, b}] indices into movableTokens
    var solved = false;
    var everSolved = false;
    var bestScore = null;

    // --- DOM refs ---
    var codeGrid = document.getElementById('code-grid');
    var consolePanel = document.getElementById('console-panel');
    var consoleTitle = document.getElementById('console-title');
    var consoleOutput = document.getElementById('console-output');
    var goalText = document.getElementById('goal-text');
    var parValue = document.getElementById('par-value');
    var swapsUsed = document.getElementById('swaps-used');
    var undoBtn = document.getElementById('undo-btn');
    var resetBtn = document.getElementById('reset-btn');
    var shareBtn = document.getElementById('share-btn');
    var helpBtn = document.getElementById('help-btn');
    var helpModal = document.getElementById('help-modal');
    var helpClose = document.getElementById('help-close');
    var winModal = document.getElementById('win-modal');
    var winClose = document.getElementById('win-close');
    var winTitle = document.getElementById('win-title');
    var winPuzzle = document.getElementById('win-puzzle');
    var winScore = document.getElementById('win-score');
    var winResult = document.getElementById('win-result');
    var winStreak = document.getElementById('win-streak');
    var winShareBtn = document.getElementById('win-share-btn');
    var winCopyBtn = document.getElementById('win-copy-btn');
    var shareCopied = document.getElementById('share-copied');
    var puzzleNumberEl = document.getElementById('puzzle-number');
    var puzzleDateEl = document.getElementById('puzzle-date');
    var announcer = document.getElementById('game-announcer');

    // Execution modal refs
    var execModal = document.getElementById('exec-modal');
    var execCode = document.getElementById('exec-code');
    var execVarsList = document.getElementById('exec-vars-list');
    var execOutput = document.getElementById('exec-output');
    var execSkip = document.getElementById('exec-skip');

    // =============================================
    // Initialization
    // =============================================

    function init() {
        puzzle = getDailyPuzzle();
        puzzleNumber = getDailyPuzzleNumber();

        puzzleNumberEl.textContent = 'Puzzle #' + puzzleNumber;
        puzzleDateEl.textContent = getTodayDateString();
        parValue.textContent = puzzle.par;
        goalText.textContent = puzzle.goal;

        // Build token arrays from puzzle data
        buildTokenArrays();

        // Store the solution order (correct arrangement of movable tokens)
        solutionOrder = [];
        for (var i = 0; i < movableTokens.length; i++) {
            solutionOrder.push(movableTokens[i].t);
        }

        // Run the solution to capture expected final variable state
        var solLines = [];
        for (var sl = 0; sl < puzzle.lines.length; sl++) {
            var solLine = [];
            for (var sc = 0; sc < puzzle.lines[sl].length; sc++) {
                solLine.push(puzzle.lines[sl][sc].t);
            }
            solLines.push(solLine);
        }
        try {
            var solInterp = new PseudoInterpreter(solLines);
            solInterp.execute();
            solutionVars = {};
            var solKeys = Object.keys(solInterp.vars);
            for (var sk = 0; sk < solKeys.length; sk++) {
                solutionVars[solKeys[sk]] = solInterp.vars[solKeys[sk]];
            }
        } catch (e) {
            solutionVars = null;
        }

        // Scramble movable tokens
        scrambleTokens();

        solved = false;
        everSolved = false;
        bestScore = null;
        swapCount = 0;
        moveHistory = [];
        selectedIndex = null;

        if (!restoreState()) {
            // Fresh game — tokens are already scrambled
        }

        renderCode();
        updateConsole();
        updateUI();
        updateStatsDisplay();
        setupEventListeners();

        if (solved) {
            shareBtn.disabled = false;
        }

        // First-visit controls
        if (!localStorage.getItem('parsed_seen_controls')) {
            var controlsModal = document.getElementById('controls-modal');
            if (controlsModal) controlsModal.hidden = false;
            localStorage.setItem('parsed_seen_controls', '1');
        }
    }

    function buildTokenArrays() {
        currentTokens = [];
        movableTokens = [];
        var movableIdx = 0;

        for (var l = 0; l < puzzle.lines.length; l++) {
            var line = puzzle.lines[l];
            for (var c = 0; c < line.length; c++) {
                var tok = {
                    t: line[c].t,
                    y: line[c].y,
                    f: line[c].f,
                    line: l,
                    col: c
                };
                currentTokens.push(tok);
                if (!tok.f) {
                    tok.movableIndex = movableIdx;
                    movableTokens.push(tok);
                    movableIdx++;
                }
            }
        }
    }

    // Simple seeded PRNG (mulberry32)
    function seededRng(seed) {
        var s = seed | 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            var t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hashString(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
    }

    function scrambleTokens() {
        // Seeded Fisher-Yates shuffle for deterministic scramble per puzzle
        var rng = seededRng(hashString(puzzle.id || 'puzzle'));
        var texts = movableTokens.map(function (t) { return t.t; });
        var maxAttempts = 100;
        var attempt = 0;

        do {
            // Re-seed each attempt to get different arrangements
            rng = seededRng(hashString(puzzle.id || 'puzzle') + attempt * 7919);
            texts = solutionOrder.slice(); // start fresh from solution
            for (var i = texts.length - 1; i > 0; i--) {
                var j = Math.floor(rng() * (i + 1));
                var tmp = texts[i];
                texts[i] = texts[j];
                texts[j] = tmp;
            }
            attempt++;
        } while (arraysEqual(texts, solutionOrder) && attempt < maxAttempts);

        for (var k = 0; k < movableTokens.length; k++) {
            movableTokens[k].t = texts[k];
        }
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    // =============================================
    // Rendering
    // =============================================

    function renderCode() {
        codeGrid.innerHTML = '';
        var tokenIdx = 0;

        for (var l = 0; l < puzzle.lines.length; l++) {
            var lineEl = document.createElement('div');
            lineEl.className = 'code-line';

            // Determine indent level
            var indentLevel = getIndentLevel(l);
            if (indentLevel > 0) {
                lineEl.classList.add('indent-' + Math.min(indentLevel, 2));
            }

            // Line number
            var lineNum = document.createElement('span');
            lineNum.className = 'line-number';
            lineNum.textContent = l + 1;
            lineEl.appendChild(lineNum);

            var line = puzzle.lines[l];
            for (var c = 0; c < line.length; c++) {
                var tok = currentTokens[tokenIdx];
                var tokenEl = document.createElement('span');
                tokenEl.className = 'token token-' + tok.y;
                tokenEl.textContent = tok.t;
                tokenEl.dataset.index = tokenIdx;

                if (tok.f) {
                    tokenEl.classList.add('fixed');
                } else {
                    tokenEl.classList.add('movable');
                    tokenEl.dataset.movableIndex = tok.movableIndex;
                }

                lineEl.appendChild(tokenEl);
                tokenIdx++;
            }

            codeGrid.appendChild(lineEl);
        }
    }

    function getIndentLevel(lineIndex) {
        // Count how many unclosed { braces precede this line
        var depth = 0;
        for (var l = 0; l < lineIndex; l++) {
            var line = puzzle.lines[l];
            for (var c = 0; c < line.length; c++) {
                if (line[c].t === '{') depth++;
                if (line[c].t === '}') depth--;
            }
        }
        // If current line starts with }, it closes a block so outdent
        var currentLine = puzzle.lines[lineIndex];
        if (currentLine.length > 0 && currentLine[0].t === '}') {
            depth--;
        }
        return Math.max(0, depth);
    }

    function updateTokenDisplay() {
        var tokenEls = codeGrid.querySelectorAll('.token');
        for (var i = 0; i < tokenEls.length; i++) {
            var idx = parseInt(tokenEls[i].dataset.index);
            var tok = currentTokens[idx];
            tokenEls[i].textContent = tok.t;
            tokenEls[i].className = 'token token-' + tok.y;

            if (tok.f) {
                tokenEls[i].classList.add('fixed');
            } else {
                tokenEls[i].classList.add('movable');
                if (selectedIndex !== null && tok.movableIndex === selectedIndex) {
                    tokenEls[i].classList.add('selected');
                }
            }
        }
    }

    // =============================================
    // Console Feedback
    // =============================================

    function updateConsole() {
        var result = tryRunCode();
        consoleOutput.innerHTML = '';

        if (result.success) {
            consoleTitle.textContent = 'BUILD SUCCESSFUL \u2713';
            consoleTitle.className = 'console-title success';

            var successLine = document.createElement('div');
            successLine.className = 'console-line success';
            successLine.textContent = '> Output: ' + result.output;
            consoleOutput.appendChild(successLine);
        } else if (result.type === 'compile') {
            consoleTitle.textContent = 'SyntaxError';
            consoleTitle.className = 'console-title error';

            for (var i = 0; i < result.errors.length; i++) {
                var errLine = document.createElement('div');
                errLine.className = 'console-line error';
                errLine.textContent = result.errors[i];
                consoleOutput.appendChild(errLine);
            }
        } else if (result.type === 'logic') {
            consoleTitle.textContent = 'LOGIC ERROR';
            consoleTitle.className = 'console-title error';

            var outLine = document.createElement('div');
            outLine.className = 'console-line success';
            outLine.textContent = '> Output: ' + result.output;
            consoleOutput.appendChild(outLine);

            for (var i = 0; i < result.errors.length; i++) {
                var errLine = document.createElement('div');
                errLine.className = 'console-line error';
                errLine.textContent = result.errors[i];
                consoleOutput.appendChild(errLine);
            }
        } else {
            consoleTitle.textContent = 'WRONG OUTPUT';
            consoleTitle.className = 'console-title error';

            for (var i = 0; i < result.errors.length; i++) {
                var errLine = document.createElement('div');
                errLine.className = 'console-line error';
                errLine.textContent = result.errors[i];
                consoleOutput.appendChild(errLine);
            }
        }

        announce(result.success ? 'Build successful' : (result.type === 'compile' ? 'Syntax error' : (result.type === 'logic' ? 'Logic error' : 'Wrong output')));
        return result.success;
    }

    function tryRunCode() {
        // Build code lines from current token arrangement
        var codeLines = [];
        var tokenIdx = 0;
        for (var l = 0; l < puzzle.lines.length; l++) {
            var tokens = [];
            for (var c = 0; c < puzzle.lines[l].length; c++) {
                tokens.push(currentTokens[tokenIdx].t);
                tokenIdx++;
            }
            codeLines.push(tokens);
        }

        // Structural validation — check each line compiles
        var compileErrors = validateStructure(codeLines);
        if (compileErrors.length > 0) {
            return { success: false, type: 'compile', errors: compileErrors };
        }

        try {
            var interp = new PseudoInterpreter(codeLines);
            interp.execute();
            var output = interp.output;

            if (output === null || output === undefined) {
                return { success: false, type: 'compile', errors: ['error: program produced no output'] };
            }

            var outputStr = String(output);
            if (typeof output === 'boolean') outputStr = output ? 'true' : 'false';

            if (outputStr === puzzle.output) {
                // Output matches — verify the logic is correct by comparing
                // final variable states against the solution. This allows
                // equivalent expressions (a+b == b+a) but catches cheats
                // like bypassing loops or misassigning variables.
                var logicValid = true;
                if (solutionVars) {
                    var playerVars = interp.vars;
                    var solKeys = Object.keys(solutionVars);
                    var playerKeys = Object.keys(playerVars);
                    if (solKeys.length !== playerKeys.length) {
                        logicValid = false;
                    } else {
                        for (var vi = 0; vi < solKeys.length; vi++) {
                            var vk = solKeys[vi];
                            if (!playerVars.hasOwnProperty(vk) || playerVars[vk] !== solutionVars[vk]) {
                                logicValid = false;
                                break;
                            }
                        }
                    }
                }
                if (logicValid) {
                    return { success: true, output: outputStr };
                } else {
                    return { success: false, type: 'logic', output: outputStr, errors: ['> output is correct, but the logic doesn\'t match the prompt'] };
                }
            } else {
                return { success: false, type: 'output', errors: ['> returned ' + outputStr + ', expected ' + puzzle.output] };
            }
        } catch (e) {
            return { success: false, type: 'compile', errors: ['error: unexpected token arrangement'] };
        }
    }


    function validateStructure(codeLines) {
        var errors = [];
        for (var i = 0; i < codeLines.length; i++) {
            var line = codeLines[i];
            var ln = i + 1;
            if (!line || line.length === 0) continue;

            var first = line[0];

            // Skip brace-only lines
            if (line.length === 1 && (first === '{' || first === '}')) continue;
            // } else { pattern
            if (first === '}' && line.length >= 3 && line[1] === 'else') continue;
            if (first === '}') continue;

            if (first === 'let') {
                // let <id> = <expr>
                if (line.length < 4) {
                    errors.push('line ' + ln + ': incomplete declaration');
                } else if (line[2] !== '=') {
                    errors.push('line ' + ln + ': expected \'=\' after \'' + line[1] + '\', got \'' + line[2] + '\'');
                } else if (isKeyword(line[1])) {
                    errors.push('line ' + ln + ': \'' + line[1] + '\' is a keyword, not a variable name');
                } else if (isOperator(line[1])) {
                    errors.push('line ' + ln + ': unexpected operator \'' + line[1] + '\' in declaration');
                }
                // Check expression tokens after =
                var exprErr = validateExpr(line.slice(3), ln);
                if (exprErr) errors.push(exprErr);
            } else if (first === 'while' || first === 'if') {
                // while/if <expr> <op> <expr> {
                var lastTok = line[line.length - 1];
                if (lastTok !== '{') {
                    errors.push('line ' + ln + ': expected \'{\' at end of ' + first + ' statement');
                }
                if (line.length < 5) {
                    errors.push('line ' + ln + ': incomplete ' + first + ' condition');
                } else {
                    // Check condition has a comparison operator
                    var hasComp = false;
                    for (var j = 1; j < line.length - 1; j++) {
                        if (isComparison(line[j])) hasComp = true;
                    }
                    if (!hasComp) {
                        errors.push('line ' + ln + ': missing comparison operator in ' + first + ' condition');
                    }
                }
            } else if (first === 'return') {
                if (line.length < 2) {
                    errors.push('line ' + ln + ': return with no value');
                }
            } else {
                // Assignment: <id> = <expr>
                if (line.length < 3) {
                    errors.push('line ' + ln + ': incomplete statement');
                } else if (line[1] !== '=') {
                    errors.push('line ' + ln + ': expected \'=\' after \'' + first + '\', got \'' + line[1] + '\'');
                } else if (isKeyword(first)) {
                    errors.push('line ' + ln + ': unexpected keyword \'' + first + '\'');
                } else if (isOperator(first)) {
                    errors.push('line ' + ln + ': unexpected operator \'' + first + '\' at start of line');
                }
            }
        }
        return errors;
    }

    function validateExpr(tokens, lineNum) {
        // Check for obvious issues: two operators in a row, operator at start/end
        var filtered = tokens.filter(function (t) { return t !== '{' && t !== '}'; });
        if (filtered.length === 0) return null;
        if (isArithOp(filtered[0])) {
            return 'line ' + lineNum + ': unexpected operator \'' + filtered[0] + '\' at start of expression';
        }
        if (filtered.length > 1 && isArithOp(filtered[filtered.length - 1])) {
            return 'line ' + lineNum + ': unexpected operator \'' + filtered[filtered.length - 1] + '\' at end of expression';
        }
        for (var i = 0; i < filtered.length - 1; i++) {
            if (isArithOp(filtered[i]) && isArithOp(filtered[i + 1])) {
                return 'line ' + lineNum + ': unexpected operator \'' + filtered[i + 1] + '\' after \'' + filtered[i] + '\'';
            }
        }
        return null;
    }

    function isKeyword(t) {
        return t === 'let' || t === 'while' || t === 'if' || t === 'else' || t === 'return';
    }

    function isOperator(t) {
        return t === '+' || t === '-' || t === '*' || t === '/' || t === '=' ||
               t === '>' || t === '<' || t === '>=' || t === '<=' || t === '==' || t === '!=';
    }

    function isArithOp(t) {
        return t === '+' || t === '-' || t === '*' || t === '/';
    }

    function isComparison(t) {
        return t === '>' || t === '<' || t === '>=' || t === '<=' || t === '==' || t === '!=';
    }

    function announce(msg) {
        if (announcer) announcer.textContent = msg;
    }

    // =============================================
    // Interaction — Tap to Swap
    // =============================================

    function setupEventListeners() {
        codeGrid.addEventListener('click', handleTokenClick);
        undoBtn.addEventListener('click', handleUndo);
        resetBtn.addEventListener('click', handleReset);
        shareBtn.addEventListener('click', function () { showWinModal(); });

        helpBtn.addEventListener('click', function () { helpModal.hidden = false; });
        helpClose.addEventListener('click', function () { helpModal.hidden = true; });
        helpModal.addEventListener('click', function (e) { if (e.target === helpModal) helpModal.hidden = true; });

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
                    localStorage.removeItem('parsed_username');
                    localStorage.removeItem('parsed_seen_controls');
                    localStorage.removeItem('parsed_username_prompted');
                    location.reload();
                }
            });
        }

        winClose.addEventListener('click', function () { winModal.hidden = true; });
        winModal.addEventListener('click', function (e) { if (e.target === winModal) winModal.hidden = true; });
        winShareBtn.addEventListener('click', webShareResults);
        winCopyBtn.addEventListener('click', copyResults);

        // Controls modal
        var controlsClose = document.getElementById('controls-close');
        var controlsModal = document.getElementById('controls-modal');
        if (controlsClose) {
            controlsClose.addEventListener('click', function () { controlsModal.hidden = true; });
        }
        if (controlsModal) {
            controlsModal.addEventListener('click', function (e) {
                if (e.target === controlsModal) controlsModal.hidden = true;
            });
        }

        // Username modal
        setupUsernameListeners();

        // Theme
        var themeBtn = document.getElementById('theme-btn');
        themeBtn.addEventListener('click', toggleTheme);

        // Exec skip
        if (execSkip) {
            execSkip.addEventListener('click', skipExecution);
        }
    }

    function handleTokenClick(e) {
        if (solved) return;

        var tokenEl = e.target.closest('.token.movable');
        if (!tokenEl) {
            // Clicked elsewhere — deselect
            selectedIndex = null;
            updateTokenDisplay();
            return;
        }

        var mi = parseInt(tokenEl.dataset.movableIndex);

        if (selectedIndex === null) {
            // First selection
            selectedIndex = mi;
            updateTokenDisplay();
        } else if (selectedIndex === mi) {
            // Deselect
            selectedIndex = null;
            updateTokenDisplay();
        } else {
            // Swap!
            performSwap(selectedIndex, mi);
            selectedIndex = null;
            updateTokenDisplay();
            var isCorrect = updateConsole();
            updateUI();
            saveState();
            if (isCorrect) checkWin();
        }
    }

    function performSwap(a, b) {
        var tmpText = movableTokens[a].t;
        movableTokens[a].t = movableTokens[b].t;
        movableTokens[b].t = tmpText;

        swapCount++;
        moveHistory.push({ a: a, b: b });

        // Animate
        animateSwap(a, b);
    }

    function animateSwap(a, b) {
        var tokenEls = codeGrid.querySelectorAll('.token.movable');
        for (var i = 0; i < tokenEls.length; i++) {
            var mi = parseInt(tokenEls[i].dataset.movableIndex);
            if (mi === a || mi === b) {
                tokenEls[i].classList.add('swapping');
                (function (el) {
                    setTimeout(function () { el.classList.remove('swapping'); }, 300);
                })(tokenEls[i]);
            }
        }
    }

    function handleUndo() {
        if (moveHistory.length === 0 || solved) return;

        var last = moveHistory.pop();
        // Reverse the swap
        var tmpText = movableTokens[last.a].t;
        movableTokens[last.a].t = movableTokens[last.b].t;
        movableTokens[last.b].t = tmpText;

        swapCount--;
        selectedIndex = null;
        updateTokenDisplay();
        updateConsole();
        updateUI();
        saveState();
    }

    function handleReset() {
        if (solved && !everSolved) {
            // Don't allow reset before first solve — or do allow it
        }

        // Re-scramble with a seeded shuffle based on puzzle id
        buildTokenArrays();
        solutionOrder = [];
        for (var i = 0; i < movableTokens.length; i++) {
            solutionOrder.push(movableTokens[i].t);
        }

        // Restore the original scrambled arrangement from saved initial state
        if (initialScramble && initialScramble.length === movableTokens.length) {
            for (var j = 0; j < movableTokens.length; j++) {
                movableTokens[j].t = initialScramble[j];
            }
        } else {
            scrambleTokens();
        }

        swapCount = 0;
        moveHistory = [];
        selectedIndex = null;
        solved = false;

        renderCode();
        updateConsole();
        updateUI();
        saveState();
    }

    // Store initial scramble for consistent reset
    var initialScramble = null;

    // =============================================
    // Win Check & Execution Animation
    // =============================================

    function checkWin() {
        var result = tryRunCode();
        if (!result.success) return;

        solved = true;
        var isFirstSolve = !everSolved;
        everSolved = true;

        // Update best score
        if (bestScore === null || swapCount < bestScore) {
            bestScore = swapCount;
        }

        saveState();

        if (isFirstSolve) {
            updateStats(swapCount);
        }

        updateStatsDisplay();

        // Run execution animation, then show win modal
        runExecution(function () {
            showWinModal();
        });
    }

    function showWinModal() {
        var displayScore = swapCount;
        var diff = displayScore - puzzle.par;
        var scoreLabel;
        if (diff < 0) scoreLabel = 'Under Par!';
        else if (diff === 0) scoreLabel = 'Par';
        else if (diff === 1) scoreLabel = 'Bogey';
        else if (diff === 2) scoreLabel = 'Double Bogey';
        else scoreLabel = '+' + diff;

        winPuzzle.textContent = 'Parsed #' + puzzleNumber;
        winScore.textContent = scoreLabel + ' (' + displayScore + ' swap' + (displayScore !== 1 ? 's' : '') + ')';
        winResult.textContent = puzzle.shareResult || '';

        var stats = loadStats();
        if (stats.currentStreak > 1) {
            winStreak.textContent = '\uD83D\uDD25 ' + stats.currentStreak + ' day streak';
        } else {
            winStreak.textContent = '';
        }

        // Username prompt
        var usernamePrompt = document.getElementById('username-prompt');
        if (!getUsername() && !localStorage.getItem('parsed_username_prompted')) {
            usernamePrompt.hidden = false;
        } else {
            usernamePrompt.hidden = true;
        }

        // Share preview
        var sharePreview = document.getElementById('share-preview');
        sharePreview.textContent = getShareText();

        shareBtn.disabled = false;
        winModal.hidden = false;
    }

    // =============================================
    // Execution Animation (Human Resource Machine style)
    // =============================================

    var execTimeout = null;
    var execSkipped = false;

    function runExecution(callback) {
        // Check reduced motion preference
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            callback();
            return;
        }

        execSkipped = false;
        execModal.hidden = false;

        // Build the code from current (solved) tokens
        var codeTokenLines = [];
        var codeDisplayLines = [];
        var tokenIdx = 0;
        for (var l = 0; l < puzzle.lines.length; l++) {
            var tokens = [];
            for (var c = 0; c < puzzle.lines[l].length; c++) {
                tokens.push(currentTokens[tokenIdx].t);
                tokenIdx++;
            }
            codeTokenLines.push(tokens);
            codeDisplayLines.push(tokens.join(' '));
        }

        // Render code in exec modal
        execCode.innerHTML = '';
        for (var i = 0; i < codeDisplayLines.length; i++) {
            var lineEl = document.createElement('div');
            lineEl.className = 'exec-line';
            lineEl.id = 'exec-line-' + i;
            lineEl.textContent = codeDisplayLines[i];
            execCode.appendChild(lineEl);
        }

        execVarsList.innerHTML = '';
        execOutput.textContent = '';

        // Interpret and animate
        var interpreter = new PseudoInterpreter(codeTokenLines);
        var steps = interpreter.execute();

        animateSteps(steps, 0, callback);
    }

    function animateSteps(steps, index, callback) {
        if (execSkipped || index >= steps.length) {
            // Show final output
            if (steps.length > 0) {
                var lastStep = steps[steps.length - 1];
                if (lastStep.output !== undefined) {
                    execOutput.textContent = '> Output: ' + lastStep.output;
                }
            }

            execTimeout = setTimeout(function () {
                execModal.hidden = true;
                callback();
            }, execSkipped ? 0 : 800);
            return;
        }

        var step = steps[index];

        // Highlight current line
        var allLines = execCode.querySelectorAll('.exec-line');
        for (var i = 0; i < allLines.length; i++) {
            allLines[i].classList.remove('active');
            if (i < step.line) allLines[i].classList.add('done');
        }
        var activeLine = document.getElementById('exec-line-' + step.line);
        if (activeLine) activeLine.classList.add('active');

        // Update variables
        if (step.vars) {
            updateExecVars(step.vars, step.changedVar);
        }

        // Show output if present
        if (step.output !== undefined) {
            execOutput.textContent = '> Output: ' + step.output;
        }

        execTimeout = setTimeout(function () {
            animateSteps(steps, index + 1, callback);
        }, 400);
    }

    function updateExecVars(vars, changedVar) {
        execVarsList.innerHTML = '';
        var keys = Object.keys(vars);
        for (var i = 0; i < keys.length; i++) {
            var varEl = document.createElement('div');
            varEl.className = 'exec-var';

            var nameEl = document.createElement('span');
            nameEl.className = 'exec-var-name';
            nameEl.textContent = keys[i];

            var valEl = document.createElement('span');
            valEl.className = 'exec-var-value';
            valEl.textContent = vars[keys[i]];
            if (keys[i] === changedVar) {
                valEl.classList.add('changed');
            }

            varEl.appendChild(nameEl);
            varEl.appendChild(valEl);
            execVarsList.appendChild(varEl);
        }
    }

    function skipExecution() {
        execSkipped = true;
        if (execTimeout) clearTimeout(execTimeout);
        execModal.hidden = true;
    }

    function findToken(line, col) {
        for (var i = 0; i < currentTokens.length; i++) {
            if (currentTokens[i].line === line && currentTokens[i].col === col) {
                return currentTokens[i];
            }
        }
        return null;
    }

    // =============================================
    // Simple Pseudocode Interpreter
    // =============================================

    function PseudoInterpreter(codeLines) {
        this.codeLines = codeLines;
        this.steps = [];
        this.vars = {};
        this.output = null;
    }

    PseudoInterpreter.prototype.execute = function () {
        this.steps = [];
        this.vars = {};
        this.output = null;
        this.executeBlock(0, this.codeLines.length - 1);
        return this.steps;
    };

    PseudoInterpreter.prototype.executeBlock = function (start, end) {
        var i = start;
        var maxSteps = 200; // prevent infinite loops
        var stepCount = 0;

        while (i <= end && stepCount < maxSteps) {
            stepCount++;
            var line = this.codeLines[i];
            if (!line || line.length === 0) { i++; continue; }

            // Skip lone braces
            if (line.length === 1 && (line[0] === '{' || line[0] === '}')) {
                i++;
                continue;
            }

            // Handle: } else {
            if (line[0] === '}' && line.length > 1) {
                i++;
                continue;
            }

            var firstToken = line[0];

            if (firstToken === 'let') {
                // let x = expr
                var varName = line[1];
                var expr = line.slice(3).filter(function (t) { return t !== '{' && t !== '}'; });
                var value = this.evalExpr(expr);
                this.vars[varName] = value;
                this.addStep(i, varName);
                i++;
            } else if (firstToken === 'return') {
                var retExpr = line.slice(1);
                var retVal = this.evalExpr(retExpr);
                this.output = retVal;
                this.addStep(i, null, retVal);
                i++;
            } else if (firstToken === 'while') {
                // Find matching }
                var whileEnd = this.findBlockEnd(i);
                var condTokens = this.getConditionTokens(line);
                var loopCount = 0;

                while (this.evalCondition(condTokens) && loopCount < 50) {
                    this.addStep(i, null);
                    this.executeBlock(i + 1, whileEnd - 1);
                    loopCount++;
                }
                this.addStep(i, null); // final condition check (false)
                i = whileEnd + 1;
            } else if (firstToken === 'if') {
                var ifEnd = this.findBlockEnd(i);
                var condToks = this.getConditionTokens(line);
                this.addStep(i, null);

                if (this.evalCondition(condToks)) {
                    this.executeBlock(i + 1, ifEnd - 1);
                    // Skip past else block if present
                    if (ifEnd + 1 <= end) {
                        var nextLine = this.codeLines[ifEnd];
                        if (nextLine && nextLine.length > 1 && nextLine[1] === 'else') {
                            var elseEnd = this.findBlockEnd(ifEnd);
                            i = elseEnd + 1;
                        } else {
                            i = ifEnd + 1;
                        }
                    } else {
                        i = ifEnd + 1;
                    }
                } else {
                    // Check for else
                    var elseBlockStart = -1;
                    var closeLine = this.codeLines[ifEnd];
                    if (closeLine && closeLine.length > 1 && closeLine[1] === 'else') {
                        elseBlockStart = ifEnd;
                        var elseEnd2 = this.findBlockEnd(elseBlockStart);
                        this.executeBlock(elseBlockStart + 1, elseEnd2 - 1);
                        i = elseEnd2 + 1;
                    } else {
                        i = ifEnd + 1;
                    }
                }
            } else {
                // Assignment: x = expr
                var assignVar = line[0];
                if (line.length >= 3 && line[1] === '=') {
                    var assignExpr = line.slice(2);
                    var assignVal = this.evalExpr(assignExpr);
                    this.vars[assignVar] = assignVal;
                    this.addStep(i, assignVar);
                }
                i++;
            }
        }
    };

    PseudoInterpreter.prototype.getConditionTokens = function (line) {
        // Extract tokens between keyword and {
        var tokens = [];
        var started = false;
        for (var i = 0; i < line.length; i++) {
            if (line[i] === '{') break;
            if (started) tokens.push(line[i]);
            if (line[i] === 'while' || line[i] === 'if') started = true;
        }
        return tokens;
    };

    PseudoInterpreter.prototype.evalCondition = function (tokens) {
        if (tokens.length === 3) {
            var left = this.resolveValue(tokens[0]);
            var op = tokens[1];
            var right = this.resolveValue(tokens[2]);
            switch (op) {
                case '<': return left < right;
                case '>': return left > right;
                case '<=': return left <= right;
                case '>=': return left >= right;
                case '==': return left === right;
                case '!=': return left !== right;
            }
        }
        return false;
    };

    PseudoInterpreter.prototype.evalExpr = function (tokens) {
        if (tokens.length === 0) return 0;
        if (tokens.length === 1) return this.resolveValue(tokens[0]);

        // Simple left-to-right evaluation (no precedence for now)
        var result = this.resolveValue(tokens[0]);
        for (var i = 1; i < tokens.length - 1; i += 2) {
            var op = tokens[i];
            var right = this.resolveValue(tokens[i + 1]);
            switch (op) {
                case '+': result = result + right; break;
                case '-': result = result - right; break;
                case '*': result = result * right; break;
                case '/': result = right !== 0 ? Math.floor(result / right) : 0; break;
            }
        }
        return result;
    };

    PseudoInterpreter.prototype.resolveValue = function (token) {
        // Number literal?
        var num = Number(token);
        if (!isNaN(num) && token !== '') return num;
        // Variable?
        if (this.vars.hasOwnProperty(token)) return this.vars[token];
        return 0;
    };

    PseudoInterpreter.prototype.findBlockEnd = function (startLine) {
        var depth = 0;
        for (var i = startLine; i < this.codeLines.length; i++) {
            var line = this.codeLines[i];
            for (var j = 0; j < line.length; j++) {
                if (line[j] === '{') depth++;
                if (line[j] === '}') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
        }
        return this.codeLines.length - 1;
    };

    PseudoInterpreter.prototype.addStep = function (lineIdx, changedVar, output) {
        var varsCopy = {};
        var keys = Object.keys(this.vars);
        for (var i = 0; i < keys.length; i++) {
            varsCopy[keys[i]] = this.vars[keys[i]];
        }
        var step = { line: lineIdx, vars: varsCopy, changedVar: changedVar || null };
        if (output !== undefined) {
            step.output = output;
            this.output = output;
        }
        this.steps.push(step);
    };

    // =============================================
    // UI Updates
    // =============================================

    function updateUI() {
        swapsUsed.textContent = swapCount;
        undoBtn.disabled = moveHistory.length === 0 || solved;
    }

    function updateStatsDisplay() {
        var stats = loadStats();
        document.getElementById('streak-count').textContent = stats.currentStreak;
        document.getElementById('solved-count').textContent = stats.solved;
    }

    // =============================================
    // Theme
    // =============================================

    function initTheme() {
        var saved = localStorage.getItem('parsed_theme');
        var themeBtn = document.getElementById('theme-btn');

        if (saved === 'light') {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
            themeBtn.innerHTML = '&#9728;'; // sun
        } else if (saved === 'dark') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
            themeBtn.innerHTML = '&#9790;'; // moon
        }
        // else: follow OS preference (no class)
    }

    function toggleTheme() {
        var themeBtn = document.getElementById('theme-btn');
        var isLight = document.documentElement.classList.contains('light-theme') ||
            (!document.documentElement.classList.contains('dark-theme') &&
                window.matchMedia('(prefers-color-scheme: light)').matches);

        if (isLight) {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
            localStorage.setItem('parsed_theme', 'dark');
            themeBtn.innerHTML = '&#9790;';
        } else {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
            localStorage.setItem('parsed_theme', 'light');
            themeBtn.innerHTML = '&#9728;';
        }
    }

    // =============================================
    // Username
    // =============================================

    function setupUsernameListeners() {
        var usernameBtn = document.getElementById('username-btn');
        var usernameModal = document.getElementById('username-modal');
        var usernameModalClose = document.getElementById('username-modal-close');
        var usernameModalInput = document.getElementById('username-modal-input');
        var usernameModalSave = document.getElementById('username-modal-save');
        var usernameModalSkip = document.getElementById('username-modal-skip');
        var usernameInput = document.getElementById('username-input');
        var usernameSave = document.getElementById('username-save');
        var usernameSkip = document.getElementById('username-skip');

        usernameBtn.addEventListener('click', function () {
            usernameModalInput.value = getUsername();
            usernameModal.hidden = false;
        });
        usernameModalClose.addEventListener('click', function () { usernameModal.hidden = true; });
        usernameModal.addEventListener('click', function (e) { if (e.target === usernameModal) usernameModal.hidden = true; });
        usernameModalSave.addEventListener('click', function () {
            saveUsername(usernameModalInput.value.trim());
            usernameModal.hidden = true;
        });
        usernameModalSkip.addEventListener('click', function () { usernameModal.hidden = true; });
        usernameModalInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                saveUsername(usernameModalInput.value.trim());
                usernameModal.hidden = true;
            }
        });

        // Win modal username
        if (usernameSave) {
            usernameSave.addEventListener('click', function () {
                saveUsername(usernameInput.value.trim());
                document.getElementById('username-prompt').hidden = true;
                document.getElementById('share-preview').textContent = getShareText();
            });
        }
        if (usernameSkip) {
            usernameSkip.addEventListener('click', function () {
                localStorage.setItem('parsed_username_prompted', '1');
                document.getElementById('username-prompt').hidden = true;
            });
        }
        if (usernameInput) {
            usernameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    saveUsername(usernameInput.value.trim());
                    document.getElementById('username-prompt').hidden = true;
                    document.getElementById('share-preview').textContent = getShareText();
                }
            });
        }
    }

    function getUsername() {
        return localStorage.getItem('parsed_username') || '';
    }

    function saveUsername(name) {
        if (name) {
            localStorage.setItem('parsed_username', name);
        } else {
            localStorage.removeItem('parsed_username');
        }
    }

    // =============================================
    // Persistence
    // =============================================

    function getStorageKey() {
        return STORAGE_KEY;
    }

    function saveState() {
        var data = loadData();
        data.version = SAVE_VERSION;
        var prevToday = data.today || {};

        // Save current movable token arrangement
        var arrangement = movableTokens.map(function (t) { return t.t; });

        data.today = {
            date: getTodayKey(),
            puzzleNumber: puzzleNumber,
            solved: solved,
            everSolved: prevToday.everSolved || solved,
            arrangement: arrangement,
            initialScramble: initialScramble,
            swapCount: swapCount,
            bestScore: prevToday.bestScore || null,
            par: puzzle.par,
            moveHistory: moveHistory
        };

        if (solved) {
            if (data.today.bestScore === null || swapCount < data.today.bestScore) {
                data.today.bestScore = swapCount;
            }
        }

        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(data));
        } catch (e) { }
    }

    function restoreState() {
        var data = loadData();
        if (!data.today || data.today.date !== getTodayKey()) return false;

        if (data.today.arrangement && data.today.arrangement.length === movableTokens.length) {
            for (var i = 0; i < movableTokens.length; i++) {
                movableTokens[i].t = data.today.arrangement[i];
            }
        }

        if (data.today.initialScramble) {
            initialScramble = data.today.initialScramble;
        }

        swapCount = data.today.swapCount || 0;
        moveHistory = data.today.moveHistory || [];
        solved = !!data.today.solved;
        everSolved = !!data.today.everSolved;
        bestScore = data.today.bestScore || null;

        return true;
    }

    function loadData() {
        try {
            var raw = localStorage.getItem(getStorageKey());
            if (raw) {
                var data = JSON.parse(raw);
                if (data.version !== SAVE_VERSION) {
                    return { version: SAVE_VERSION, today: null, stats: data.stats || null, lastCompletedDate: data.lastCompletedDate || null };
                }
                return data;
            }
        } catch (e) { }
        return { version: SAVE_VERSION, today: null, stats: null, lastCompletedDate: null };
    }

    function getTodayKey() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // =============================================
    // Stats
    // =============================================

    function loadStats() {
        var data = loadData();
        return data.stats || { played: 0, solved: 0, currentStreak: 0, maxStreak: 0,  distribution: {} };
    }

    function updateStats(swapsMade) {
        var data = loadData();
        var stats = data.stats || { played: 0, solved: 0, currentStreak: 0, maxStreak: 0,  distribution: {} };

        stats.played++;
        stats.solved++;

        var today = getTodayKey();
        var yesterday = getYesterdayKey();

        if (data.lastCompletedDate === yesterday) {
            stats.currentStreak++;
        } else if (data.lastCompletedDate !== today) {
            stats.currentStreak = 1;
        }

        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        data.lastCompletedDate = today;

        var diff = swapsMade - puzzle.par;
        var label = diff <= 0 ? 'par_or_under' : '+' + diff;
        stats.distribution[label] = (stats.distribution[label] || 0) + 1;

        data.stats = stats;
        try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch (e) { }
    }

    function getYesterdayKey() {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // =============================================
    // Share
    // =============================================

    function getShareText() {
        if (typeof generateShareText !== 'function') return '';
        var stats = loadStats();
        return generateShareText(puzzleNumber, swapCount, puzzle.shareResult || '', stats.currentStreak, getUsername());
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
                title: 'Parsed #' + puzzleNumber,
                text: text
            }).catch(function () { /* user cancelled */ });
        } else {
            copyResults();
        }
    }

    // =============================================
    // Start
    // =============================================

    initTheme();
    init();

    // Save initial scramble after init (so reset can restore it)
    if (!initialScramble) {
        initialScramble = movableTokens.map(function (t) { return t.t; });
        saveState();
    }

})();
