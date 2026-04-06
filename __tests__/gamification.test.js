// Gamification tests — exercise real module logic, not just data validation.
// Imports from js/gamification.module.js (canonical reference for gamification.js).

const {
    ACHIEVEMENTS,
    MAIN_PAGES,
    getJSON,
    setJSON,
    unlockAchievement,
    processPageVisit,
    checkNightOwl,
    checkSpeedReader,
    calculateProgress,
    checkTimelineHistorian,
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

    test('MAIN_PAGES includes the 4 portfolio pages plus deep-dive', () => {
        expect(MAIN_PAGES).toContain('index.html');
        expect(MAIN_PAGES).toContain('aboutMe.html');
        expect(MAIN_PAGES).toContain('workprojects.html');
        expect(MAIN_PAGES).toContain('personalprojects.html');
        expect(MAIN_PAGES).toContain('deep-dive');
        expect(MAIN_PAGES.length).toBe(5);
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
        const data = { explorer: { unlocked: true } };
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
        const result = unlockAchievement(storage, KEY, 'explorer');
        expect(result).toBe(true);

        const saved = JSON.parse(storage._store[KEY]);
        expect(saved.explorer).toBeDefined();
        expect(saved.explorer.unlocked).toBe(true);
        expect(saved.explorer.date).toBeDefined();
    });

    test('returns false for already-unlocked achievement', () => {
        const storage = createMockStorage({
            [KEY]: JSON.stringify({ explorer: { unlocked: true, date: '2025-01-01' } }),
        });
        expect(unlockAchievement(storage, KEY, 'explorer')).toBe(false);
    });

    test('multiple achievements accumulate in storage', () => {
        const storage = createMockStorage();
        unlockAchievement(storage, KEY, 'explorer');
        unlockAchievement(storage, KEY, 'curious');

        const saved = JSON.parse(storage._store[KEY]);
        expect(Object.keys(saved)).toEqual(['explorer', 'curious']);
    });

    test('does not overwrite existing achievements when adding new ones', () => {
        const storage = createMockStorage({
            [KEY]: JSON.stringify({ explorer: { unlocked: true, date: '2025-01-01' } }),
        });
        unlockAchievement(storage, KEY, 'curious');

        const saved = JSON.parse(storage._store[KEY]);
        expect(saved.explorer.date).toBe('2025-01-01');
        expect(saved.curious.unlocked).toBe(true);
    });
});

// ── processPageVisit ─────────────────────────────────────────

describe('processPageVisit', () => {
    test('tracks a new main page visit', () => {
        const result = processPageVisit('aboutMe.html', [], '/aboutMe.html');
        expect(result.pagesToSave).toContain('aboutMe.html');
    });

    test('does not duplicate already-visited pages', () => {
        const result = processPageVisit('aboutMe.html', ['aboutMe.html'], '/aboutMe.html');
        expect(result.pagesToSave.filter(p => p === 'aboutMe.html').length).toBe(1);
    });

    test('ignores pages not in MAIN_PAGES', () => {
        const result = processPageVisit('random.html', [], '/random.html');
        expect(result.pagesToSave).toEqual([]);
    });

    test('unlocks explorer after visiting all 4 main pages', () => {
        const visited = ['index.html', 'aboutMe.html', 'workprojects.html'];
        const result = processPageVisit('personalprojects.html', visited, '/personalprojects.html');
        expect(result.achievementsToUnlock).toContain('explorer');
    });

    test('does not unlock explorer with only 3 main pages', () => {
        const visited = ['index.html', 'aboutMe.html'];
        const result = processPageVisit('workprojects.html', visited, '/workprojects.html');
        expect(result.achievementsToUnlock).not.toContain('explorer');
    });

    test('deep-dive does not count toward explorer (needs 4 real pages)', () => {
        const visited = ['index.html', 'aboutMe.html', 'deep-dive'];
        const result = processPageVisit('workprojects.html', visited, '/workprojects.html');
        expect(result.achievementsToUnlock).not.toContain('explorer');
    });

    test('unlocks skill-scout when visiting aboutMe.html', () => {
        const result = processPageVisit('aboutMe.html', [], '/aboutMe.html');
        expect(result.achievementsToUnlock).toContain('skill-scout');
    });

    test('does not unlock skill-scout for other pages', () => {
        const result = processPageVisit('index.html', [], '/index.html');
        expect(result.achievementsToUnlock).not.toContain('skill-scout');
    });

    test('unlocks deep-diver for project detail pages', () => {
        const result = processPageVisit('beamlab.html', [], '/projects/personal/beamlab.html');
        expect(result.achievementsToUnlock).toContain('deep-diver');
    });

    test('adds deep-dive to pages when visiting a project page', () => {
        const result = processPageVisit('beamlab.html', [], '/projects/personal/beamlab.html');
        expect(result.pagesToSave).toContain('deep-dive');
    });

    test('does not duplicate deep-dive if already tracked', () => {
        const result = processPageVisit('other.html', ['deep-dive'], '/projects/work/other.html');
        expect(result.pagesToSave.filter(p => p === 'deep-dive').length).toBe(1);
    });

    test('can unlock multiple achievements in one visit', () => {
        // Visiting aboutMe.html as the 4th main page on a project-like path
        const visited = ['index.html', 'workprojects.html', 'personalprojects.html'];
        const result = processPageVisit('aboutMe.html', visited, '/aboutMe.html');
        expect(result.achievementsToUnlock).toContain('explorer');
        expect(result.achievementsToUnlock).toContain('skill-scout');
    });

    test('does not mutate the input array', () => {
        const visited = ['index.html'];
        processPageVisit('aboutMe.html', visited, '/aboutMe.html');
        expect(visited).toEqual(['index.html']);
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

// ── checkSpeedReader ─────────────────────────────────────────

describe('checkSpeedReader', () => {
    test('fires when at bottom in under 10 seconds', () => {
        expect(checkSpeedReader(5000, true)).toBe(true);
    });

    test('does not fire when not at bottom', () => {
        expect(checkSpeedReader(5000, false)).toBe(false);
    });

    test('does not fire at exactly 10 seconds', () => {
        expect(checkSpeedReader(10000, true)).toBe(false);
    });

    test('does not fire after 10 seconds', () => {
        expect(checkSpeedReader(15000, true)).toBe(false);
    });

    test('fires at 0ms (instant scroll)', () => {
        expect(checkSpeedReader(0, true)).toBe(true);
    });
});

// ── calculateProgress ────────────────────────────────────────

describe('calculateProgress', () => {
    test('0 pages = 0%', () => {
        expect(calculateProgress(0, 5)).toBe(0);
    });

    test('all pages = 100%', () => {
        expect(calculateProgress(5, 5)).toBe(100);
    });

    test('4 of 9 = 44% (rounds correctly)', () => {
        expect(calculateProgress(4, 9)).toBe(44);
    });

    test('1 of 5 = 20%', () => {
        expect(calculateProgress(1, 5)).toBe(20);
    });

    test('2 of 3 = 67% (rounds up)', () => {
        expect(calculateProgress(2, 3)).toBe(67);
    });
});

// ── checkTimelineHistorian ───────────────────────────────────

describe('checkTimelineHistorian', () => {
    test('returns false when no entries expanded', () => {
        expect(checkTimelineHistorian({}, 5)).toBe(false);
    });

    test('returns false when some entries expanded', () => {
        expect(checkTimelineHistorian({ 0: true, 1: true }, 5)).toBe(false);
    });

    test('returns true when all entries expanded', () => {
        expect(checkTimelineHistorian({ 0: true, 1: true, 2: true }, 3)).toBe(true);
    });

    test('returns true when more entries tracked than total (pre-seeded)', () => {
        expect(checkTimelineHistorian({ 0: true, 1: true, 2: true, 3: true }, 3)).toBe(true);
    });

    test('returns true when exactly matching count', () => {
        expect(checkTimelineHistorian({ 0: true }, 1)).toBe(true);
    });
});
