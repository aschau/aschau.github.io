const {
    isKeyword,
    isOperator,
    isArithOp,
    isComparison,
    validateStructure,
    PseudoInterpreter,
    getScoreLabel,
} = require('../games/parsed/interpreter.module');

// =============================================
// Token Classification Helpers
// =============================================

describe('Token classification', () => {
    test('isKeyword identifies all keywords', () => {
        expect(isKeyword('let')).toBe(true);
        expect(isKeyword('while')).toBe(true);
        expect(isKeyword('if')).toBe(true);
        expect(isKeyword('else')).toBe(true);
        expect(isKeyword('return')).toBe(true);
        expect(isKeyword('for')).toBe(true);
        expect(isKeyword('to')).toBe(true);
        expect(isKeyword('x')).toBe(false);
        expect(isKeyword('+')).toBe(false);
    });

    test('isOperator identifies all operators', () => {
        for (const op of ['+', '-', '*', '/', '=', '>', '<', '>=', '<=', '==', '!=']) {
            expect(isOperator(op)).toBe(true);
        }
        expect(isOperator('x')).toBe(false);
        expect(isOperator('let')).toBe(false);
    });

    test('isArithOp identifies arithmetic operators only', () => {
        expect(isArithOp('+')).toBe(true);
        expect(isArithOp('-')).toBe(true);
        expect(isArithOp('*')).toBe(true);
        expect(isArithOp('/')).toBe(true);
        expect(isArithOp('>')).toBe(false);
        expect(isArithOp('=')).toBe(false);
    });

    test('isComparison identifies comparison operators only', () => {
        for (const op of ['>', '<', '>=', '<=', '==', '!=']) {
            expect(isComparison(op)).toBe(true);
        }
        expect(isComparison('+')).toBe(false);
        expect(isComparison('=')).toBe(false);
    });
});

// =============================================
// Expression Evaluation
// =============================================

describe('PseudoInterpreter.evalExpr', () => {
    function evalExpr(tokens, vars) {
        const interp = new PseudoInterpreter([]);
        if (vars) interp.vars = { ...vars };
        return interp.evalExpr(tokens);
    }

    test('single number literal', () => {
        expect(evalExpr(['42'])).toBe(42);
    });

    test('single variable', () => {
        expect(evalExpr(['x'], { x: 10 })).toBe(10);
    });

    test('addition', () => {
        expect(evalExpr(['3', '+', '4'])).toBe(7);
    });

    test('subtraction', () => {
        expect(evalExpr(['10', '-', '3'])).toBe(7);
    });

    test('multiplication', () => {
        expect(evalExpr(['3', '*', '4'])).toBe(12);
    });

    test('integer division with floor', () => {
        expect(evalExpr(['7', '/', '2'])).toBe(3);
        expect(evalExpr(['10', '/', '3'])).toBe(3);
    });

    test('division by zero returns 0', () => {
        expect(evalExpr(['5', '/', '0'])).toBe(0);
    });

    test('operator precedence: * before +', () => {
        // 2 + 3 * 4 = 2 + 12 = 14
        expect(evalExpr(['2', '+', '3', '*', '4'])).toBe(14);
    });

    test('operator precedence: / before -', () => {
        // 10 - 6 / 2 = 10 - 3 = 7
        expect(evalExpr(['10', '-', '6', '/', '2'])).toBe(7);
    });

    test('operator precedence: * before - in complex expression', () => {
        // 1 + 2 * 3 - 4 = 1 + 6 - 4 = 3
        expect(evalExpr(['1', '+', '2', '*', '3', '-', '4'])).toBe(3);
    });

    test('multiple additions', () => {
        // 1 + 2 + 3 = 6
        expect(evalExpr(['1', '+', '2', '+', '3'])).toBe(6);
    });

    test('variable in expression', () => {
        expect(evalExpr(['x', '+', '5'], { x: 10 })).toBe(15);
    });

    test('undefined variable throws', () => {
        expect(() => evalExpr(['y'])).toThrow("'y' is not defined");
    });

    test('empty expression returns 0', () => {
        expect(evalExpr([])).toBe(0);
    });
});

// =============================================
// Condition Evaluation
// =============================================

describe('PseudoInterpreter.evalCondition', () => {
    function evalCond(tokens, vars) {
        const interp = new PseudoInterpreter([]);
        if (vars) interp.vars = { ...vars };
        return interp.evalCondition(tokens);
    }

    test('less than', () => {
        expect(evalCond(['1', '<', '2'])).toBe(true);
        expect(evalCond(['2', '<', '1'])).toBe(false);
    });

    test('greater than', () => {
        expect(evalCond(['5', '>', '3'])).toBe(true);
        expect(evalCond(['3', '>', '5'])).toBe(false);
    });

    test('less than or equal', () => {
        expect(evalCond(['3', '<=', '3'])).toBe(true);
        expect(evalCond(['4', '<=', '3'])).toBe(false);
    });

    test('greater than or equal', () => {
        expect(evalCond(['3', '>=', '3'])).toBe(true);
        expect(evalCond(['2', '>=', '3'])).toBe(false);
    });

    test('equality', () => {
        expect(evalCond(['5', '==', '5'])).toBe(true);
        expect(evalCond(['5', '==', '6'])).toBe(false);
    });

    test('inequality', () => {
        expect(evalCond(['5', '!=', '6'])).toBe(true);
        expect(evalCond(['5', '!=', '5'])).toBe(false);
    });

    test('with variables', () => {
        expect(evalCond(['x', '<', '10'], { x: 5 })).toBe(true);
        expect(evalCond(['x', '<', '10'], { x: 15 })).toBe(false);
    });

    test('wrong number of tokens returns false', () => {
        expect(evalCond(['1', '<'])).toBe(false);
        expect(evalCond([])).toBe(false);
    });
});

// =============================================
// Full Program Execution
// =============================================

describe('PseudoInterpreter full programs', () => {
    function run(codeLines) {
        const interp = new PseudoInterpreter(codeLines);
        interp.execute();
        return interp;
    }

    test('simple let + return', () => {
        // let x = 5
        // return x
        const interp = run([
            ['let', 'x', '=', '5'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(5);
        expect(interp.vars.x).toBe(5);
    });

    test('let with expression', () => {
        // let x = 3 + 4 * 2
        // return x
        const interp = run([
            ['let', 'x', '=', '3', '+', '4', '*', '2'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(11); // 3 + 8
    });

    test('assignment', () => {
        // let x = 5
        // x = x + 1
        // return x
        const interp = run([
            ['let', 'x', '=', '5'],
            ['x', '=', 'x', '+', '1'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(6);
    });

    test('for loop with inclusive range', () => {
        // let sum = 0
        // for i = 1 to 5 {
        // sum = sum + i
        // }
        // return sum
        const interp = run([
            ['let', 'sum', '=', '0'],
            ['for', 'i', '=', '1', 'to', '5', '{'],
            ['sum', '=', 'sum', '+', 'i'],
            ['}'],
            ['return', 'sum'],
        ]);
        expect(interp.output).toBe(15); // 1+2+3+4+5
    });

    test('while loop', () => {
        // let x = 10
        // while x > 0 {
        // x = x - 3
        // }
        // return x
        const interp = run([
            ['let', 'x', '=', '10'],
            ['while', 'x', '>', '0', '{'],
            ['x', '=', 'x', '-', '3'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(-2); // 10, 7, 4, 1, -2
    });

    test('if/else true branch', () => {
        // let x = 5
        // if x > 3 {
        // x = x + 10
        // } else {
        // x = 0
        // }
        // return x
        const interp = run([
            ['let', 'x', '=', '5'],
            ['if', 'x', '>', '3', '{'],
            ['x', '=', 'x', '+', '10'],
            ['}', 'else', '{'],
            ['x', '=', '0'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(15);
    });

    test('if/else false branch', () => {
        const interp = run([
            ['let', 'x', '=', '1'],
            ['if', 'x', '>', '3', '{'],
            ['x', '=', 'x', '+', '10'],
            ['}', 'else', '{'],
            ['x', '=', '0'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(0);
    });

    test('if without else', () => {
        const interp = run([
            ['let', 'x', '=', '5'],
            ['if', 'x', '>', '3', '{'],
            ['x', '=', 'x', '*', '2'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(10);
    });

    test('for loop with if inside (puzzle pattern)', () => {
        // let points = 0
        // for i = 1 to 10 {
        // if i > 5 {
        // points = points + i
        // }
        // }
        // return points
        const interp = run([
            ['let', 'points', '=', '0'],
            ['for', 'i', '=', '1', 'to', '10', '{'],
            ['if', 'i', '>', '5', '{'],
            ['points', '=', 'points', '+', 'i'],
            ['}'],
            ['}'],
            ['return', 'points'],
        ]);
        expect(interp.output).toBe(40); // 6+7+8+9+10
    });

    test('nested for loop body executes correct number of times', () => {
        // let photos = 0
        // for i = 1 to 4 {
        // photos = photos + 9
        // }
        // return photos
        const interp = run([
            ['let', 'photos', '=', '0'],
            ['for', 'i', '=', '1', 'to', '4', '{'],
            ['photos', '=', 'photos', '+', '9'],
            ['}'],
            ['return', 'photos'],
        ]);
        expect(interp.output).toBe(36);
    });

    test('while loop with if (complex puzzle pattern)', () => {
        // let depth = 0
        // let air = 100
        // while air > 20 {
        // depth = depth + 5
        // air = air - 15
        // }
        // return depth
        const interp = run([
            ['let', 'depth', '=', '0'],
            ['let', 'air', '=', '100'],
            ['while', 'air', '>', '20', '{'],
            ['depth', '=', 'depth', '+', '5'],
            ['air', '=', 'air', '-', '15'],
            ['}'],
            ['return', 'depth'],
        ]);
        // air: 100→85→70→55→40→25→10 (6 iterations, air=10 fails condition before 6th body)
        // Actually: 100>20 → depth=5,air=85 → 85>20 → depth=10,air=70 → 70>20 → depth=15,air=55
        // → 55>20 → depth=20,air=40 → 40>20 → depth=25,air=25 → 25>20 → depth=30,air=10
        // → 10>20 is false → return 30
        expect(interp.output).toBe(30);
    });

    test('execution step tracking', () => {
        const interp = run([
            ['let', 'x', '=', '0'],
            ['for', 'i', '=', '1', 'to', '3', '{'],
            ['x', '=', 'x', '+', '1'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(interp.output).toBe(3);
        expect(interp.steps.length).toBeGreaterThan(0);
        // Each step should have vars snapshot
        for (const step of interp.steps) {
            expect(step).toHaveProperty('vars');
            expect(step).toHaveProperty('line');
        }
    });

    test('undeclared variable in assignment throws', () => {
        expect(() => run([
            ['y', '=', '5'],
        ])).toThrow("'y'");
    });

    test('infinite while loop throws', () => {
        expect(() => run([
            ['let', 'x', '=', '1'],
            ['while', 'x', '>', '0', '{'],
            ['x', '=', 'x', '+', '1'],
            ['}'],
        ])).toThrow('infinite loop');
    });

    test('for loop exceeding 100 iterations throws', () => {
        expect(() => run([
            ['let', 'x', '=', '0'],
            ['for', 'i', '=', '1', 'to', '200', '{'],
            ['x', '=', 'x', '+', '1'],
            ['}'],
        ])).toThrow('100 iterations');
    });
});

// =============================================
// Structural Validation
// =============================================

describe('validateStructure', () => {
    test('valid simple program', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '5'],
            ['return', 'x'],
        ]);
        expect(errors).toEqual([]);
    });

    test('valid for loop program', () => {
        const errors = validateStructure([
            ['let', 'sum', '=', '0'],
            ['for', 'i', '=', '1', 'to', '5', '{'],
            ['sum', '=', 'sum', '+', 'i'],
            ['}'],
            ['return', 'sum'],
        ]);
        expect(errors).toEqual([]);
    });

    test('undeclared variable in assignment', () => {
        const errors = validateStructure([
            ['x', '=', '5'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('not declared');
    });

    test('keyword used as variable name', () => {
        const errors = validateStructure([
            ['let', 'while', '=', '5'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('keyword');
    });

    test('missing = in let declaration', () => {
        const errors = validateStructure([
            ['let', 'x', '+', '5'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain("expected '='");
    });

    test('incomplete let declaration', () => {
        const errors = validateStructure([
            ['let', 'x'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('incomplete');
    });

    test('missing { in while statement', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '5'],
            ['while', 'x', '>', '0'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('missing comparison in while condition', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '5'],
            ['while', 'x', '+', '0', '{'],
        ]);
        expect(errors.some(e => e.includes('comparison'))).toBe(true);
    });

    test('return with no value', () => {
        const errors = validateStructure([
            ['return'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('no value');
    });

    test('undeclared variable in expression', () => {
        const errors = validateStructure([
            ['let', 'x', '=', 'y'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('not declared');
    });

    test('operator at start of expression', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '+', '5'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('unexpected operator');
    });

    test('consecutive operators in expression', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '5', '+', '+', '3'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('for loop validates structure', () => {
        const errors = validateStructure([
            ['for', 'i', '=', '1', 'to', '5', '{'],
            ['}'],
        ]);
        expect(errors).toEqual([]);
    });

    test('incomplete for loop', () => {
        const errors = validateStructure([
            ['for', 'i', '=', '1', '{'],
        ]);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('brace-only lines are skipped', () => {
        const errors = validateStructure([
            ['let', 'x', '=', '5'],
            ['{'],
            ['}'],
            ['return', 'x'],
        ]);
        expect(errors).toEqual([]);
    });
});

// =============================================
// Score Labels
// =============================================

describe('Parsed getScoreLabel', () => {
    test('Genius at -3 or better', () => {
        expect(getScoreLabel(2, 5)).toBe('Genius!');
        expect(getScoreLabel(0, 5)).toBe('Genius!');
    });

    test('Hacker at -2', () => {
        expect(getScoreLabel(3, 5)).toBe('Hacker!');
    });

    test('Optimized at -1', () => {
        expect(getScoreLabel(4, 5)).toBe('Optimized!');
    });

    test('Compiled at par', () => {
        expect(getScoreLabel(5, 5)).toBe('Compiled');
    });

    test('Verbose at +1', () => {
        expect(getScoreLabel(6, 5)).toBe('Verbose');
    });

    test('Spaghetti at +2 and above', () => {
        expect(getScoreLabel(7, 5)).toBe('Spaghetti (+2)');
        expect(getScoreLabel(10, 5)).toBe('Spaghetti (+5)');
    });
});
