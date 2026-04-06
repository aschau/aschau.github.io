const fs = require('fs');
const vm = require('vm');

// Load share.js as a global function (it defines generateShareText globally)
const shareCode = fs.readFileSync(
    require('path').join(__dirname, '..', 'games', 'beamlab', 'share.js'),
    'utf-8'
);
const context = vm.createContext({});
vm.runInContext(shareCode, context);
const generateShareText = context.generateShareText;

describe('Beamlab generateShareText', () => {
    test('basic share text with score label', () => {
        const text = generateShareText(42, 4, 4, 1, false, 0, null, null);
        expect(text).toContain('Beamlab #42');
        expect(text).toContain('Focused');
        expect(text).toContain('4/4');
        expect(text).toContain('https://www.raggedydoc.com/beamlab');
    });

    test('Brilliant label when under par', () => {
        const text = generateShareText(1, 3, 4, 1, false, 0, null, null);
        expect(text).toContain('Brilliant!');
        expect(text).toContain('3/4');
    });

    test('Refracted label when well over par', () => {
        const text = generateShareText(1, 8, 4, 1, false, 0, null, null);
        expect(text).toContain('Refracted (+2)');
    });

    test('includes gem emoji when gotGem is true', () => {
        const text = generateShareText(1, 4, 4, 1, true, 1, null, null);
        expect(text).toContain('\uD83D\uDC8E'); // 💎
    });

    test('no gem emoji when gotGem is false', () => {
        const text = generateShareText(1, 4, 4, 1, false, 0, null, null);
        const lines = text.split('\n');
        const scoreLine = lines[1]; // second line is score
        expect(scoreLine).not.toContain('\uD83D\uDC8E');
    });

    test('includes username when provided', () => {
        const text = generateShareText(1, 4, 4, 1, false, 0, 'TestUser', null);
        expect(text).toContain("TestUser's Beamlab #1");
    });

    test('no username prefix when null', () => {
        const text = generateShareText(1, 4, 4, 1, false, 0, null, null);
        expect(text.startsWith('Beamlab #1')).toBe(true);
    });

    test('includes streak when > 1', () => {
        const text = generateShareText(1, 4, 4, 5, false, 0, null, null);
        expect(text).toContain('5 day streak');
    });

    test('no streak line when streak is 1', () => {
        const text = generateShareText(1, 4, 4, 1, false, 0, null, null);
        expect(text).not.toContain('day streak');
    });

    test('includes puzzle preview info', () => {
        const info = { fixed: 2, targets: 3, walls: 4 };
        const text = generateShareText(1, 4, 4, 1, false, 0, null, info);
        expect(text).toContain('2 fixed');
        expect(text).toContain('3 targets');
        expect(text).toContain('4 walls');
    });
});
