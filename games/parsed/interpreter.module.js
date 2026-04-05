// ============================================
// Parsed — Testable Interpreter & Validator Logic
// Pure functions extracted from game.js for unit testing.
// Browser code (game.js) keeps its own copies inside the IIFE;
// this module is the canonical reference for tests.
// ============================================

'use strict';

// --- Token helpers ---

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

// --- Structural Validator ---

function validateExpr(tokens, lineNum, declared, assignTarget) {
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

function validateStructure(codeLines) {
    var errors = [];
    var declared = {};
    for (var i = 0; i < codeLines.length; i++) {
        var line = codeLines[i];
        var ln = i + 1;
        if (!line || line.length === 0) continue;

        var first = line[0];

        if (line.length === 1 && (first === '{' || first === '}')) continue;
        if (first === '}' && line.length >= 3 && line[1] === 'else') continue;
        if (first === '}') continue;

        if (first === 'let') {
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
            var exprErr = validateExpr(line.slice(3), ln, declared, line[1]);
            if (exprErr) errors.push(exprErr);
        } else if (first === 'while' || first === 'if') {
            var lastTok = line[line.length - 1];
            if (lastTok !== '{') {
                errors.push('line ' + ln + ': expected \'{\' at end of ' + first + ' statement');
            }
            if (line.length < 5) {
                errors.push('line ' + ln + ': incomplete ' + first + ' condition');
            } else {
                var hasComp = false;
                for (var j = 1; j < line.length - 1; j++) {
                    if (isComparison(line[j])) hasComp = true;
                }
                if (!hasComp) {
                    errors.push('line ' + ln + ': missing comparison operator in ' + first + ' condition');
                }
                for (var j2 = 1; j2 < line.length - 1; j2++) {
                    var ct = line[j2];
                    if (!isOperator(ct) && !isKeyword(ct) && ct !== '{' && ct !== '}' && isNaN(Number(ct)) && !declared[ct]) {
                        errors.push('line ' + ln + ': \'' + ct + '\' is not defined');
                        break;
                    }
                }
            }
        } else if (first === 'for') {
            var lastTokFor = line[line.length - 1];
            if (lastTokFor !== '{') {
                errors.push('line ' + ln + ': expected \'{\' at end of for statement');
            }
            if (line.length < 7) {
                errors.push('line ' + ln + ': incomplete for statement \u2014 expected: for <var> = <start> to <end> {');
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
                var forStart = line[3];
                if (isNaN(Number(forStart)) && !declared[forStart]) {
                    errors.push('line ' + ln + ': \'' + forStart + '\' is not defined');
                }
                var forEnd = line[5];
                if (isNaN(Number(forEnd)) && !declared[forEnd]) {
                    errors.push('line ' + ln + ': \'' + forEnd + '\' is not defined');
                }
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
            if (line.length < 3) {
                errors.push('line ' + ln + ': incomplete statement');
            } else if (line[1] !== '=') {
                errors.push('line ' + ln + ': expected \'=\' after \'' + first + '\', got \'' + line[1] + '\'');
            } else if (isKeyword(first)) {
                errors.push('line ' + ln + ': unexpected keyword \'' + first + '\'');
            } else if (isOperator(first)) {
                errors.push('line ' + ln + ': unexpected operator \'' + first + '\' at start of line');
            } else if (!declared[first]) {
                errors.push('line ' + ln + ': can\'t assign to \'' + first + '\' \u2014 not declared');
            } else {
                var assignErr = validateExpr(line.slice(2), ln, declared, first);
                if (assignErr) errors.push(assignErr);
            }
        }
    }
    return errors;
}

// --- Pseudo-Interpreter ---

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
    var maxSteps = 200;
    var stepCount = 0;

    while (i <= end) {
        if (stepCount >= maxSteps) {
            throw new Error('execution limit reached (too many steps)');
        }
        stepCount++;
        var line = this.codeLines[i];
        if (!line || line.length === 0) { i++; continue; }

        if (line.length === 1 && (line[0] === '{' || line[0] === '}')) {
            i++;
            continue;
        }

        if (line[0] === '}' && line.length > 1) {
            i++;
            continue;
        }

        var firstToken = line[0];

        if (firstToken === 'let') {
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
            this.addStep(i, null);
            i = whileEnd + 1;
        } else if (firstToken === 'for') {
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
                if (ifEnd + 1 <= end) {
                    var nextLine = this.codeLines[ifEnd];
                    if (nextLine && nextLine.length > 1 && nextLine[1] === 'else') {
                        var elseEnd = this.findElseEnd(ifEnd);
                        i = elseEnd + 1;
                    } else {
                        i = ifEnd + 1;
                    }
                } else {
                    i = ifEnd + 1;
                }
            } else {
                var elseBlockStart = -1;
                var closeLine = this.codeLines[ifEnd];
                if (closeLine && closeLine.length > 1 && closeLine[1] === 'else') {
                    elseBlockStart = ifEnd;
                    var elseEnd2 = this.findElseEnd(elseBlockStart);
                    this.executeBlock(elseBlockStart + 1, elseEnd2 - 1);
                    i = elseEnd2 + 1;
                } else {
                    i = ifEnd + 1;
                }
            }
        } else {
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
    var result = resolved[0];
    for (var j = 1; j < resolved.length - 1; j += 2) {
        if (resolved[j] === '+') result = result + resolved[j + 1];
        else if (resolved[j] === '-') result = result - resolved[j + 1];
    }
    return result;
};

PseudoInterpreter.prototype.resolveValue = function (token) {
    var num = Number(token);
    if (!isNaN(num) && token !== '') return num;
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

// findElseEnd: find the closing } of an else block starting from a "} else {"
// line. Unlike findBlockEnd, this starts at depth 1 and scans from the NEXT
// line, matching the Python verifier's _find_else_end.
PseudoInterpreter.prototype.findElseEnd = function (elseLine) {
    var depth = 1;
    for (var i = elseLine + 1; i < this.codeLines.length; i++) {
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

// --- Score labels ---

function getScoreLabel(swaps, par) {
    var diff = swaps - par;
    if (diff <= -3) return 'Genius!';
    if (diff === -2) return 'Hacker!';
    if (diff === -1) return 'Optimized!';
    if (diff === 0) return 'Compiled';
    if (diff === 1) return 'Verbose';
    return 'Spaghetti (+' + diff + ')';
}

module.exports = {
    isKeyword,
    isOperator,
    isArithOp,
    isComparison,
    validateExpr,
    validateStructure,
    PseudoInterpreter,
    getScoreLabel,
};
