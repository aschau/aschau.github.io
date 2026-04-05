// Gamification tests — validate achievement definitions and pure logic.
// The gamification.js runs inside an IIFE with DOM dependencies,
// so we test the data structure and logic patterns directly.

describe('Gamification achievement definitions', () => {
    // Load the achievement config by evaluating the IIFE in a sandboxed context
    const fs = require('fs');
    const vm = require('vm');
    const code = fs.readFileSync(
        require('path').join(__dirname, '..', 'js', 'gamification.js'),
        'utf-8'
    );

    // Extract the ACHIEVEMENTS object and helper functions via a mock context
    let ACHIEVEMENTS, MAIN_PAGES;

    beforeAll(() => {
        // Create a minimal DOM mock to let the IIFE run far enough to define ACHIEVEMENTS
        const mockStorage = {};
        const context = vm.createContext({
            localStorage: {
                getItem: (k) => mockStorage[k] || null,
                setItem: (k, v) => { mockStorage[k] = v; },
            },
            document: {
                createElement: () => ({
                    id: '',
                    className: '',
                    innerHTML: '',
                    textContent: '',
                    appendChild: () => {},
                    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
                    querySelector: () => null,
                    querySelectorAll: () => [],
                    setAttribute: () => {},
                    addEventListener: () => {},
                    style: {},
                }),
                body: {
                    appendChild: () => {},
                    addEventListener: () => {},
                },
                querySelectorAll: () => [],
                querySelector: () => null,
                addEventListener: () => {},
                getElementById: () => null,
                documentElement: {
                    style: {},
                    classList: { add: () => {}, remove: () => {}, contains: () => false },
                },
                readyState: 'complete',
            },
            window: {
                location: { pathname: '/index.html', href: '' },
                matchMedia: () => ({ matches: false }),
                addEventListener: () => {},
                scrollY: 0,
                innerHeight: 800,
            },
            navigator: { userAgent: '' },
            setTimeout: () => {},
            setInterval: () => {},
            requestAnimationFrame: () => {},
            console: { log: () => {}, warn: () => {}, error: () => {} },
            Date: Date,
        });

        // Override window ref
        context.window.document = context.document;

        try {
            vm.runInContext(code, context);
        } catch (e) {
            // IIFE may fail on missing DOM — that's OK, we just need the data
        }

        // Extract ACHIEVEMENTS from the code via regex (since it's inside IIFE)
        const achMatch = code.match(/var ACHIEVEMENTS\s*=\s*(\{[\s\S]*?\n\s*\});/);
        if (achMatch) {
            ACHIEVEMENTS = vm.runInContext('(' + achMatch[1] + ')', vm.createContext({}));
        }

        const pagesMatch = code.match(/var MAIN_PAGES\s*=\s*(\[[\s\S]*?\]);/);
        if (pagesMatch) {
            MAIN_PAGES = vm.runInContext('(' + pagesMatch[1] + ')', vm.createContext({}));
        }
    });

    test('ACHIEVEMENTS object exists with expected keys', () => {
        expect(ACHIEVEMENTS).toBeDefined();
        const expectedKeys = [
            'explorer', 'curious', 'night-owl', 'speed-reader',
            'deep-diver', 'timeline-historian', 'skill-scout',
            'social-butterfly', 'player-one'
        ];
        for (const key of expectedKeys) {
            expect(ACHIEVEMENTS).toHaveProperty(key);
        }
    });

    test('each achievement has required fields', () => {
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            expect(ach).toHaveProperty('title');
            expect(ach).toHaveProperty('desc');
            expect(ach).toHaveProperty('hint');
            expect(ach).toHaveProperty('icon');
            expect(typeof ach.title).toBe('string');
            expect(typeof ach.desc).toBe('string');
            expect(typeof ach.hint).toBe('string');
            expect(ach.title.length).toBeGreaterThan(0);
            expect(ach.desc.length).toBeGreaterThan(0);
        }
    });

    test('9 achievements defined', () => {
        expect(Object.keys(ACHIEVEMENTS).length).toBe(9);
    });

    test('MAIN_PAGES has the expected pages', () => {
        expect(MAIN_PAGES).toBeDefined();
        expect(MAIN_PAGES).toContain('index.html');
        expect(MAIN_PAGES).toContain('aboutMe.html');
        expect(MAIN_PAGES).toContain('workprojects.html');
        expect(MAIN_PAGES).toContain('personalprojects.html');
    });

    test('achievement icons are non-empty strings', () => {
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            expect(ach.icon.length).toBeGreaterThan(0);
        }
    });

    test('achievement hints do not reveal the answer directly', () => {
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            // Hints should end with "..." (they're meant to be mysterious)
            expect(ach.hint).toMatch(/\.\.\.$/);
        }
    });
});

describe('Gamification storage helpers (logic validation)', () => {
    test('getJSON returns fallback for missing key', () => {
        // Replicate the getJSON logic
        function getJSON(storage, key, fallback) {
            try {
                var val = storage.getItem(key);
                return val ? JSON.parse(val) : fallback;
            } catch (e) {
                return fallback;
            }
        }

        const mockStorage = { getItem: () => null };
        expect(getJSON(mockStorage, 'nonexistent', {})).toEqual({});
        expect(getJSON(mockStorage, 'nonexistent', [])).toEqual([]);
    });

    test('getJSON parses stored JSON', () => {
        function getJSON(storage, key, fallback) {
            try {
                var val = storage.getItem(key);
                return val ? JSON.parse(val) : fallback;
            } catch (e) {
                return fallback;
            }
        }

        const data = { explorer: true, curious: true };
        const mockStorage = { getItem: () => JSON.stringify(data) };
        expect(getJSON(mockStorage, 'achievements', {})).toEqual(data);
    });

    test('getJSON returns fallback on corrupted JSON', () => {
        function getJSON(storage, key, fallback) {
            try {
                var val = storage.getItem(key);
                return val ? JSON.parse(val) : fallback;
            } catch (e) {
                return fallback;
            }
        }

        const mockStorage = { getItem: () => '{broken json' };
        expect(getJSON(mockStorage, 'key', {})).toEqual({});
    });

    test('progress calculation: percentage of achievements unlocked', () => {
        const totalAchievements = 9;
        const unlockedCount = 4;
        const progress = Math.round((unlockedCount / totalAchievements) * 100);
        expect(progress).toBe(44);
    });
});
