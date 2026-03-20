// ============================================
// Parsed — Core Game Engine
// Tap-to-swap code tokens to fix buggy programs
// ============================================

(function () {
    'use strict';

    var SAVE_VERSION = 3;
    var STORAGE_KEY = 'parsed_data';

    // Debug mode: ?puzzle=N loads puzzle N (0-indexed) without affecting daily save
    // Only works on file:// or localhost — disabled in production
    var debugMode = false;
    (function () {
        var loc = window.location;
        var isLocal = loc.protocol === 'file:' || loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
        if (!isLocal) return;
        var params = new URLSearchParams(loc.search);
        if (params.has('puzzle')) {
            var idx = parseInt(params.get('puzzle'), 10);
            if (!isNaN(idx) && idx >= 0 && idx < PUZZLES.length) {
                debugMode = true;
                window._debugPuzzleIndex = idx;
            }
        }
    })();

    // --- Game State ---
    var puzzle = null;
    var puzzleNumber = 0;
    var currentTokens = [];   // flat array: [{t, y, f, line, col, solutionIndex}]
    var movableTokens = [];   // subset of currentTokens where f===0
    var solutionOrder = [];   // the correct text values for each movable slot
    var solutionVars = null;  // expected final variable state from correct arrangement
    var solutionReturn = null; // expected return line tokens from correct arrangement
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
        if (debugMode) {
            puzzle = JSON.parse(JSON.stringify(PUZZLES[window._debugPuzzleIndex]));
            puzzleNumber = window._debugPuzzleIndex + 1;
        } else {
            puzzle = getDailyPuzzle();
            puzzleNumber = getDailyPuzzleNumber();
        }

        puzzleNumberEl.textContent = (debugMode ? 'Debug ' : '') + 'Puzzle #' + puzzleNumber;
        puzzleDateEl.textContent = debugMode ? 'Debug Mode' : getTodayDateString();
        parValue.textContent = puzzle.par;
        goalText.textContent = puzzle.goal;

        // Build token arrays from puzzle data
        buildTokenArrays();

        // Store the solution order (correct arrangement of movable tokens)
        solutionOrder = [];
        for (var i = 0; i < movableTokens.length; i++) {
            solutionOrder.push(movableTokens[i].t);
        }

        // Capture the solution's return line tokens
        solutionReturn = null;
        for (var rl = 0; rl < puzzle.lines.length; rl++) {
            if (puzzle.lines[rl][0].t === 'return') {
                solutionReturn = [];
                for (var rc = 1; rc < puzzle.lines[rl].length; rc++) {
                    solutionReturn.push(puzzle.lines[rl][rc].t);
                }
                break;
            }
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

            // Check return expression FIRST — catches returning the wrong
            // variable (e.g. 'return fuel' instead of 'return altitude')
            // regardless of whether the output value happens to match.
            if (solutionReturn) {
                var playerReturn = null;
                for (var ri = 0; ri < codeLines.length; ri++) {
                    if (codeLines[ri][0] === 'return') {
                        playerReturn = codeLines[ri].slice(1);
                        break;
                    }
                }
                if (playerReturn) {
                    var returnMatch = playerReturn.length === solutionReturn.length;
                    if (returnMatch) {
                        for (var rj = 0; rj < solutionReturn.length; rj++) {
                            if (playerReturn[rj] !== solutionReturn[rj]) {
                                returnMatch = false;
                                break;
                            }
                        }
                    }
                    if (!returnMatch) {
                        return { success: false, type: 'logic', output: outputStr, errors: ['> returning the wrong value \u2014 re-read the prompt'] };
                    }
                }
            }

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
            var errMsg = e.message || 'unexpected token arrangement';
            return { success: false, type: 'compile', errors: ['error: ' + errMsg] };
        }
    }


    function validateStructure(codeLines) {
        var errors = [];
        var declared = {}; // track variables declared with 'let'
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
                } else {
                    declared[line[1]] = true;
                }
                // Check expression tokens after = (variables used here must already be declared)
                var exprErr = validateExpr(line.slice(3), ln, declared, line[1]);
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
                    // Check that variables in condition are declared
                    for (var j2 = 1; j2 < line.length - 1; j2++) {
                        var ct = line[j2];
                        if (!isOperator(ct) && !isKeyword(ct) && ct !== '{' && ct !== '}' && isNaN(Number(ct)) && !declared[ct]) {
                            errors.push('line ' + ln + ': \'' + ct + '\' is not defined');
                            break;
                        }
                    }
                }
            } else if (first === 'for') {
                // for <id> = <value> to <value> {
                var lastTokFor = line[line.length - 1];
                if (lastTokFor !== '{') {
                    errors.push('line ' + ln + ': expected \'{\' at end of for statement');
                }
                if (line.length < 7) {
                    errors.push('line ' + ln + ': incomplete for statement — expected: for <var> = <start> to <end> {');
                } else {
                    if (isKeyword(line[1]) && line[1] !== 'to') {
                        errors.push('line ' + ln + ': \'' + line[1] + '\' is a keyword, not a variable name');
                    }
                    if (line[2] !== '=') {
                        errors.push('line ' + ln + ': expected \'=\' after \'' + line[1] + '\', got \'' + line[2] + '\'');
                    }
                    if (line[4] !== 'to') {
                        errors.push('line ' + ln + ': expected \'to\' in for statement, got \'' + line[4] + '\'');
                    }
                    // Check start value
                    var forStart = line[3];
                    if (isNaN(Number(forStart)) && !declared[forStart]) {
                        errors.push('line ' + ln + ': \'' + forStart + '\' is not defined');
                    }
                    // Check end value
                    var forEnd = line[5];
                    if (isNaN(Number(forEnd)) && !declared[forEnd]) {
                        errors.push('line ' + ln + ': \'' + forEnd + '\' is not defined');
                    }
                    // Declare the loop variable
                    declared[line[1]] = true;
                }
            } else if (first === 'return') {
                if (line.length < 2) {
                    errors.push('line ' + ln + ': return with no value');
                } else {
                    var retErr = validateExpr(line.slice(1), ln, declared);
                    if (retErr) errors.push(retErr);
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
                } else if (!declared[first]) {
                    errors.push('line ' + ln + ': can\'t assign to \'' + first + '\' — not declared');
                } else {
                    // Check expression tokens after =
                    var assignErr = validateExpr(line.slice(2), ln, declared, first);
                    if (assignErr) errors.push(assignErr);
                }
            }
        }
        return errors;
    }

    function validateExpr(tokens, lineNum, declared, assignTarget) {
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
        // Check for undeclared variables in expression
        if (declared) {
            for (var j = 0; j < filtered.length; j++) {
                var tok = filtered[j];
                if (!isArithOp(tok) && !isOperator(tok) && !isKeyword(tok) && isNaN(Number(tok)) && tok !== '' && !declared[tok]) {
                    if (assignTarget) {
                        return 'line ' + lineNum + ': can\'t set \'' + assignTarget + '\' to \'' + tok + '\' \u2014 \'' + tok + '\' not declared';
                    }
                    return 'line ' + lineNum + ': \'' + tok + '\' is not defined';
                }
            }
        }
        return null;
    }

    function isKeyword(t) {
        return t === 'let' || t === 'while' || t === 'if' || t === 'else' || t === 'return' || t === 'for' || t === 'to';
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

        var walkthroughBtn = document.getElementById('win-walkthrough-btn');
        if (walkthroughBtn) {
            walkthroughBtn.addEventListener('click', function () {
                winModal.hidden = true;
                runExecution(function () { showWinModal(); });
            });
        }

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

        // Exec replay and continue
        var execReplay = document.getElementById('exec-replay');
        var execContinue = document.getElementById('exec-continue');
        if (execReplay) {
            execReplay.addEventListener('click', function () {
                runExecution(execCallback || function () { showWinModal(); });
            });
        }
        if (execContinue) {
            execContinue.addEventListener('click', function () {
                execModal.hidden = true;
                var sceneEl = document.getElementById('exec-scene');
                if (sceneEl) sceneEl.hidden = true;
                if (execCallback) execCallback();
            });
        }

        // Step arrows
        var stepPrev = document.getElementById('exec-step-prev');
        var stepNext = document.getElementById('exec-step-next');
        if (stepPrev) {
            stepPrev.addEventListener('click', function () {
                if (execCurrentStep > 0) showStepState(execCurrentStep - 1);
            });
        }
        if (stepNext) {
            stepNext.addEventListener('click', function () {
                if (execSteps && execCurrentStep < execSteps.length - 1) showStepState(execCurrentStep + 1);
            });
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
        if (diff <= -3) scoreLabel = 'Genius!';
        else if (diff === -2) scoreLabel = 'Hacker!';
        else if (diff === -1) scoreLabel = 'Optimized!';
        else if (diff === 0) scoreLabel = 'Compiled';
        else if (diff === 1) scoreLabel = 'Verbose';
        else scoreLabel = 'Spaghetti (+' + diff + ')';

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

    // Scene config: emoji + driver variable for each puzzle's visual animation
    var SCENE_CONFIGS = {
        '6b16bbe0': { emoji: '\uD83D\uDCF8', driverVar: 'photos', min: 0, max: 36, label: 'Photos' },
        '13742abb': { emoji: '\uD83C\uDFC5', driverVar: 'medals', min: 0, max: 40, label: 'Medals' },
        '2285009f': { emoji: '\uD83D\uDCB0', driverVar: 'tips', min: 0, max: 30, label: 'Tips' },
        '8b795b27': { emoji: '\uD83E\uDD3F', driverVar: 'dives', min: 0, max: 6, label: 'Dives' },
        '2edd3cd4': { emoji: '\u23F0', driverVar: 'alerts', min: 0, max: 7, label: 'Alerts' },
        'efdd0f88': { emoji: '\uD83C\uDFC6', driverVar: 'points', min: 0, max: 27, label: 'Points' },
        '5a167cf6': { emoji: '\uD83C\uDF4E', driverVar: 'apples', min: 0, max: 30, label: 'Apples' },
        '30a53333': { emoji: '\uD83D\uDD25', driverVar: 'heat', min: 0, max: 40, label: 'Heat' },
        '5dc31d36': { emoji: '\uD83C\uDF3C', driverVar: 'petals', min: 0, max: 21, label: 'Petals' },
        '677ab47e': { emoji: '\uD83E\uDE9A', driverVar: 'build', min: 0, max: 5, label: 'Build' },
        '97c42368': { emoji: '\uD83D\uDCA8', driverVar: 'releases', min: 0, max: 4, label: 'Releases' },
        'f16e140d': { emoji: '\uD83E\uDDA0', driverVar: 'virus', min: 1, max: 27, label: 'Virus' },
        '5b6a6850': { emoji: '\uD83D\uDEE1\uFE0F', driverVar: 'block', min: 0, max: 15, label: 'Block' },
        'be206f98': { emoji: '\uD83D\uDD25', driverVar: 'fire', min: 2, max: 128, label: 'Fire' },
        '094c8ffb': { emoji: '\uD83C\uDFF0', driverVar: 'rounds', min: 0, max: 5, label: 'Rounds' },
        '7b1bb33c': { emoji: '\uD83C\uDFAE', driverVar: 'score', min: 0, max: 18, label: 'Score' },
        'fd333878': { emoji: '\uD83C\uDF3B', driverVar: 'planted', min: 0, max: 50, label: 'Planted' },
        'b263a254': { emoji: '\uD83C\uDF40', driverVar: 'prize', min: 0, max: 21, label: 'Prize' },
        '8908a096': { emoji: '\uD83D\uDCAA', driverVar: 'reps', min: 0, max: 40, label: 'Reps' },
        '38299576': { emoji: '\uD83D\uDD2B', driverVar: 'shots', min: 0, max: 5, label: 'Shots' },
        'e25e49d5': { emoji: '\uD83C\uDFAE', driverVar: 'score', min: 0, max: 26, label: 'Score' },
        '648311ed': { emoji: '\uD83D\uDDE3\uFE0F', driverVar: 'rumor', min: 3, max: 81, label: 'Rumor' },
        'afb93d55': { emoji: '\uD83E\uDE9A', driverVar: 'builds', min: 0, max: 6, label: 'Builds' },
        '2f7faf96': { emoji: '\uD83D\uDD0C', driverVar: 'circuits', min: 0, max: 9, label: 'Circuits' },
        'fdcee658': { emoji: '\uD83C\uDF89', driverVar: 'bonus', min: 0, max: 90, label: 'Bonus' },
        '9dd9ccd9': { emoji: '\u26FD', driverVar: 'range', min: 0, max: 90, label: 'Range' },
        '1d387d14': { emoji: '\uD83C\uDFB5', driverVar: 'melody', min: 0, max: 56, label: 'Melody' },
        '15e09003': { emoji: '\uD83C\uDF3F', driverVar: 'algae', min: 3, max: 48, label: 'Algae' },
        '7c363a1e': { emoji: '\uD83D\uDCB0', driverVar: 'buy', min: 0, max: 20, label: 'Buy' },
        '1ec60aab': { emoji: '\u2B50', driverVar: 'level', min: 0, max: 60, label: 'Level' },
        '6dc3f31c': { emoji: '\uD83C\uDFA3', driverVar: 'fish', min: 0, max: 12, label: 'Fish' },
        'ea88ec70': { emoji: '\uD83D\uDCAA', driverVar: 'reps', min: 0, max: 50, label: 'Reps' },
        '6c3a7cd2': { emoji: '\uD83C\uDFAE', driverVar: 'score', min: 0, max: 75, label: 'Score' },
        'b493c717': { emoji: '\uD83E\uDDF5', driverVar: 'patches', min: 0, max: 45, label: 'Patches' },
        '332ce4dd': { emoji: '\uD83E\uDD3F', driverVar: 'dives', min: 0, max: 6, label: 'Dives' },
        '61a5b268': { emoji: '\uD83C\uDF73', driverVar: 'dishes', min: 0, max: 24, label: 'Dishes' },
        'f23a3731': { emoji: '\u26C4', driverVar: 'snowball', min: 1, max: 81, label: 'Snowball' },
        '38df1572': { emoji: '\uD83C\uDFB6', driverVar: 'beats', min: 0, max: 210, label: 'Beats' },
        '91b3e052': { emoji: '\uD83C\uDF66', driverVar: 'scoops', min: 0, max: 12, label: 'Scoops' },
        '6ba0dd70': { emoji: '\uD83D\uDD25', driverVar: 'sparks', min: 0, max: 28, label: 'Sparks' },
        '72e6ca6c': { emoji: '\uD83D\uDD0A', driverVar: 'echo', min: 2, max: 162, label: 'Echo' },
        'fa6967ca': { emoji: '\uD83C\uDFC0', driverVar: 'height', min: 0, max: 30, label: 'Height' },
        '72469923': { emoji: '\uD83E\uDE62', driverVar: 'knots', min: 0, max: 7, label: 'Knots' },
        'f1b82017': { emoji: '\uD83C\uDF27\uFE0F', driverVar: 'erosion', min: 0, max: 35, label: 'Erosion' },
        '0b2bf48c': { emoji: '\uD83E\uDD50', driverVar: 'pastries', min: 0, max: 9, label: 'Pastries' },
        'fd78e80d': { emoji: '\uD83C\uDF44', driverVar: 'mold', min: 3, max: 81, label: 'Mold' },
        '2f3e6cdb': { emoji: '\uD83C\uDF0A', driverVar: 'ripple', min: 1, max: 32, label: 'Ripple' },
        '2bc68e51': { emoji: '\uD83C\uDFF9', driverVar: 'arrows', min: 0, max: 36, label: 'Arrows' },
        'e9601fd8': { emoji: '\uD83C\uDFA8', driverVar: 'layers', min: 0, max: 24, label: 'Layers' },
        '2b304229': { emoji: '\uD83D\uDDE3\uFE0F', driverVar: 'rumor', min: 1, max: 216, label: 'Rumor' },
        '969d30ae': { emoji: '\uD83C\uDF21\uFE0F', driverVar: 'status', min: 0, max: 25, label: 'Status' },
        'dee848df': { emoji: '\uD83D\uDEAC', driverVar: 'altitude', min: 125, max: 200, label: 'Altitude' },
        'd1fa4717': { emoji: '\uD83E\uDDE9', driverVar: 'moves', min: 0, max: 5, label: 'Moves' },
        '00695251': { emoji: '\uD83C\uDFAF', driverVar: 'reward', min: 0, max: 24, label: 'Reward' },
        '14d2db46': { emoji: '\u2728', driverVar: 'gold', min: 0, max: 27, label: 'Gold' },
        '001dc6ba': { emoji: '\uD83D\uDD2C', driverVar: 'tests', min: 0, max: 21, label: 'Tests' },
        'a431e82d': { emoji: '\u26A1', driverVar: 'voltage', min: 5, max: 14, label: 'Voltage' },
        'edfa7426': { emoji: '\uD83C\uDF3F', driverVar: 'rows', min: 0, max: 4, label: 'Rows' },
        'b76a901b': { emoji: '\uD83C\uDF3E', driverVar: 'flour', min: 36, max: 36, label: 'Flour' },
        '64313db8': { emoji: '\uD83C\uDF7A', driverVar: 'brew', min: 0, max: 30, label: 'Brew' },
        'd6f23b22': { emoji: '\uD83D\uDC38', driverVar: 'jumps', min: 0, max: 5, label: 'Jumps' },
        '2754b7fd': { emoji: '\uD83D\uDE97', driverVar: 'distance', min: 0, max: 35, label: 'Distance' },
        'db8fdff2': { emoji: '\uD83D\uDD25', driverVar: 'cooked', min: 0, max: 5, label: 'Cooked' },
        'e92de4f1': { emoji: '\uD83C\uDF3B', driverVar: 'flowers', min: 0, max: 18, label: 'Flowers' },
        '4ae2abd9': { emoji: '\uD83C\uDF31', driverVar: 'size', min: 0, max: 25, label: 'Size' },
        '0b6a5f67': { emoji: '\uD83D\uDCDA', driverVar: 'stacks', min: 0, max: 36, label: 'Stacks' },
        '918f1342': { emoji: '\u2744\uFE0F', driverVar: 'depth', min: 0, max: 20, label: 'Depth' },
        '7d500b85': { emoji: '\uD83D\uDCB0', driverVar: 'loot', min: 0, max: 75, label: 'Loot' },
        '10efcc40': { emoji: '\uD83D\uDEA8', driverVar: 'fine', min: 0, max: 50, label: 'Fine' },
        '22a1235e': { emoji: '\uD83D\uDCB8', driverVar: 'savings', min: 0, max: 60, label: 'Savings' },
        'f2162787': { emoji: '\u2764\uFE0F', driverVar: 'health', min: 65, max: 80, label: 'Health' },
        'bfb6cafc': { emoji: '\uD83D\uDCBB', driverVar: 'quality', min: 0, max: 50, label: 'Quality' },
        'f6732a36': { emoji: '\uD83D\uDEB6', driverVar: 'steps', min: 0, max: 40, label: 'Steps' },
        '27848ed3': { emoji: '\uD83D\uDE80', driverVar: 'thrust', min: 0, max: 50, label: 'Thrust' },
        '31aa35c7': { emoji: '\uD83C\uDFD4\uFE0F', driverVar: 'altitude', min: 100, max: 160, label: 'Altitude' },
        'bda71467': { emoji: '\u26C8\uFE0F', driverVar: 'storm', min: 0, max: 10, label: 'Storm' },
        '7b590e97': { emoji: '\u2694\uFE0F', driverVar: 'rooms', min: 0, max: 8, label: 'Rooms' },
        '0c5de7b0': { emoji: '\uD83C\uDFF4\u200D\u2620\uFE0F', driverVar: 'crew', min: 90, max: 90, label: 'Crew' },
        '35fcdf18': { emoji: '\uD83C\uDFF0', driverVar: 'volleys', min: 0, max: 10, label: 'Volleys' },
        '0abe0386': { emoji: '\uD83E\uDDEC', driverVar: 'cells', min: 1, max: 32, label: 'Cells' },
        'c74463c8': { emoji: '\uD83D\uDCE6', driverVar: 'boxes', min: 0, max: 6, label: 'Boxes' },
        'f574d4f2': { emoji: '\u26CF\uFE0F', driverVar: 'gold', min: 0, max: 36, label: 'Gold' },
        'e44f7deb': { emoji: '\uD83D\uDCAF', driverVar: 'grade', min: 0, max: 90, label: 'Grade' },
        'f0718abd': { emoji: '\uD83D\uDDA8\uFE0F', driverVar: 'prints', min: 0, max: 4, label: 'Prints' },
        '8bfb2b77': { emoji: '\uD83D\uDD0A', driverVar: 'ticks', min: 0, max: 6, label: 'Ticks' },
        '35d1e050': { emoji: '\uD83D\uDD17', driverVar: 'chain', min: 2, max: 32, label: 'Chain' },
        '5aba8bd9': { emoji: '\uD83E\uDE9A', driverVar: 'planks', min: 0, max: 21, label: 'Planks' },
        'f762b380': { emoji: '\uD83C\uDF27\uFE0F', driverVar: 'collected', min: 0, max: 60, label: 'Collected' },
        '1227482a': { emoji: '\uD83C\uDF6A', driverVar: 'cookies', min: 0, max: 36, label: 'Cookies' },
        '680c5341': { emoji: '\uD83C\uDF3E', driverVar: 'crops', min: 0, max: 4, label: 'Crops' },
        'd2a5f22d': { emoji: '\uD83D\uDCB0', driverVar: 'earned', min: 0, max: 70, label: 'Earned' },
        '47705d50': { emoji: '\uD83C\uDFB6', driverVar: 'rhythm', min: 21, max: 21, label: 'Rhythm' },
        '1e43120c': { emoji: '\uD83C\uDF66', driverVar: 'cones', min: 0, max: 12, label: 'Cones' },
        '155132d5': { emoji: '\uD83C\uDF3E', driverVar: 'harvest', min: 0, max: 22, label: 'Harvest' },
        '49ca2f94': { emoji: '\uD83D\uDC3A', driverVar: 'herd', min: 0, max: 25, label: 'Herd' },
        '86738f69': { emoji: '\uD83E\uDE99', driverVar: 'vault', min: 0, max: 30, label: 'Vault' },
        'fc918a7f': { emoji: '\u2699\uFE0F', driverVar: 'alloy', min: 0, max: 30, label: 'Alloy' },
        '82856fbe': { emoji: '\uD83C\uDFF0', driverVar: 'waves', min: 0, max: 5, label: 'Waves' },
        'de2e9d6a': { emoji: '\uD83D\uDCB0', driverVar: 'savings', min: 0, max: 30, label: 'Savings' },
        'f82620d5': { emoji: '\uD83D\uDCA5', driverVar: 'dmg', min: 24, max: 24, label: 'Dmg' },
        'ea73f574': { emoji: '\uD83C\uDFE0', driverVar: 'spent', min: 0, max: 360, label: 'Spent' },
        '31f834cb': { emoji: '\uD83C\uDFC3', driverVar: 'collected', min: 0, max: 45, label: 'Collected' },
        '75b2b0b0': { emoji: '\uD83C\uDFF4\u200D\u2620\uFE0F', driverVar: 'days', min: 0, max: 7, label: 'Days' },
        '343cc243': { emoji: '\uD83C\uDFB5', driverVar: 'seconds', min: 16, max: 16, label: 'Seconds' },
        'e31b9229': { emoji: '\uD83C\uDFB8', driverVar: 'tune', min: 0, max: 6, label: 'Tune' },
        '2ebc1ddb': { emoji: '\uD83C\uDF3E', driverVar: 'bushels', min: 0, max: 56, label: 'Bushels' },
        'c02e973e': { emoji: '\uD83C\uDF0A', driverVar: 'ripple', min: 1, max: 128, label: 'Ripple' },
        '8b1b5a52': { emoji: '\uD83D\uDCAA', driverVar: 'muscle', min: 0, max: 40, label: 'Muscle' },
        'ef80e36f': { emoji: '\uD83C\uDF31', driverVar: 'crop', min: 0, max: 5, label: 'Crop' },
        '6ed0d99c': { emoji: '\u2600\uFE0F', driverVar: 'watts', min: 0, max: 48, label: 'Watts' },
        'e48b0f7d': { emoji: '\uD83C\uDFD7\uFE0F', driverVar: 'blocks', min: 0, max: 28, label: 'Blocks' },
        'ed366344': { emoji: '\uD83D\uDEA2', driverVar: 'trips', min: 0, max: 10, label: 'Trips' },
        '136ba642': { emoji: '\uD83C\uDFAF', driverVar: 'total', min: 0, max: 70, label: 'Total' },
        '6804a0d4': { emoji: '\u2622\uFE0F', driverVar: 'energy', min: 0, max: 60, label: 'Energy' },
        'c62e5ad9': { emoji: '\uD83C\uDF89', driverVar: 'morale', min: 60, max: 95, label: 'Morale' },
        '955cd209': { emoji: '\uD83D\uDE80', driverVar: 'thrust', min: 0, max: 65, label: 'Thrust' },
        'b96b1dbe': { emoji: '\uD83C\uDFED', driverVar: 'output', min: 0, max: 42, label: 'Output' },
        '57b2e72f': { emoji: '\uD83C\uDF72', driverVar: 'broth', min: 35, max: 35, label: 'Broth' },
        'a5c7b7c5': { emoji: '\uD83C\uDF6C', driverVar: 'snacks', min: 0, max: 15, label: 'Snacks' },
        '0a974eaa': { emoji: '\uD83E\uDDE3', driverVar: 'scarves', min: 0, max: 7, label: 'Scarves' },
        'f8292273': { emoji: '\uD83D\uDEF0\uFE0F', driverVar: 'burns', min: 0, max: 4, label: 'Burns' },
        '1e8ef0fe': { emoji: '\uD83C\uDF86', driverVar: 'fireworks', min: 0, max: 30, label: 'Fireworks' },
        'd2e136a1': { emoji: '\u2694\uFE0F', driverVar: 'blade', min: 40, max: 40, label: 'Blade' },
        '390cd8f7': { emoji: '\uD83D\uDC7E', driverVar: 'outcome', min: 0, max: 20, label: 'Outcome' },
        '524f81d8': { emoji: '\uD83D\uDC8E', driverVar: 'crystal', min: 1, max: 125, label: 'Crystal' },
        '2da82cd3': { emoji: '\u26A1', driverVar: 'power', min: 1, max: 32, label: 'Power' },
        'f0ff2c24': { emoji: '\uD83D\uDCB0', driverVar: 'profit', min: 0, max: 26, label: 'Profit' },
        'a0fb2f8c': { emoji: '\u2B50', driverVar: 'rating', min: 0, max: 15, label: 'Rating' },
        '80ca2bb5': { emoji: '\u26A1', driverVar: 'action', min: 0, max: 80, label: 'Action' },
        '1ea186e9': { emoji: '\uD83D\uDC8E', driverVar: 'result', min: 0, max: 45, label: 'Result' },
        '4f71b53b': { emoji: '\uD83D\uDC8A', driverVar: 'health', min: 0, max: 12, label: 'Health' },
        '0031181f': { emoji: '\uD83C\uDFCE\uFE0F', driverVar: 'distance', min: 0, max: 30, label: 'Distance' },
        '95a73772': { emoji: '\uD83E\uDE99', driverVar: 'coins', min: 0, max: 36, label: 'Coins' },
        'ddd5d912': { emoji: '\uD83E\uDE84', driverVar: 'cast', min: 0, max: 20, label: 'Cast' },
        'cdff7daa': { emoji: '\uD83C\uDFCB\uFE0F', driverVar: 'reps', min: 0, max: 21, label: 'Reps' },
        '8dbf5060': { emoji: '\uD83D\uDC8E', driverVar: 'crystal', min: 1, max: 125, label: 'Crystal' },
        'a0768501': { emoji: '\u26A1', driverVar: 'charge', min: 0, max: 21, label: 'Charge' },
        '1b7e7435': { emoji: '\uD83D\uDE24', driverVar: 'days', min: 0, max: 5, label: 'Days' },
        'a65cf989': { emoji: '\uD83D\uDC89', driverVar: 'absorbed', min: 0, max: 38, label: 'Absorbed' },
        '14bebae8': { emoji: '\uD83C\uDFAE', driverVar: 'saves', min: 0, max: 9, label: 'Saves' },
        'cc6b605a': { emoji: '\u2694\uFE0F', driverVar: 'blade', min: 0, max: 40, label: 'Blade' },
        '8f15a794': { emoji: '\uD83C\uDFB9', driverVar: 'sessions', min: 0, max: 5, label: 'Sessions' },
        '4d042728': { emoji: '\uD83D\uDC1D', driverVar: 'swarm', min: 1, max: 64, label: 'Swarm' },
        '7720e676': { emoji: '\uD83C\uDF93', driverVar: 'gpa', min: 0, max: 25, label: 'Gpa' },
        '50d73e80': { emoji: '\uD83C\uDFF0', driverVar: 'castles', min: 0, max: 5, label: 'Castles' },
        'dfd17582': { emoji: '\u2694\uFE0F', driverVar: 'damage', min: 0, max: 36, label: 'Damage' },
        '0076eb1b': { emoji: '\uD83C\uDFA8', driverVar: 'paint', min: 32, max: 32, label: 'Paint' },
        'fb0e4f10': { emoji: '\uD83E\uDDDF', driverVar: 'zombies', min: 2, max: 64, label: 'Zombies' },
        'a1587032': { emoji: '\uD83D\uDCDD', driverVar: 'pages', min: 0, max: 48, label: 'Pages' },
        '6d8f63bd': { emoji: '\uD83C\uDFAC', driverVar: 'frames', min: 0, max: 30, label: 'Frames' },
        '56d77e74': { emoji: '\uD83C\uDF6A', driverVar: 'treats', min: 0, max: 21, label: 'Treats' },
        '04c2720f': { emoji: '\u2694\uFE0F', driverVar: 'hit', min: 7, max: 7, label: 'Hit' },
        '1426d175': { emoji: '\u26A1', driverVar: 'hits', min: 0, max: 5, label: 'Hits' },
        'f9c7f6d3': { emoji: '\uD83C\uDFD7\uFE0F', driverVar: 'towers', min: 0, max: 24, label: 'Towers' },
        '82d8bdbf': { emoji: '\uD83D\uDDE3\uFE0F', driverVar: 'rumor', min: 1, max: 27, label: 'Rumor' },
        '4cf74352': { emoji: '\uD83C\uDF3E', driverVar: 'harvest', min: 0, max: 45, label: 'Harvest' },
        '37f3137c': { emoji: '\uD83C\uDFE6', driverVar: 'months', min: 0, max: 5, label: 'Months' },
        'd7ee1255': { emoji: '\uD83E\uDD5E', driverVar: 'batter', min: 30, max: 30, label: 'Batter' },
        '24a096e1': { emoji: '\u26CF\uFE0F', driverVar: 'depth', min: 0, max: 45, label: 'Depth' },
        '8859fa0d': { emoji: '\uD83D\uDDB1\uFE0F', driverVar: 'clicks', min: 0, max: 28, label: 'Clicks' },
        '257c2016': { emoji: '\uD83D\uDCB5', driverVar: 'tips', min: 0, max: 18, label: 'Tips' },
        'a214f984': { emoji: '\uD83C\uDF93', driverVar: 'passed', min: 0, max: 20, label: 'Passed' },
        '70e68134': { emoji: '\u2B50', driverVar: 'stars', min: 0, max: 48, label: 'Stars' },
        '7c2d170c': { emoji: '\uD83E\uDDE0', driverVar: 'output', min: 0, max: 55, label: 'Output' },
        '68146a8e': { emoji: '\uD83C\uDF3F', driverVar: 'remedy', min: 0, max: 16, label: 'Remedy' },
        '528b4f72': { emoji: '\uD83D\uDCB5', driverVar: 'balance', min: 100, max: 145, label: 'Balance' },
        '7dcab49b': { emoji: '\uD83E\uDE62', driverVar: 'climbs', min: 0, max: 4, label: 'Climbs' },
        'b5b04614': { emoji: '\uD83D\uDC1F', driverVar: 'seasons', min: 0, max: 6, label: 'Seasons' },
        '12f4ca20': { emoji: '\u2B50', driverVar: 'status', min: 0, max: 50, label: 'Status' },
        '10363378': { emoji: '\u26A1', driverVar: 'circuit', min: 0, max: 40, label: 'Circuit' },
        '7f2ac7c3': { emoji: '\uD83E\uDDD7', driverVar: 'climbed', min: 0, max: 26, label: 'Climbed' },
        'a14d112a': { emoji: '\uD83D\uDD8C\uFE0F', driverVar: 'paint', min: 0, max: 34, label: 'Paint' },
        '86a42cd1': { emoji: '\uD83D\uDC4F', driverVar: 'claps', min: 0, max: 10, label: 'Claps' },
        '98d4ad93': { emoji: '\uD83D\uDCA5', driverVar: 'pressure', min: 0, max: 63, label: 'Pressure' },
        'f50820dc': { emoji: '\uD83D\uDCF1', driverVar: 'followers', min: 4, max: 108, label: 'Followers' },
        'cc7c13d2': { emoji: '\uD83E\uDD67', driverVar: 'pies', min: 0, max: 7, label: 'Pies' },
        '1b00d6d6': { emoji: '\uD83C\uDFCB\uFE0F', driverVar: 'weeks', min: 0, max: 5, label: 'Weeks' },
        '538856da': { emoji: '\u2744\uFE0F', driverVar: 'frost', min: 16, max: 40, label: 'Frost' },
        'd0a16cfc': { emoji: '\uD83C\uDF93', driverVar: 'grade', min: 0, max: 21, label: 'Grade' },
        '8673635b': { emoji: '\uD83C\uDFB5', driverVar: 'mix', min: 0, max: 28, label: 'Mix' },
        '52b63357': { emoji: '\uD83C\uDF0A', driverVar: 'erosion', min: 0, max: 34, label: 'Erosion' },
        'c54cee80': { emoji: '\uD83D\uDE80', driverVar: 'burns', min: 0, max: 6, label: 'Burns' },
        '8ff3e8cf': { emoji: '\uD83E\uDDEA', driverVar: 'potions', min: 0, max: 15, label: 'Potions' },
        '4c88d4df': { emoji: '\uD83E\uDDEA', driverVar: 'potency', min: 1, max: 47, label: 'Potency' },
        'c1ae95a3': { emoji: '\uD83E\uDDF1', driverVar: 'bricks', min: 0, max: 24, label: 'Bricks' },
        '6b3427ac': { emoji: '\uD83D\uDCAA', driverVar: 'power', min: 0, max: 36, label: 'Power' },
        '555e0f7a': { emoji: '\uD83C\uDF3B', driverVar: 'flowers', min: 0, max: 24, label: 'Flowers' },
        '7b8066ce': { emoji: '\uD83D\uDC8E', driverVar: 'gems', min: 0, max: 14, label: 'Gems' },
        '3d08285b': { emoji: '\uD83D\uDCB5', driverVar: 'savings', min: 0, max: 150, label: 'Savings' },
        '29885829': { emoji: '\uD83C\uDFDB\uFE0F', driverVar: 'statues', min: 0, max: 4, label: 'Statues' },
        '55d9d436': { emoji: '\uD83E\uDE9A', driverVar: 'shelves', min: 9, max: 9, label: 'Shelves' },
        'e3d4e76d': { emoji: '\uD83D\uDD0A', driverVar: 'echo', min: 1, max: 81, label: 'Echo' },
        'f4b07f83': { emoji: '\uD83D\uDCB0', driverVar: 'gold', min: 0, max: 38, label: 'Gold' },
        'd41643aa': { emoji: '\uD83C\uDF27\uFE0F', driverVar: 'crop', min: 0, max: 60, label: 'Crop' },
        '075f712a': { emoji: '\uD83C\uDFED', driverVar: 'output', min: 0, max: 48, label: 'Output' },
        '6afc86bc': { emoji: '\uD83D\uDEEB', driverVar: 'flight', min: 42, max: 42, label: 'Flight' },
        '0c885e3b': { emoji: '\uD83C\uDF31', driverVar: 'plantings', min: 0, max: 5, label: 'Plantings' },
        '8e692185': { emoji: '\uD83C\uDFB5', driverVar: 'melody', min: 0, max: 40, label: 'Melody' },
        '8b487f53': { emoji: '\u26BE', driverVar: 'innings', min: 0, max: 27, label: 'Innings' },
        'f3b1d630': { emoji: '\uD83C\uDFE2', driverVar: 'steps', min: 0, max: 6, label: 'Steps' },
        '134f7f41': { emoji: '\uD83C\uDFC3', driverVar: 'distance', min: 0, max: 60, label: 'Distance' },
        '923e6bf7': { emoji: '\uD83D\uDD8C\uFE0F', driverVar: 'rooms', min: 0, max: 3, label: 'Rooms' },
        '0b9ed751': { emoji: '\uD83D\uDCF1', driverVar: 'calls', min: 0, max: 6, label: 'Calls' },
        'ada7a0fd': { emoji: '\u2B50', driverVar: 'fame', min: 10, max: 80, label: 'Fame' },
        '42e99fd9': { emoji: '\uD83C\uDFA4', driverVar: 'fans', min: 100, max: 145, label: 'Fans' },
        '5b253187': { emoji: '\uD83C\uDF54', driverVar: 'eat', min: 0, max: 20, label: 'Eat' },
        '7adc77ee': { emoji: '\uD83D\uDC09', driverVar: 'days', min: 0, max: 3, label: 'Days' },
        'f9f52f2f': { emoji: '\uD83D\uDCA7', driverVar: 'drops', min: 0, max: 55, label: 'Drops' },
        '2859e1cb': { emoji: '\uD83C\uDFB5', driverVar: 'measures', min: 0, max: 32, label: 'Measures' },
        'd22d0607': { emoji: '\uD83C\uDFC0', driverVar: 'points', min: 0, max: 20, label: 'Points' },
        'd2a66ac0': { emoji: '\uD83D\uDE97', driverVar: 'distance', min: 0, max: 55, label: 'Distance' },
        '8c23b137': { emoji: '\uD83C\uDFB5', driverVar: 'notes', min: 0, max: 21, label: 'Notes' },
        '17706480': { emoji: '\uD83D\uDEE1\uFE0F', driverVar: 'charge', min: 2, max: 12, label: 'Charge' },
        'b32fe104': { emoji: '\uD83C\uDFB5', driverVar: 'notes', min: 0, max: 30, label: 'Notes' },
        'ab27b3c3': { emoji: '\uD83C\uDFF0', driverVar: 'fort', min: 0, max: 40, label: 'Fort' },
        'f16547fc': { emoji: '\uD83C\uDFE2', driverVar: 'steps', min: 0, max: 21, label: 'Steps' },
        '8be8d3f3': { emoji: '\uD83C\uDFAE', driverVar: 'sprites', min: 0, max: 5, label: 'Sprites' },
        '0d7f3559': { emoji: '\uD83C\uDFA3', driverVar: 'catch', min: 0, max: 8, label: 'Catch' },
        '3b846e3f': { emoji: '\uD83E\uDE99', driverVar: 'loot', min: 0, max: 26, label: 'Loot' },
        '2f64d9bc': { emoji: '\u2694\uFE0F', driverVar: 'damage', min: 0, max: 20, label: 'Damage' },
        '8b92fc4f': { emoji: '\uD83D\uDED2', driverVar: 'sales', min: 0, max: 5, label: 'Sales' },
        '2de6ff34': { emoji: '\uD83D\uDCB5', driverVar: 'pay', min: 12, max: 12, label: 'Pay' },
        '9b1b2f40': { emoji: '\uD83C\uDFA8', driverVar: 'colored', min: 10, max: 10, label: 'Colored' },
        '0297b7b2': { emoji: '\uD83D\uDCAA', driverVar: 'pushups', min: 0, max: 15, label: 'Pushups' },
        '59ca64dd': { emoji: '\uD83C\uDFF9', driverVar: 'arrows', min: 0, max: 18, label: 'Arrows' },
        '582d2099': { emoji: '\u2B50', driverVar: 'stars', min: 0, max: 15, label: 'Stars' },
        'ee7a8a9e': { emoji: '\uD83C\uDFE6', driverVar: 'payments', min: 0, max: 5, label: 'Payments' },
        '821b3d89': { emoji: '\uD83E\uDEA8', driverVar: 'blocks', min: 0, max: 4, label: 'Blocks' },
        'f3bbd9bc': { emoji: '\uD83C\uDF54', driverVar: 'eaten', min: 0, max: 27, label: 'Eaten' },
        '96545a4f': { emoji: '\uD83C\uDFAC', driverVar: 'scenes', min: 0, max: 6, label: 'Scenes' },
        '50279331': { emoji: '\uD83C\uDFAF', driverVar: 'score', min: 0, max: 34, label: 'Score' },
        'b1cdcad9': { emoji: '\uD83E\uDED9', driverVar: 'pots', min: 0, max: 5, label: 'Pots' },
        '9eb4a080': { emoji: '\uD83D\uDCA7', driverVar: 'harvests', min: 0, max: 5, label: 'Harvests' },
        'e1069273': { emoji: '\uD83D\uDCC8', driverVar: 'days', min: 0, max: 6, label: 'Days' },
        '4d159063': { emoji: '\uD83D\uDCA8', driverVar: 'total', min: 0, max: 30, label: 'Total' },
        '6eab5fdd': { emoji: '\uD83C\uDFCA', driverVar: 'laps', min: 0, max: 20, label: 'Laps' },
        'bc4c7da5': { emoji: '\uD83E\uDDCA', driverVar: 'minutes', min: 0, max: 5, label: 'Minutes' },
        '813e6f63': { emoji: '\uD83D\uDCE3', driverVar: 'morale', min: 0, max: 21, label: 'Morale' },
        '538ef028': { emoji: '\uD83C\uDF70', driverVar: 'batter', min: 10, max: 10, label: 'Batter' },
        'cfe40fa7': { emoji: '\uD83C\uDF21\uFE0F', driverVar: 'hours', min: 0, max: 5, label: 'Hours' },
        '01e8be0b': { emoji: '\uD83E\uDDF1', driverVar: 'wall', min: 0, max: 48, label: 'Wall' },
        'ebb46176': { emoji: '\uD83D\uDD17', driverVar: 'chain', min: 1, max: 16, label: 'Chain' },
        '4be488f4': { emoji: '\uD83C\uDFD8\uFE0F', driverVar: 'population', min: 10, max: 28, label: 'Population' },
        '50e43aac': { emoji: '\uD83C\uDFAB', driverVar: 'tickets', min: 0, max: 30, label: 'Tickets' },
        'e1a39142': { emoji: '\uD83E\uDDD9', driverVar: 'wisdom', min: 0, max: 42, label: 'Wisdom' },
        '770a5adf': { emoji: '\u26F5', driverVar: 'sail', min: 0, max: 50, label: 'Sail' },
        '98466e44': { emoji: '\uD83C\uDF3E', driverVar: 'harvest', min: 0, max: 38, label: 'Harvest' },
        '97da0969': { emoji: '\uD83C\uDFB2', driverVar: 'score', min: 0, max: 20, label: 'Score' },
        'f88a16a6': { emoji: '\uD83C\uDFCA', driverVar: 'miles', min: 0, max: 20, label: 'Miles' },
        'b450f4fa': { emoji: '\uD83D\uDD2B', driverVar: 'kills', min: 0, max: 6, label: 'Kills' },
        '2f8e8374': { emoji: '\uD83D\uDD6F\uFE0F', driverVar: 'candles', min: 0, max: 3, label: 'Candles' },
        '0f9d6cd3': { emoji: '\u2764\uFE0F', driverVar: 'turns', min: 0, max: 4, label: 'Turns' },
        '63d91af2': { emoji: '\uD83C\uDF92', driverVar: 'total', min: 16, max: 16, label: 'Total' },
        '121ef918': { emoji: '\uD83E\uDDEA', driverVar: 'vials', min: 0, max: 40, label: 'Vials' },
        'fc41aaf0': { emoji: '\uD83D\uDCE6', driverVar: 'inventory', min: 30, max: 62, label: 'Inventory' },
        '9e2f4256': { emoji: '\uD83E\uDDE9', driverVar: 'tiles', min: 0, max: 15, label: 'Tiles' },
        '2a8791f0': { emoji: '\uD83D\uDCD6', driverVar: 'pages', min: 0, max: 60, label: 'Pages' },
        '9bf0cfb4': { emoji: '\uD83C\uDF81', driverVar: 'gifts', min: 0, max: 15, label: 'Gifts' },
        '2e6ccbc7': { emoji: '\uD83D\uDE80', driverVar: 'altitude', min: 0, max: 100, label: 'Altitude' },
        '5c0f07de': { emoji: '\uD83D\uDC7E', driverVar: 'xp', min: 0, max: 18, label: 'Xp' },
        '3dfcf881': { emoji: '\uD83D\uDC7B', driverVar: 'rooms', min: 0, max: 5, label: 'Rooms' },
        'ca29d368': { emoji: '\u2622\uFE0F', driverVar: 'reactor', min: 0, max: 60, label: 'Reactor' },
        '6e9dc503': { emoji: '\uD83E\uDDA0', driverVar: 'virus', min: 1, max: 256, label: 'Virus' },
        'dba02cf3': { emoji: '\uD83D\uDCB3', driverVar: 'months', min: 0, max: 6, label: 'Months' },
        '2ac9bece': { emoji: '\uD83C\uDFF0', driverVar: 'force', min: 0, max: 32, label: 'Force' },
        'f5bfabde': { emoji: '\u2615', driverVar: 'energy', min: 0, max: 16, label: 'Energy' },
        'c27c5ed0': { emoji: '\u2764\uFE0F', driverVar: 'likes', min: 0, max: 36, label: 'Likes' },
        'a998e682': { emoji: '\uD83D\uDC7E', driverVar: 'xp', min: 0, max: 60, label: 'Xp' },
        'ab090f8a': { emoji: '\uD83D\uDC8E', driverVar: 'gems', min: 0, max: 18, label: 'Gems' },
        '4b143562': { emoji: '\uD83D\uDCE1', driverVar: 'signal', min: 0, max: 35, label: 'Signal' },
        'd58914fd': { emoji: '\uD83E\uDDA0', driverVar: 'bacteria', min: 2, max: 64, label: 'Bacteria' },
        'a9ec38af': { emoji: '\uD83D\uDEF8', driverVar: 'dist', min: 20, max: 20, label: 'Dist' },
        '41bc83bd': { emoji: '\u2600\uFE0F', driverVar: 'stored', min: 0, max: 60, label: 'Stored' },
        '4da93734': { emoji: '\u26FD', driverVar: 'trips', min: 0, max: 6, label: 'Trips' },
        '36e5597c': { emoji: '\uD83D\uDD0C', driverVar: 'output', min: 0, max: 60, label: 'Output' },
        '79c6bb5d': { emoji: '\uD83E\uDDF5', driverVar: 'stitches', min: 0, max: 48, label: 'Stitches' },
        '821c54ff': { emoji: '\u269B\uFE0F', driverVar: 'molecule', min: 0, max: 39, label: 'Molecule' },
        'dd4d7fa1': { emoji: '\uD83C\uDF5E', driverVar: 'yeast', min: 5, max: 40, label: 'Yeast' },
        'e3c716ff': { emoji: '\uD83E\uDE99', driverVar: 'chests', min: 0, max: 44, label: 'Chests' },
        '72bd702e': { emoji: '\uD83C\uDF31', driverVar: 'seeds', min: 0, max: 28, label: 'Seeds' },
        'a3bdcd04': { emoji: '\uD83C\uDF4E', driverVar: 'basket', min: 0, max: 23, label: 'Basket' },
        'd1501c80': { emoji: '\uD83D\uDD6F\uFE0F', driverVar: 'candles', min: 0, max: 21, label: 'Candles' },
        '4948791a': { emoji: '\uD83C\uDF0D', driverVar: 'fallen', min: 0, max: 24, label: 'Fallen' },
        'ae205a81': { emoji: '\u26CF\uFE0F', driverVar: 'mined', min: 0, max: 30, label: 'Mined' },
        '3eb0828a': { emoji: '\u26F5', driverVar: 'speed', min: 0, max: 22, label: 'Speed' },
        'b3a680c9': { emoji: '\uD83E\uDE82', driverVar: 'ticks', min: 0, max: 4, label: 'Ticks' },
        '88235139': { emoji: '\u2B50', driverVar: 'xp', min: 0, max: 45, label: 'Xp' },
        '37bbaefb': { emoji: '\uD83D\uDC7E', driverVar: 'turns', min: 0, max: 2, label: 'Turns' },
        'd26f72d4': { emoji: '\uD83E\uDDEC', driverVar: 'cells', min: 1, max: 25, label: 'Cells' },
        '0b8a9c52': { emoji: '\uD83E\uDE84', driverVar: 'casts', min: 0, max: 5, label: 'Casts' },
        '08941f59': { emoji: '\uD83D\uDCAA', driverVar: 'result', min: 0, max: 20, label: 'Result' },
        '9c148695': { emoji: '\uD83D\uDCB5', driverVar: 'balance', min: 50, max: 110, label: 'Balance' },
        '33f5f153': { emoji: '\uD83D\uDC1D', driverVar: 'honey', min: 0, max: 19, label: 'Honey' },
        '22e83195': { emoji: '\uD83C\uDF0A', driverVar: 'dive', min: 0, max: 40, label: 'Dive' },
        'cfc35e91': { emoji: '\uD83D\uDC4D', driverVar: 'followers', min: 0, max: 52, label: 'Followers' },
        'c97852e8': { emoji: '\uD83D\uDCDA', driverVar: 'lessons', min: 0, max: 5, label: 'Lessons' },
        '29ca09e5': { emoji: '\uD83D\uDD8C\uFE0F', driverVar: 'paint', min: 0, max: 54, label: 'Paint' },
        'b45f39ef': { emoji: '\uD83E\uDD4A', driverVar: 'rounds', min: 0, max: 4, label: 'Rounds' },
        'a697986e': { emoji: '\uD83C\uDF3D', driverVar: 'harvest', min: 0, max: 28, label: 'Harvest' },
        '8e7c84e3': { emoji: '\uD83D\uDC1D', driverVar: 'harvest', min: 0, max: 50, label: 'Harvest' },
        '0edcd127': { emoji: '\uD83E\uDDDF', driverVar: 'zombies', min: 1, max: 81, label: 'Zombies' },
        'dab9790e': { emoji: '\uD83C\uDFBB', driverVar: 'bows', min: 0, max: 15, label: 'Bows' },
        '3dd6d36b': { emoji: '\uD83D\uDC1A', driverVar: 'shells', min: 0, max: 20, label: 'Shells' },
        '4a8682cf': { emoji: '\u2694\uFE0F', driverVar: 'battles', min: 0, max: 6, label: 'Battles' },
        'c8db3bd8': { emoji: '\uD83C\uDF3A', driverVar: 'bouquets', min: 0, max: 30, label: 'Bouquets' },
        '4502e60f': { emoji: '\uD83E\uDD1D', driverVar: 'ally', min: 0, max: 30, label: 'Ally' },
        '0a55ab21': { emoji: '\uD83D\uDC1F', driverVar: 'fish', min: 0, max: 18, label: 'Fish' },
        '3d465883': { emoji: '\uD83C\uDFAE', driverVar: 'score', min: 100, max: 120, label: 'Score' },
        '41dd90ac': { emoji: '\uD83D\uDDA8\uFE0F', driverVar: 'print', min: 0, max: 36, label: 'Print' },
        '4c1b8ed0': { emoji: '\uD83D\uDD10', driverVar: 'a', min: 7, max: 11, label: 'A' },
        '731f2ee8': { emoji: '\uD83D\uDDA8\uFE0F', driverVar: 'pages', min: 0, max: 6, label: 'Pages' },
        'c16b1ad3': { emoji: '\uD83E\uDDF1', driverVar: 'rows', min: 0, max: 60, label: 'Rows' },
        '49d205e8': { emoji: '\uD83C\uDFDE\uFE0F', driverVar: 'miles', min: 0, max: 5, label: 'Miles' },
        'b435c0fd': { emoji: '\uD83D\uDD0B', driverVar: 'charge', min: 20, max: 80, label: 'Charge' },
        'e5040324': { emoji: '\uD83E\uDEA1', driverVar: 'seams', min: 0, max: 7, label: 'Seams' },
        'e8f97928': { emoji: '\uD83D\uDD25', driverVar: 'fire', min: 1, max: 64, label: 'Fire' },
        '7fb4c8ac': { emoji: '\uD83D\uDCB8', driverVar: 'months', min: 0, max: 5, label: 'Months' },
        '0708a5aa': { emoji: '\uD83C\uDF3F', driverVar: 'potion', min: 0, max: 20, label: 'Potion' },
        'b934e6e3': { emoji: '\u2728', driverVar: 'sparks', min: 0, max: 40, label: 'Sparks' },
        'd94317d9': { emoji: '\uD83C\uDFAC', driverVar: 'render', min: 0, max: 50, label: 'Render' },
        '6a3807ce': { emoji: '\uD83D\uDD25', driverVar: 'minutes', min: 0, max: 9, label: 'Minutes' },
        'd32a01ee': { emoji: '\uD83C\uDF1F', driverVar: 'fame', min: 0, max: 24, label: 'Fame' },
        'e81f8ca3': { emoji: '\uD83D\uDD6F\uFE0F', driverVar: 'hours', min: 0, max: 6, label: 'Hours' },
        '9029621b': { emoji: '\uD83C\uDF70', driverVar: 'layers', min: 0, max: 10, label: 'Layers' },
        '2cbfd572': { emoji: '\uD83C\uDF5E', driverVar: 'loaves', min: 0, max: 5, label: 'Loaves' },
        'e7c5d852': { emoji: '\uD83C\uDFB5', driverVar: 'songs', min: 0, max: 32, label: 'Songs' },
        '9996e2fb': { emoji: '\u2B50', driverVar: 'stars', min: 0, max: 21, label: 'Stars' },
        'd7d5b7f2': { emoji: '\uD83D\uDCF1', driverVar: 'views', min: 0, max: 40, label: 'Views' },
        'c5a30bc0': { emoji: '\u2696\uFE0F', driverVar: 'boost', min: 0, max: 55, label: 'Boost' },
        '66b486bd': { emoji: '\uD83C\uDF3E', driverVar: 'harvest', min: 0, max: 24, label: 'Harvest' },
        'b53719d7': { emoji: '\uD83C\uDFED', driverVar: 'total', min: 0, max: 27, label: 'Total' },
        'b202a774': { emoji: '\uD83D\uDD0B', driverVar: 'charged', min: 0, max: 36, label: 'Charged' },
        '15fd3b3c': { emoji: '\uD83C\uDFCA', driverVar: 'laps', min: 0, max: 24, label: 'Laps' },
        '22ba8601': { emoji: '\uD83D\uDE80', driverVar: 'altitude', min: 0, max: 45, label: 'Altitude' },
        '7c531481': { emoji: '\uD83D\uDDBC\uFE0F', driverVar: 'canvas', min: 32, max: 32, label: 'Canvas' },
        'b2de602e': { emoji: '\uD83D\uDEB6', driverVar: 'distance', min: 0, max: 35, label: 'Distance' },
        '32b04673': { emoji: '\uD83D\uDD0B', driverVar: 'hours', min: 0, max: 8, label: 'Hours' },
        '96cb8b64': { emoji: '\uD83D\uDCDA', driverVar: 'knowledge', min: 0, max: 25, label: 'Knowledge' },
        '8472b8ce': { emoji: '\uD83D\uDCC8', driverVar: 'trade', min: 0, max: 70, label: 'Trade' },
        '3fab8c66': { emoji: '\uD83D\uDC80', driverVar: 'plague', min: 5, max: 40, label: 'Plague' },
        'b5fbe53a': { emoji: '\uD83D\uDCD6', driverVar: 'pages', min: 0, max: 28, label: 'Pages' },
        '1039e2e6': { emoji: '\uD83C\uDF80', driverVar: 'bows', min: 0, max: 8, label: 'Bows' },
        '6be5493e': { emoji: '\u2B06\uFE0F', driverVar: 'tier', min: 0, max: 150, label: 'Tier' },
        'd8568885': { emoji: '\uD83E\uDED9', driverVar: 'firings', min: 0, max: 5, label: 'Firings' },
        'c8ec5185': { emoji: '\uD83D\uDC8A', driverVar: 'final', min: 85, max: 85, label: 'Final' },
        'd23f583b': { emoji: '\uD83C\uDFF9', driverVar: 'volleys', min: 0, max: 5, label: 'Volleys' },
        '4bff18d0': { emoji: '\uD83E\uDE84', driverVar: 'power', min: 1, max: 243, label: 'Power' },
        '87e4cf86': { emoji: '\uD83C\uDF27\uFE0F', driverVar: 'crop', min: 0, max: 20, label: 'Crop' },
        '85d0ca14': { emoji: '\uD83D\uDCE1', driverVar: 'clarity', min: 0, max: 16, label: 'Clarity' },
        'f989651c': { emoji: '\uD83D\uDCAA', driverVar: 'pushups', min: 0, max: 28, label: 'Pushups' },
        '54fa7820': { emoji: '\uD83E\uDE99', driverVar: 'coins', min: 0, max: 15, label: 'Coins' },
        '3349f0e4': { emoji: '\uD83C\uDFAF', driverVar: 'points', min: 0, max: 40, label: 'Points' },
        'fce33bc2': { emoji: '\u2622\uFE0F', driverVar: 'fission', min: 4, max: 32, label: 'Fission' },
        'fcf90756': { emoji: '\uD83C\uDF21\uFE0F', driverVar: 'fahrenheit', min: 68, max: 68, label: 'Fahrenheit' },
        '5cc2afb5': { emoji: '\uD83C\uDFD5\uFE0F', driverVar: 'supplies', min: 28, max: 100, label: 'Supplies' },
        '2ee7fea0': { emoji: '\uD83D\uDC0D', driverVar: 'bites', min: 0, max: 6, label: 'Bites' },
        '14bf64e5': { emoji: '\u2744\uFE0F', driverVar: 'days', min: 0, max: 10, label: 'Days' },
        'f84c7e51': { emoji: '\u2B50', driverVar: 'xp', min: 0, max: 45, label: 'Xp' },
        '47225682': { emoji: '\u26A1', driverVar: 'power', min: 0, max: 30, label: 'Power' },
        '184eb292': { emoji: '\uD83D\uDCA8', driverVar: 'action', min: 0, max: 55, label: 'Action' },
        'd23e7b74': { emoji: '\uD83C\uDFA8', driverVar: 'shade', min: 0, max: 10, label: 'Shade' },
        'e86a28c7': { emoji: '\uD83D\uDC8A', driverVar: 'vitamin', min: 0, max: 28, label: 'Vitamin' },
        '6fecb3b6': { emoji: '\uD83C\uDFE0', driverVar: 'cabin', min: 30, max: 30, label: 'Cabin' },
        'c9e041b1': { emoji: '\uD83E\uDDA0', driverVar: 'size', min: 1, max: 16, label: 'Size' },
        '07eb2c7f': { emoji: '\u2709\uFE0F', driverVar: 'letters', min: 0, max: 22, label: 'Letters' },
    };




    var execTimeout = null;
    var execSkipped = false;
    var execSteps = null;
    var execSceneConfig = null;
    var execCallback = null;
    var execCodeLines = null;
    var execAnimating = false;
    var execCurrentStep = -1;

    function runExecution(callback) {
        // Check reduced motion preference
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            callback();
            return;
        }

        execSkipped = false;
        execAnimating = true;
        execCallback = callback;
        execModal.hidden = false;

        // Build the code from current (solved) tokens
        var codeTokenLines = [];
        var codeDisplayLines = [];
        execCodeLines = [];
        var tokenIdx = 0;
        for (var l = 0; l < puzzle.lines.length; l++) {
            var tokens = [];
            for (var c = 0; c < puzzle.lines[l].length; c++) {
                tokens.push(currentTokens[tokenIdx].t);
                tokenIdx++;
            }
            codeTokenLines.push(tokens);
            execCodeLines.push(tokens);
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

        // Show puzzle goal for context
        var execGoal = document.getElementById('exec-goal');
        if (execGoal) execGoal.textContent = puzzle.goal;

        // Reset UI
        document.getElementById('exec-title').textContent = 'Running...';
        document.getElementById('exec-actions').hidden = true;
        document.getElementById('exec-explain').hidden = true;
        document.getElementById('exec-skip').hidden = false;

        // Initialize scene animation
        execSceneConfig = SCENE_CONFIGS[puzzle.id] || null;
        var sceneEl = document.getElementById('exec-scene');
        if (execSceneConfig) {
            sceneEl.hidden = false;
            document.getElementById('exec-scene-emoji').textContent = execSceneConfig.emoji;
            document.getElementById('exec-scene-fill').style.width = '0%';
            document.getElementById('exec-scene-emoji').style.left = '5%';
            document.getElementById('exec-scene-label').textContent = execSceneConfig.label + ': ' + execSceneConfig.min;
        } else {
            sceneEl.hidden = true;
        }

        // Interpret and animate
        var interpreter = new PseudoInterpreter(codeTokenLines);
        execSteps = interpreter.execute();

        // Build timeline
        buildTimeline(execSteps);

        animateSteps(execSteps, 0);
    }

    var MAX_DOTS = 20;

    function buildTimeline(steps) {
        var timeline = document.getElementById('exec-timeline');
        var track = document.getElementById('exec-timeline-track');
        var counter = document.getElementById('exec-step-counter');
        track.innerHTML = '';
        if (steps.length < 2) {
            timeline.hidden = true;
            return;
        }
        timeline.hidden = false;

        if (steps.length <= MAX_DOTS) {
            track.classList.remove('hidden-dots');
            for (var i = 0; i < steps.length; i++) {
                var dot = document.createElement('div');
                dot.className = 'exec-step-dot';
                dot.dataset.step = i;
                dot.addEventListener('click', function () {
                    var idx = parseInt(this.dataset.step);
                    showStepState(idx);
                });
                track.appendChild(dot);
            }
        } else {
            track.classList.add('hidden-dots');
        }

        counter.textContent = '1 / ' + steps.length;
    }

    function updateTimelineDots(currentIdx) {
        var dots = document.querySelectorAll('.exec-step-dot');
        for (var i = 0; i < dots.length; i++) {
            dots[i].classList.remove('current', 'reached');
            if (i < currentIdx) dots[i].classList.add('reached');
            if (i === currentIdx) dots[i].classList.add('current');
        }
        var counter = document.getElementById('exec-step-counter');
        if (counter && execSteps) {
            counter.textContent = (currentIdx + 1) + ' / ' + execSteps.length;
        }
    }

    function showStepState(index) {
        if (!execSteps || index < 0 || index >= execSteps.length) return;
        execCurrentStep = index;

        // If still animating, stop
        if (execAnimating) {
            execSkipped = true;
            if (execTimeout) clearTimeout(execTimeout);
            execAnimating = false;
            finishAnimation();
        }

        var step = execSteps[index];
        var prevVars = index > 0 ? execSteps[index - 1].vars : {};

        // Reset all lines to plain text and remove selection
        var allLines = execCode.querySelectorAll('.exec-line');
        for (var i = 0; i < allLines.length; i++) {
            allLines[i].classList.remove('active', 'selected');
            // Reset any annotated HTML back to plain text
            if (execCodeLines && execCodeLines[i]) {
                allLines[i].textContent = execCodeLines[i].join(' ');
            }
        }
        var activeLine = document.getElementById('exec-line-' + step.line);
        if (activeLine) activeLine.classList.add('selected');

        // Update variables to this step's state
        if (step.vars) {
            updateExecVars(step.vars, step.changedVar);
        }

        // Update scene
        updateScene(execSceneConfig, step.vars);

        // Update timeline
        updateTimelineDots(index);

        // Show output if present
        if (step.output !== undefined) {
            var label = execSceneConfig ? execSceneConfig.label : 'Answer';
            execOutput.textContent = '> ' + label + ': ' + step.output;
        }

        // Show step explanation with actual values
        var tokens = execCodeLines[step.line];
        var explain = explainStep(tokens, step, prevVars);
        var explainEl = document.getElementById('exec-explain');
        explainEl.innerHTML = explain;
        explainEl.hidden = false;

        // Render inline annotations on the selected line
        if (activeLine && tokens) {
            renderAnnotatedLine(activeLine, tokens, prevVars);
        }
    }

    function updateScene(sceneConfig, vars) {
        if (!sceneConfig || !vars || !vars.hasOwnProperty(sceneConfig.driverVar)) return;
        var val = vars[sceneConfig.driverVar];
        var range = Math.abs(sceneConfig.max - sceneConfig.min);
        var pct = range > 0 ? Math.min(Math.abs(val - sceneConfig.min) / range, 1) * 90 + 5 : 5;
        document.getElementById('exec-scene-fill').style.width = pct + '%';
        document.getElementById('exec-scene-emoji').style.left = pct + '%';
        document.getElementById('exec-scene-label').textContent = sceneConfig.label + ': ' + val;
    }

    function finishAnimation() {
        // Show final output
        if (execSteps && execSteps.length > 0) {
            var lastStep = execSteps[execSteps.length - 1];
            if (lastStep.output !== undefined) {
                var answerLabel = execSceneConfig ? execSceneConfig.label : 'Answer';
                execOutput.textContent = '> ' + answerLabel + ': ' + lastStep.output;
                updateScene(execSceneConfig, lastStep.vars);
            }
            updateTimelineDots(execSteps.length - 1);
        }

        // Switch to interactive mode
        document.getElementById('exec-title').textContent = 'Complete';
        document.getElementById('exec-skip').hidden = true;
        document.getElementById('exec-actions').hidden = false;

        // Make lines tappable for explanations
        var allLines = execCode.querySelectorAll('.exec-line');
        for (var i = 0; i < allLines.length; i++) {
            allLines[i].classList.remove('active', 'done');
            allLines[i].classList.add('tappable');
            allLines[i].dataset.lineIdx = i;
            allLines[i].addEventListener('click', handleExecLineClick);
        }
    }

    function animateSteps(steps, index) {
        if (execSkipped || index >= steps.length) {
            execAnimating = false;
            if (execSkipped) {
                // Skip pressed — jump to finished state
                finishAnimation();
            } else {
                // Natural end — pause then show controls
                execTimeout = setTimeout(function () {
                    finishAnimation();
                }, 800);
            }
            return;
        }

        var step = steps[index];
        var prevVars = index > 0 ? steps[index - 1].vars : {};

        // Highlight current line and reset annotations on other lines
        var allLines = execCode.querySelectorAll('.exec-line');
        for (var i = 0; i < allLines.length; i++) {
            allLines[i].classList.remove('active');
            if (i < step.line) allLines[i].classList.add('done');
            // Reset any annotated HTML back to plain text
            if (execCodeLines && execCodeLines[i] && i !== step.line) {
                allLines[i].textContent = execCodeLines[i].join(' ');
            }
        }
        var activeLine = document.getElementById('exec-line-' + step.line);
        if (activeLine) activeLine.classList.add('active');

        // Update variables
        if (step.vars) {
            updateExecVars(step.vars, step.changedVar);
        }

        // Update scene animation
        updateScene(execSceneConfig, step.vars);

        // Update timeline
        updateTimelineDots(index);

        // Show step explanation during animation
        var tokens = execCodeLines[step.line];
        var explainEl = document.getElementById('exec-explain');
        explainEl.innerHTML = explainStep(tokens, step, prevVars);
        explainEl.hidden = false;

        // Show inline value annotations on active line
        if (activeLine && tokens) {
            renderAnnotatedLine(activeLine, tokens, prevVars);
        }

        // Show output if present
        if (step.output !== undefined) {
            var answerLabel2 = execSceneConfig ? execSceneConfig.label : 'Answer';
            execOutput.textContent = '> ' + answerLabel2 + ': ' + step.output;
        }

        execTimeout = setTimeout(function () {
            animateSteps(steps, index + 1);
        }, 1400);
    }

    function handleExecLineClick(e) {
        var lineIdx = parseInt(e.currentTarget.dataset.lineIdx);
        if (isNaN(lineIdx) || !execCodeLines || !execCodeLines[lineIdx]) return;

        // Jump timeline to the last step that executes this line
        // (shows the final state for this line)
        if (execSteps) {
            var found = false;
            for (var s = execSteps.length - 1; s >= 0; s--) {
                if (execSteps[s].line === lineIdx) {
                    showStepState(s);
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Line has no step (e.g. lone braces) — show generic explanation
                var allLines = execCode.querySelectorAll('.exec-line');
                for (var i = 0; i < allLines.length; i++) {
                    allLines[i].classList.remove('selected');
                }
                e.currentTarget.classList.add('selected');
                var explainEl = document.getElementById('exec-explain');
                explainEl.innerHTML = explainStepGeneric(execCodeLines[lineIdx]);
                explainEl.hidden = false;
            }
        }
    }

    function resolveExpr(tokens, vars) {
        // Substitute variable names with their values for display
        var parts = [];
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            if (t === '{' || t === '}') continue;
            if (vars && vars.hasOwnProperty(t)) {
                parts.push(String(vars[t]));
            } else {
                parts.push(t);
            }
        }
        return parts.join(' ');
    }

    function explainStep(tokens, step, prevVars) {
        if (!tokens || tokens.length === 0) return '';
        var first = tokens[0];
        var vars = step.vars || {};
        // Use prevVars for the values BEFORE this step executed
        var beforeVars = prevVars || {};

        if (first === '{' || first === '}') {
            return explainStepGeneric(tokens);
        }
        if (first === '}' && tokens.length > 1 && tokens[1] === 'else') {
            return '<b>Otherwise</b> \u2014 the condition was false, so run this block instead.';
        }

        if (first === 'let') {
            var varName = tokens[1];
            var exprTokens = tokens.slice(3).filter(function (t) { return t !== '{' && t !== '}'; });
            var resolved = resolveExpr(exprTokens, beforeVars);
            var finalVal = vars[varName];
            var result = '<b>Create</b> \'' + varName + '\'';
            if (exprTokens.join(' ') !== resolved) {
                result += ' \u2014 ' + exprTokens.join(' ') + ' = ' + resolved + ' \u2192 <b>' + finalVal + '</b>';
            } else {
                result += ' = <b>' + finalVal + '</b>';
            }
            return result;
        }

        if (first === 'for') {
            var forVarName = tokens[1];
            var forStartVal = resolveExpr([tokens[3]], beforeVars);
            var forEndVal = resolveExpr([tokens[5]], beforeVars);
            var forCurVal = vars[forVarName];
            return '<b>Loop</b> \u2014 ' + forVarName + ' = <b>' + forCurVal + '</b> (counting ' + forStartVal + ' to ' + forEndVal + ')';
        }

        if (first === 'while') {
            var condTokens = tokens.slice(1, -1);
            var condResolved = resolveExpr(condTokens, beforeVars);
            var condResult = step.changedVar === null && !step.output;
            // Check if the loop body was entered (next step exists and is inside loop)
            var condText = condTokens.join(' ');
            var result = '<b>Loop check</b> \u2014 is ' + condText + '?';
            if (condText !== condResolved) {
                result += '\n' + condResolved;
            }
            return result;
        }

        if (first === 'if') {
            var ifCondTokens = tokens.slice(1, -1);
            var ifResolved = resolveExpr(ifCondTokens, beforeVars);
            var result = '<b>Check</b> \u2014 is ' + ifCondTokens.join(' ') + '?';
            if (ifCondTokens.join(' ') !== ifResolved) {
                result += '\n' + ifResolved;
            }
            return result;
        }

        if (first === 'return') {
            var retTokens = tokens.slice(1);
            var retResolved = resolveExpr(retTokens, beforeVars);
            var retVal = step.output;
            var result = '<b>Return</b> ' + retTokens.join(' ');
            if (retTokens.join(' ') !== retResolved) {
                result += ' = ' + retResolved;
            }
            result += ' \u2192 <b>' + retVal + '</b>';
            return result;
        }

        // Assignment: x = expr
        if (tokens.length >= 3 && tokens[1] === '=') {
            var assignVar = tokens[0];
            var exprTokens2 = tokens.slice(2);
            var resolved2 = resolveExpr(exprTokens2, beforeVars);
            var oldVal = beforeVars.hasOwnProperty(assignVar) ? beforeVars[assignVar] : '?';
            var newVal = vars[assignVar];
            var result = '<b>' + assignVar + '</b> = ' + exprTokens2.join(' ');
            if (exprTokens2.join(' ') !== resolved2) {
                result += ' = ' + resolved2;
            }
            result += ' \u2192 <b>' + newVal + '</b>';
            if (oldVal !== newVal) {
                result += '  <span style="opacity:0.5">(was ' + oldVal + ')</span>';
            }
            return result;
        }

        return explainStepGeneric(tokens);
    }

    function explainStepGeneric(tokens) {
        if (!tokens || tokens.length === 0) return '';
        var first = tokens[0];
        if (first === '{' || first === '}') return 'Marks the start or end of a code block.';
        if (first === '}' && tokens.length > 1 && tokens[1] === 'else') {
            return 'Otherwise \u2014 if the condition above was false, run this block instead.';
        }
        if (first === 'let') return 'Creates a new variable and sets its initial value.';
        if (first === 'for') return 'Counting loop \u2014 repeats the code below for each value in the range.';
        if (first === 'while') return 'Loop \u2014 repeats the code below while the condition is true.';
        if (first === 'if') return 'Check \u2014 only runs the code below if the condition is true.';
        if (first === 'return') return 'Outputs a value as the final answer.';
        if (tokens.length >= 3 && tokens[1] === '=') return 'Updates the variable on the left with a new value.';
        return 'Code statement.';
    }

    function renderAnnotatedLine(lineEl, tokens, vars) {
        // Build annotated HTML: show values under variable names
        if (!vars || Object.keys(vars).length === 0) {
            lineEl.innerHTML = '';
            lineEl.textContent = tokens.join(' ');
            return;
        }
        var html = '';
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            if (i > 0) html += ' ';
            if (vars.hasOwnProperty(t)) {
                html += '<span class="exec-annotated">' + escapeHtml(t) + '<span class="exec-annotation">' + vars[t] + '</span></span>';
            } else {
                html += escapeHtml(t);
            }
        }
        lineEl.innerHTML = html;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        execAnimating = false;
        finishAnimation();
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
                if (loopCount >= 50 && this.evalCondition(condTokens)) {
                    throw new Error('infinite loop detected');
                }
                this.addStep(i, null); // final condition check (false)
                i = whileEnd + 1;
            } else if (firstToken === 'for') {
                // for i = start to end {
                var forVar = line[1];
                var forStart = this.evalExpr([line[3]]);
                var forEnd = this.evalExpr([line[5]]);
                var forBlockEnd = this.findBlockEnd(i);
                this.vars[forVar] = forStart;
                for (var fi = forStart; fi <= forEnd; fi++) {
                    if (fi - forStart >= 100) {
                        throw new Error('for loop exceeded 100 iterations');
                    }
                    this.vars[forVar] = fi;
                    this.addStep(i, forVar);
                    this.executeBlock(i + 1, forBlockEnd - 1);
                }
                i = forBlockEnd + 1;
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
                    if (!this.vars.hasOwnProperty(assignVar)) {
                        throw new Error('can\'t assign to \'' + assignVar + '\' \u2014 not declared');
                    }
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
        throw new Error('\'' + token + '\' is not defined');
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
        if (debugMode) return; // Don't save debug mode progress
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
        if (debugMode) return false; // Don't restore in debug mode
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
        return generateShareText(puzzleNumber, swapCount, puzzle.par, puzzle.shareResult || '', stats.currentStreak, getUsername());
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
