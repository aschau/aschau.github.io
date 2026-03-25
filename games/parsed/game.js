// ============================================
// Parsed — Core Game Engine
// Tap-to-swap code tokens to fix buggy programs
// ============================================

(function () {
    'use strict';

    var SAVE_VERSION = 4;
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

    // Archive mode: ?day=N loads past puzzle N (1-based puzzle number)
    var archiveMode = false;
    var archivePuzzleNumber = null;
    (function () {
        var params = new URLSearchParams(window.location.search);
        if (params.has('day')) {
            var dayNum = parseInt(params.get('day'), 10);
            var todayNum = getDailyPuzzleNumber();
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum < todayNum) {
                archiveMode = true;
                archivePuzzleNumber = dayNum;
            }
        }
    })();

    // --- Game State ---
    var puzzle = null;
    var puzzleNumber = 0;
    var currentTokens = [];   // flat array: [{t, y, f, line, col, solutionIndex}]
    var movableTokens = [];   // subset of currentTokens where f===0
    var solutionOrder = [];   // the correct text values for each movable slot
    var solutionStepCount = 0; // minimum execution steps from correct solution
    var solutionChangedVars = null; // vars that change during correct solution execution
    var solutionReturn = null; // expected return line tokens from correct arrangement
    var selectedIndex = null; // index into movableTokens of currently selected token
    var swapCount = 0;
    var moveHistory = [];     // [{a, b}] indices into movableTokens
    var solved = false;
    var everSolved = false;
    var bestScore = null;
    var winningSolution = null;  // saved token arrangement from first solve
    var firstSolveSwaps = null;  // swap count from first solve (for sharing)

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
    var restoreBtn = document.getElementById('restore-btn');
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
        } else if (archiveMode) {
            var archiveIndex = (archivePuzzleNumber - 1) % PUZZLES.length;
            puzzle = JSON.parse(JSON.stringify(PUZZLES[archiveIndex]));
            puzzleNumber = archivePuzzleNumber;
        } else {
            puzzle = getDailyPuzzle();
            puzzleNumber = getDailyPuzzleNumber();
        }

        if (debugMode) {
            puzzleNumberEl.textContent = 'Debug Puzzle #' + puzzleNumber;
            puzzleDateEl.textContent = 'Debug Mode';
        } else if (archiveMode) {
            puzzleNumberEl.textContent = 'Puzzle #' + puzzleNumber;
            puzzleDateEl.textContent = getPuzzleDateString(puzzleNumber);
            document.getElementById('archive-banner').hidden = false;
            document.querySelector('.game-container').classList.add('has-archive-banner');
        } else {
            puzzleNumberEl.textContent = 'Puzzle #' + puzzleNumber;
            puzzleDateEl.textContent = getTodayDateString();
        }
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
            solutionStepCount = solInterp.steps.length;
            // Track how many distinct values each variable takes in the solution
            if (solInterp.steps.length > 0) {
                solutionChangedVars = {};
                for (var si = 0; si < solInterp.steps.length; si++) {
                    var sv = solInterp.steps[si].vars;
                    var svKeys = Object.keys(sv);
                    for (var svi = 0; svi < svKeys.length; svi++) {
                        var svk = svKeys[svi];
                        if (!solutionChangedVars[svk]) solutionChangedVars[svk] = {};
                        solutionChangedVars[svk][sv[svk]] = true;
                    }
                }
                // Convert to counts of distinct values
                var scvKeys = Object.keys(solutionChangedVars);
                for (var sci = 0; sci < scvKeys.length; sci++) {
                    solutionChangedVars[scvKeys[sci]] = Object.keys(solutionChangedVars[scvKeys[sci]]).length;
                }
            }
        } catch (e) {
            solutionStepCount = 0;
            solutionChangedVars = null;
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

            // Check output against all valid outputs (alternative
            // literal arrangements that produce different but valid answers)
            var validOutputs = puzzle.validOutputs || [puzzle.output];
            var outputValid = false;
            for (var oi = 0; oi < validOutputs.length; oi++) {
                if (outputStr === validOutputs[oi]) {
                    outputValid = true;
                    break;
                }
            }

            if (outputValid) {
                // Guard against loop-bypass cheats: if the solution requires
                // loops (many steps), but the player's code barely executed,
                // they likely set the answer as an initial value and skipped
                // the loop entirely.
                if (solutionStepCount > 0 && interp.steps.length < solutionStepCount / 2) {
                    return { success: false, type: 'logic', output: outputStr, errors: ['> output is correct, but the logic doesn\'t match the prompt'] };
                }
                // Reject if any variable went negative during execution —
                // narratively nonsensical (can't have negative air, depth, etc.)
                var steps = interp.steps;
                for (var si = 0; si < steps.length; si++) {
                    var stepVars = steps[si].vars;
                    var vkeys = Object.keys(stepVars);
                    for (var vi = 0; vi < vkeys.length; vi++) {
                        if (typeof stepVars[vkeys[vi]] === 'number' && stepVars[vkeys[vi]] < 0) {
                            return { success: false, type: 'logic', output: outputStr, errors: ['> ' + vkeys[vi] + ' went negative \u2014 that doesn\'t make sense here'] };
                        }
                    }
                }
                // Reject if a variable that should actively change is stuck.
                // Solution vars with 3+ distinct values must also take 3+ in
                // the player's execution.  This catches bypassed logic (depth
                // stuck at one value) while allowing valid alternatives with
                // different step sizes or loop counts.
                if (solutionChangedVars && interp.steps.length > 0) {
                    var MIN_DISTINCT = 3;
                    var scKeys = Object.keys(solutionChangedVars);
                    for (var ci = 0; ci < scKeys.length; ci++) {
                        var cv = scKeys[ci];
                        var solDistinct = solutionChangedVars[cv];
                        if (solDistinct < MIN_DISTINCT) continue;
                        var playerVals = {};
                        for (var si = 0; si < interp.steps.length; si++) {
                            var pv = interp.steps[si].vars;
                            if (pv.hasOwnProperty(cv)) {
                                playerVals[pv[cv]] = true;
                            }
                        }
                        var playerDistinct = Object.keys(playerVals).length;
                        if (playerDistinct < MIN_DISTINCT) {
                            var msg = playerDistinct <= 1
                                ? '> ' + cv + ' never changed \u2014 re-read the prompt'
                                : '> ' + cv + ' barely changed \u2014 re-read the prompt';
                            return { success: false, type: 'logic', output: outputStr, errors: [msg] };
                        }
                    }
                }
                // Different arrangements that produce valid answers are
                // accepted — allows multiple narrative interpretations.
                return { success: true, output: outputStr };
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
        if (restoreBtn) restoreBtn.addEventListener('click', restoreSolution);
        shareBtn.addEventListener('click', function () { if (everSolved) showWinModal(); });

        helpBtn.addEventListener('click', function () { helpModal.hidden = false; });
        helpClose.addEventListener('click', function () { helpModal.hidden = true; });
        helpModal.addEventListener('click', function (e) { if (e.target === helpModal) helpModal.hidden = true; });

        // Archive modal
        var archiveBtn = document.getElementById('archive-btn');
        var archiveModal = document.getElementById('archive-modal');
        var archiveClose = document.getElementById('archive-close');
        if (archiveBtn && archiveModal) {
            archiveBtn.addEventListener('click', function () {
                renderArchiveGrid();
                archiveModal.hidden = false;
            });
            archiveClose.addEventListener('click', function () { archiveModal.hidden = true; });
            archiveModal.addEventListener('click', function (e) { if (e.target === archiveModal) archiveModal.hidden = true; });
        }

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

        solved = false;
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
        if (moveHistory.length === 0) return;
        solved = false;

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
        if (solved) return;
        var result = tryRunCode();
        if (!result.success) return;

        solved = true;
        var isFirstSolve = !everSolved;
        everSolved = true;

        if (isFirstSolve) {
            // Freeze first-solve score and save winning arrangement
            bestScore = swapCount;
            firstSolveSwaps = swapCount;
            winningSolution = movableTokens.map(function (t) { return t.t; });
            if (!archiveMode) updateStats(swapCount);
        }

        saveState();
        updateStatsDisplay();
        updateUI();

        // Always show win feedback (execution animation on first solve, modal on re-solve)
        if (isFirstSolve) {
            runExecution(function () {
                showWinModal();
            });
        } else {
            showWinModal();
        }
    }

    function showWinModal() {
        var displayScore = firstSolveSwaps !== null ? firstSolveSwaps : swapCount;
        var diff = displayScore - puzzle.par;
        var scoreLabel;
        if (diff <= -3) scoreLabel = 'Genius!';
        else if (diff === -2) scoreLabel = 'Hacker!';
        else if (diff === -1) scoreLabel = 'Optimized!';
        else if (diff === 0) scoreLabel = 'Compiled';
        else if (diff === 1) scoreLabel = 'Verbose';
        else scoreLabel = 'Spaghetti (+' + diff + ')';

        winPuzzle.textContent = 'Parsed #' + puzzleNumber + (archiveMode ? ' (Archive)' : '');
        winScore.textContent = scoreLabel + ' (' + displayScore + ' swap' + (displayScore !== 1 ? 's' : '') + ')';
        winResult.textContent = puzzle.shareResult || '';

        if (archiveMode) {
            winStreak.textContent = '';
        } else {
            var stats = loadStats();
            if (stats.currentStreak > 1) {
                winStreak.textContent = '\uD83D\uDD25 ' + stats.currentStreak + ' day streak';
            } else {
                winStreak.textContent = '';
            }
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

    // Scene configs are now embedded in each puzzle object as puzzle.scene
    // (auto-generated by generate.py from execution trace)



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
        execSceneConfig = puzzle.scene || null;
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

        // Make counter clickable to type a step number
        counter.style.cursor = 'pointer';
        counter.title = 'Click to jump to step';
        counter.addEventListener('click', function () {
            if (!execSteps || execAnimating) return;
            var total = execSteps.length;
            var input = document.createElement('input');
            input.type = 'number';
            input.min = 1;
            input.max = total;
            input.value = execCurrentStep + 1;
            input.className = 'exec-step-input';
            input.style.width = '3.5em';
            input.style.textAlign = 'center';
            input.style.fontSize = 'inherit';
            input.style.background = 'rgba(255,255,255,0.1)';
            input.style.border = '1px solid rgba(255,255,255,0.3)';
            input.style.borderRadius = '4px';
            input.style.color = 'inherit';
            counter.textContent = '';
            counter.appendChild(input);
            var suffix = document.createTextNode(' / ' + total);
            counter.appendChild(suffix);
            input.focus();
            input.select();
            function commit() {
                var val = parseInt(input.value);
                if (!isNaN(val) && val >= 1 && val <= total) {
                    showStepState(val - 1);
                } else {
                    counter.textContent = (execCurrentStep + 1) + ' / ' + total;
                }
            }
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { counter.textContent = (execCurrentStep + 1) + ' / ' + total; }
            });
        });
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
        // Show final output and variable state
        if (execSteps && execSteps.length > 0) {
            execCurrentStep = execSteps.length - 1;
            var lastStep = execSteps[execSteps.length - 1];
            if (lastStep.vars) {
                updateExecVars(lastStep.vars, null);
            }
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

        // Standard operator precedence: * / first, then + -
        // Pass 1: resolve * and / into values
        var resolved = [this.resolveValue(tokens[0])];
        for (var i = 1; i < tokens.length - 1; i += 2) {
            var op = tokens[i];
            var right = this.resolveValue(tokens[i + 1]);
            if (op === '*' || op === '/') {
                var left = resolved[resolved.length - 1];
                if (op === '*') {
                    resolved[resolved.length - 1] = left * right;
                } else {
                    resolved[resolved.length - 1] = right !== 0 ? Math.floor(left / right) : 0;
                }
            } else {
                resolved.push(op);
                resolved.push(right);
            }
        }
        // Pass 2: resolve + and -
        var result = resolved[0];
        for (var j = 1; j < resolved.length - 1; j += 2) {
            if (resolved[j] === '+') result = result + resolved[j + 1];
            else if (resolved[j] === '-') result = result - resolved[j + 1];
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
        undoBtn.disabled = moveHistory.length === 0;
        resetBtn.disabled = false;
        shareBtn.disabled = !solved;
        if (restoreBtn) {
            restoreBtn.disabled = !everSolved || solved;
            restoreBtn.hidden = !everSolved;
        }
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
        if (archiveMode) return 'parsed_archive_' + archivePuzzleNumber;
        return STORAGE_KEY;
    }

    function restoreSolution() {
        if (!winningSolution || winningSolution.length !== movableTokens.length) return;

        for (var i = 0; i < movableTokens.length; i++) {
            movableTokens[i].t = winningSolution[i];
        }

        swapCount = firstSolveSwaps || 0;
        moveHistory = [];
        solved = true;
        selectedIndex = null;

        renderCode();
        updateConsole();
        updateUI();
        saveState();
    }

    function saveState() {
        if (debugMode) return; // Don't save debug mode progress
        if (archiveMode) { saveArchiveState(); return; }
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
            firstSolveSwaps: prevToday.firstSolveSwaps || null,
            winningSolution: prevToday.winningSolution || null,
            par: puzzle.par,
            moveHistory: moveHistory
        };

        // Only freeze score on first solve
        if (solved && !prevToday.everSolved) {
            data.today.bestScore = swapCount;
            data.today.firstSolveSwaps = swapCount;
            data.today.winningSolution = movableTokens.map(function (t) { return t.t; });
        }

        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(data));
        } catch (e) { }
    }

    function saveArchiveState() {
        var prev = loadArchiveState();
        var arrangement = movableTokens.map(function (t) { return t.t; });

        var state = {
            version: SAVE_VERSION,
            puzzleNumber: archivePuzzleNumber,
            solved: solved,
            everSolved: prev.everSolved || solved,
            arrangement: arrangement,
            initialScramble: initialScramble,
            swapCount: swapCount,
            firstSolveSwaps: prev.firstSolveSwaps || null,
            winningSolution: prev.winningSolution || null,
            par: puzzle.par,
            moveHistory: moveHistory
        };

        if (solved && !prev.everSolved) {
            state.firstSolveSwaps = swapCount;
            state.winningSolution = movableTokens.map(function (t) { return t.t; });
        }

        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(state));
            // Update solved index for archive grid
            var solvedKey = 'parsed_archive_solved';
            var solvedSet = {};
            try { solvedSet = JSON.parse(localStorage.getItem(solvedKey)) || {}; } catch (e) { }
            if (state.everSolved) solvedSet[archivePuzzleNumber] = true;
            localStorage.setItem(solvedKey, JSON.stringify(solvedSet));
        } catch (e) { }
    }

    function loadArchiveState() {
        try {
            var raw = localStorage.getItem(getStorageKey());
            if (raw) {
                var state = JSON.parse(raw);
                if (state.version === SAVE_VERSION) return state;
            }
        } catch (e) { }
        return {};
    }

    function restoreState() {
        if (debugMode) return false; // Don't restore in debug mode
        if (archiveMode) return restoreArchiveState();

        var data = loadData();
        if (!data.today || data.today.date !== getTodayKey()) return false;

        // If already solved today, restore the winning solution so state can't be reset by revisiting
        var arrangementToRestore = data.today.everSolved && data.today.winningSolution
            ? data.today.winningSolution
            : data.today.arrangement;

        if (arrangementToRestore && arrangementToRestore.length === movableTokens.length) {
            for (var i = 0; i < movableTokens.length; i++) {
                movableTokens[i].t = arrangementToRestore[i];
            }
        }

        if (data.today.initialScramble) {
            initialScramble = data.today.initialScramble;
        }

        swapCount = data.today.everSolved ? (data.today.firstSolveSwaps || data.today.swapCount || 0) : (data.today.swapCount || 0);
        moveHistory = data.today.everSolved ? [] : (data.today.moveHistory || []);
        everSolved = !!data.today.everSolved;
        solved = data.today.everSolved ? true : !!data.today.solved;
        bestScore = data.today.bestScore || null;
        firstSolveSwaps = data.today.firstSolveSwaps || null;
        winningSolution = data.today.winningSolution || null;

        return true;
    }

    function restoreArchiveState() {
        var state = loadArchiveState();
        if (!state.puzzleNumber) return false;

        var arrangementToRestore = state.everSolved && state.winningSolution
            ? state.winningSolution
            : state.arrangement;

        if (arrangementToRestore && arrangementToRestore.length === movableTokens.length) {
            for (var i = 0; i < movableTokens.length; i++) {
                movableTokens[i].t = arrangementToRestore[i];
            }
        }

        if (state.initialScramble) {
            initialScramble = state.initialScramble;
        }

        swapCount = state.everSolved ? (state.firstSolveSwaps || state.swapCount || 0) : (state.swapCount || 0);
        moveHistory = state.everSolved ? [] : (state.moveHistory || []);
        everSolved = !!state.everSolved;
        solved = state.everSolved ? true : !!state.solved;
        firstSolveSwaps = state.firstSolveSwaps || null;
        winningSolution = state.winningSolution || null;

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
        // Always read stats from daily storage, not archive
        var raw;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { }
        var data = raw ? JSON.parse(raw) : {};
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
        var shareSwaps = firstSolveSwaps !== null ? firstSolveSwaps : swapCount;
        var streakVal = archiveMode ? 0 : loadStats().currentStreak;
        return generateShareText(puzzleNumber, shareSwaps, puzzle.par, puzzle.shareResult || '', streakVal, getUsername(), archiveMode);
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
    // Archive Grid
    // =============================================

    function getPuzzleDateString(num) {
        var epoch = new Date(LAUNCH_EPOCH);
        epoch.setHours(0, 0, 0, 0);
        var d = new Date(epoch.getTime() + (num - 1) * 86400000);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function getPuzzleEmoji(puzzleIndex) {
        var p = PUZZLES[puzzleIndex];
        if (!p || !p.shareResult) return '';
        var m = p.shareResult.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        return m ? m[0] : '';
    }

    function renderArchiveGrid() {
        var grid = document.getElementById('archive-grid');
        if (!grid) return;
        grid.innerHTML = '';

        var todayNum = getDailyPuzzleNumber();
        var solvedSet = {};
        try { solvedSet = JSON.parse(localStorage.getItem('parsed_archive_solved')) || {}; } catch (e) { }

        // Also check if today's daily puzzle is solved
        var dailyData = {};
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) dailyData = JSON.parse(raw);
        } catch (e) { }
        var dailySolved = dailyData.today && dailyData.today.date === getTodayKey() && dailyData.today.everSolved;

        for (var n = 1; n <= todayNum; n++) {
            var cell = document.createElement('a');
            cell.className = 'archive-cell';

            var idx = (n - 1) % PUZZLES.length;
            var emoji = getPuzzleEmoji(idx);

            var numSpan = document.createElement('span');
            numSpan.className = 'archive-cell-num';
            numSpan.textContent = n;

            if (emoji) {
                var emojiSpan = document.createElement('span');
                emojiSpan.className = 'archive-cell-emoji';
                emojiSpan.textContent = emoji;
                cell.appendChild(emojiSpan);
            }
            cell.appendChild(numSpan);

            if (n === todayNum) {
                cell.classList.add('today');
                cell.href = './';
                cell.title = 'Today — ' + getTodayDateString();
                if (dailySolved) cell.classList.add('solved');
            } else {
                cell.href = '?day=' + n;
                cell.title = '#' + n + ' — ' + getPuzzleDateString(n);
                if (solvedSet[n]) cell.classList.add('solved');
            }

            grid.appendChild(cell);
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
