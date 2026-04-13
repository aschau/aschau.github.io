// Gamification tests — Arcade Edition
// Imports from js/gamification.module.js (canonical reference for gamification.js).

const {
    ACHIEVEMENTS,
    SECTIONS,
    ALL_TABS,
    getJSON,
    setJSON,
    unlockAchievement,
    processSectionVisit,
    checkTabMaster,
    checkSectionComplete,
    checkCardCollector,
    checkNightOwl,
    calculateProgress,
} = require('../js/gamification.module');

// ── Helpers ──────────────────────────────────────────────────

function createMockStorage(initial) {
    const store = Object.assign({}, initial || {});
    return {
        getItem: (k) => store[k] !== undefined ? store[k] : null,
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; },
        _store: store,
    };
}

// ── Achievement Definitions ──────────────────────────────────

describe('Achievement definitions', () => {
    test('9 achievements defined', () => {
        expect(Object.keys(ACHIEVEMENTS).length).toBe(9);
    });

    test('each achievement has title, desc, hint, icon', () => {
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            expect(typeof ach.title).toBe('string');
            expect(typeof ach.desc).toBe('string');
            expect(typeof ach.hint).toBe('string');
            expect(typeof ach.icon).toBe('string');
            expect(ach.title.length).toBeGreaterThan(0);
            expect(ach.desc.length).toBeGreaterThan(0);
            expect(ach.icon.length).toBeGreaterThan(0);
        }
    });

    test('hints end with "..." (mysterious tone)', () => {
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            expect(ach.hint).toMatch(/\.\.\.$/);
        }
    });

    test('SECTIONS includes all 6 arcade sections', () => {
        expect(SECTIONS).toContain('home');
        expect(SECTIONS).toContain('about');
        expect(SECTIONS).toContain('journey');
        expect(SECTIONS).toContain('work');
        expect(SECTIONS).toContain('personal');
        expect(SECTIONS).toContain('play');
        expect(SECTIONS.length).toBe(6);
    });

    test('ALL_TABS includes all 10 tab IDs', () => {
        expect(ALL_TABS).toContain('w-blizzard');
        expect(ALL_TABS).toContain('w-mw');
        expect(ALL_TABS).toContain('w-sega');
        expect(ALL_TABS).toContain('w-trigger');
        expect(ALL_TABS).toContain('w-stb');
        expect(ALL_TABS).toContain('pp-fc');
        expect(ALL_TABS).toContain('pp-wh');
        expect(ALL_TABS).toContain('pp-ai');
        expect(ALL_TABS).toContain('pp-web');
        expect(ALL_TABS).toContain('pp-col');
        expect(ALL_TABS.length).toBe(10);
    });
});

// ── Storage Helpers ──────────────────────────────────────────

describe('getJSON / setJSON', () => {
    test('getJSON returns fallback for missing key', () => {
        const storage = createMockStorage();
        expect(getJSON(storage, 'missing', {})).toEqual({});
        expect(getJSON(storage, 'missing', [])).toEqual([]);
        expect(getJSON(storage, 'missing', 42)).toBe(42);
    });

    test('getJSON parses stored JSON', () => {
        const data = { 'cabinet-crawler': { unlocked: true } };
        const storage = createMockStorage({ mykey: JSON.stringify(data) });
        expect(getJSON(storage, 'mykey', {})).toEqual(data);
    });

    test('getJSON returns fallback on corrupted JSON', () => {
        const storage = createMockStorage({ bad: '{broken' });
        expect(getJSON(storage, 'bad', {})).toEqual({});
    });

    test('getJSON returns fallback when storage throws', () => {
        const storage = {
            getItem: () => { throw new Error('quota exceeded'); },
        };
        expect(getJSON(storage, 'key', 'default')).toBe('default');
    });

    test('setJSON writes stringified value', () => {
        const storage = createMockStorage();
        setJSON(storage, 'test', { a: 1 });
        expect(storage._store.test).toBe('{"a":1}');
    });

    test('setJSON does not throw when storage is full', () => {
        const storage = {
            setItem: () => { throw new Error('quota exceeded'); },
        };
        expect(() => setJSON(storage, 'key', 'val')).not.toThrow();
    });
});

// ── unlockAchievement ────────────────────────────────────────

describe('unlockAchievement', () => {
    const KEY = 'test_achievements';

    test('unlocks a new achievement and persists it', () => {
        const storage = createMockStorage();
        const result = unlockAchievement(storage, KEY, 'cabinet-crawler');
        expect(result).toBe(true);

        const saved = JSON.parse(storage._store[KEY]);
        expect(saved['cabinet-crawler']).toBeDefined();
        expect(saved['cabinet-crawler'].unlocked).toBe(true);
        expect(saved['cabinet-crawler'].date).toBeDefined();
    });

    test('returns false for already-unlocked achievement', () => {
        const storage = createMockStorage({
            [KEY]: JSON.stringify({ 'cabinet-crawler': { unlocked: true, date: '2025-01-01' } }),
        });
        expect(unlockAchievement(storage, KEY, 'cabinet-crawler')).toBe(false);
    });

    test('multiple achievements accumulate in storage', () => {
        const storage = createMockStorage();
        unlockAchievement(storage, KEY, 'cabinet-crawler');
        unlockAchievement(storage, KEY, 'curious');

        const saved = JSON.parse(storage._store[KEY]);
        expect(Object.keys(saved)).toEqual(['cabinet-crawler', 'curious']);
    });

    test('does not overwrite existing achievements when adding new ones', () => {
        const storage = createMockStorage({
            [KEY]: JSON.stringify({ 'cabinet-crawler': { unlocked: true, date: '2025-01-01' } }),
        });
        unlockAchievement(storage, KEY, 'curious');

        const saved = JSON.parse(storage._store[KEY]);
        expect(saved['cabinet-crawler'].date).toBe('2025-01-01');
        expect(saved.curious.unlocked).toBe(true);
    });
});

// ── processSectionVisit ─────────────────────────────────────

describe('processSectionVisit', () => {
    test('tracks a new section visit', () => {
        const result = processSectionVisit('about', []);
        expect(result.sectionsToSave).toContain('about');
    });

    test('does not duplicate already-visited sections', () => {
        const result = processSectionVisit('about', ['about']);
        expect(result.sectionsToSave.filter(s => s === 'about').length).toBe(1);
    });

    test('ignores sections not in SECTIONS', () => {
        const result = processSectionVisit('unknown', []);
        expect(result.sectionsToSave).toEqual([]);
    });

    test('unlocks cabinet-crawler after visiting all 6 sections', () => {
        const visited = ['home', 'about', 'journey', 'work', 'personal'];
        const result = processSectionVisit('play', visited);
        expect(result.achievementsToUnlock).toContain('cabinet-crawler');
    });

    test('does not unlock cabinet-crawler with only 5 sections', () => {
        const visited = ['home', 'about', 'journey', 'work'];
        const result = processSectionVisit('personal', visited);
        expect(result.achievementsToUnlock).not.toContain('cabinet-crawler');
    });

    test('unlocks player-one when visiting play section', () => {
        const result = processSectionVisit('play', []);
        expect(result.achievementsToUnlock).toContain('player-one');
    });

    test('does not unlock player-one for other sections', () => {
        const result = processSectionVisit('work', []);
        expect(result.achievementsToUnlock).not.toContain('player-one');
    });

    test('can unlock multiple achievements in one visit (play as 6th section)', () => {
        const visited = ['home', 'about', 'journey', 'work', 'personal'];
        const result = processSectionVisit('play', visited);
        expect(result.achievementsToUnlock).toContain('cabinet-crawler');
        expect(result.achievementsToUnlock).toContain('player-one');
    });

    test('does not mutate the input array', () => {
        const visited = ['home'];
        processSectionVisit('about', visited);
        expect(visited).toEqual(['home']);
    });
});

// ── checkTabMaster ──────────────────────────────────────────

describe('checkTabMaster', () => {
    test('returns false with no tabs clicked', () => {
        expect(checkTabMaster([])).toBe(false);
    });

    test('returns false with some tabs clicked', () => {
        expect(checkTabMaster(['w-blizzard', 'w-mw', 'pp-fc'])).toBe(false);
    });

    test('returns true when all 10 tabs clicked', () => {
        expect(checkTabMaster([...ALL_TABS])).toBe(true);
    });

    test('returns true with extra tabs beyond the required set', () => {
        expect(checkTabMaster([...ALL_TABS, 'extra-tab'])).toBe(true);
    });

    test('order does not matter', () => {
        const reversed = [...ALL_TABS].reverse();
        expect(checkTabMaster(reversed)).toBe(true);
    });
});

// ── checkSectionComplete ────────────────────────────────────

describe('checkSectionComplete', () => {
    test('returns false with no flips', () => {
        expect(checkSectionComplete([], 3)).toBe(false);
    });

    test('returns false with partial flips', () => {
        expect(checkSectionComplete([0, 1], 3)).toBe(false);
    });

    test('returns true when all cards flipped', () => {
        expect(checkSectionComplete([0, 1, 2], 3)).toBe(true);
    });

    test('handles duplicate flip indices', () => {
        expect(checkSectionComplete([0, 0, 1, 1, 2], 3)).toBe(true);
    });

    test('returns false for 0 total flippable', () => {
        expect(checkSectionComplete([], 0)).toBe(false);
    });
});

// ── checkCardCollector ──────────────────────────────────────

describe('checkCardCollector', () => {
    test('returns false when no sections have flips', () => {
        expect(checkCardCollector({}, { work: 3, personal: 2 })).toBe(false);
    });

    test('returns false when only some sections complete', () => {
        expect(checkCardCollector(
            { work: [0, 1, 2] },
            { work: 3, personal: 2 }
        )).toBe(false);
    });

    test('returns true when all sections complete', () => {
        expect(checkCardCollector(
            { work: [0, 1, 2], personal: [0, 1] },
            { work: 3, personal: 2 }
        )).toBe(true);
    });

    test('ignores sections with 0 flippable cards', () => {
        expect(checkCardCollector(
            { work: [0, 1] },
            { work: 2, home: 0 }
        )).toBe(true);
    });

    test('handles duplicate indices in flipped arrays', () => {
        expect(checkCardCollector(
            { work: [0, 0, 1, 1, 2], personal: [0, 0, 1] },
            { work: 3, personal: 2 }
        )).toBe(true);
    });
});

// ── checkNightOwl ────────────────────────────────────────────

describe('checkNightOwl', () => {
    test('fires at 10 PM', () => {
        expect(checkNightOwl(22)).toBe(true);
    });

    test('fires at 11 PM', () => {
        expect(checkNightOwl(23)).toBe(true);
    });

    test('fires at midnight', () => {
        expect(checkNightOwl(0)).toBe(true);
    });

    test('fires at 4 AM (last qualifying hour)', () => {
        expect(checkNightOwl(4)).toBe(true);
    });

    test('does not fire at 5 AM', () => {
        expect(checkNightOwl(5)).toBe(false);
    });

    test('does not fire at noon', () => {
        expect(checkNightOwl(12)).toBe(false);
    });

    test('does not fire at 9 PM', () => {
        expect(checkNightOwl(21)).toBe(false);
    });
});

// ── calculateProgress ────────────────────────────────────────

describe('calculateProgress', () => {
    test('0 sections = 0%', () => {
        expect(calculateProgress(0)).toBe(0);
    });

    test('all 6 sections = 100%', () => {
        expect(calculateProgress(6)).toBe(100);
    });

    test('1 of 6 = 17%', () => {
        expect(calculateProgress(1)).toBe(17);
    });

    test('3 of 6 = 50%', () => {
        expect(calculateProgress(3)).toBe(50);
    });

    test('5 of 6 = 83%', () => {
        expect(calculateProgress(5)).toBe(83);
    });
});
