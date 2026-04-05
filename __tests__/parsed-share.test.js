const fs = require('fs');
const vm = require('vm');

const shareCode = fs.readFileSync(
    require('path').join(__dirname, '..', 'games', 'parsed', 'share.js'),
    'utf-8'
);
const context = vm.createContext({});
vm.runInContext(shareCode, context);
const generateShareText = context.generateShareText;

describe('Parsed generateShareText', () => {
    test('basic share text', () => {
        const text = generateShareText(42, 5, 5, null, 1, null, false);
        expect(text).toContain('Parsed #42');
        expect(text).toContain('Compiled');
        expect(text).toContain('5/5');
        expect(text).toContain('https://www.raggedydoc.com/games/parsed');
    });

    test('Genius label when well under par', () => {
        const text = generateShareText(1, 2, 5, null, 1, null, false);
        expect(text).toContain('Genius!');
    });

    test('Spaghetti label when over par', () => {
        const text = generateShareText(1, 8, 5, null, 1, null, false);
        expect(text).toContain('Spaghetti (+3)');
    });

    test('includes username when provided', () => {
        const text = generateShareText(1, 5, 5, null, 1, 'Alice', false);
        expect(text).toContain("Alice's Parsed #1");
    });

    test('no username prefix when null', () => {
        const text = generateShareText(1, 5, 5, null, 1, null, false);
        expect(text.startsWith('Parsed #1')).toBe(true);
    });

    test('includes streak when > 1', () => {
        const text = generateShareText(1, 5, 5, null, 7, null, false);
        expect(text).toContain('7 day streak');
    });

    test('no streak when 1', () => {
        const text = generateShareText(1, 5, 5, null, 1, null, false);
        expect(text).not.toContain('day streak');
    });

    test('archive mode shows (Archive) and ?day= URL', () => {
        const text = generateShareText(10, 5, 5, null, 1, null, true);
        expect(text).toContain('(Archive)');
        expect(text).toContain('?day=10');
    });

    test('archive mode suppresses streak', () => {
        const text = generateShareText(10, 5, 5, null, 5, null, true);
        expect(text).not.toContain('day streak');
    });

    test('extracts theme emoji from shareResult', () => {
        const text = generateShareText(1, 5, 5, '\uD83D\uDCF8 Taken: 36 photos!', 1, null, false);
        // Should include the camera emoji in score line
        expect(text).toContain('\uD83D\uDCF8');
    });
});
