const {
    LEVELS,
    REDDIT_STALE_MS,
    getLevel,
    calculateMisery,
    computeBreakdown,
    hasSignalNearby,
    isExcludedPost,
    hasAiContext,
    classifyPost,
    STRONG_OUTAGE,
    USAGE_SIGNALS,
    WEAK_OUTAGE,
    EXCLUSIONS,
    truncateText,
    truncate,
    sanitizeUrl,
    bskyPostUrl,
    timeAgo,
    escapeXml,
    buildIncidentItems,
    buildFeed,
} = require('../tools/misery-index/misery.module');

// =============================================
// Level Thresholds
// =============================================

describe('getLevel', () => {
    test('0 → ALL CLEAR', () => {
        expect(getLevel(0).label).toBe('ALL CLEAR');
        expect(getLevel(0).key).toBe('calm');
    });

    test('1.0 → ALL CLEAR (boundary)', () => {
        expect(getLevel(1).label).toBe('ALL CLEAR');
    });

    test('1.1 → MINOR GRUMBLING', () => {
        expect(getLevel(1.1).label).toBe('MINOR GRUMBLING');
    });

    test('3.0 → MINOR GRUMBLING (boundary)', () => {
        expect(getLevel(3).label).toBe('MINOR GRUMBLING');
    });

    test('3.1 → GROWING UNREST', () => {
        expect(getLevel(3.1).label).toBe('GROWING UNREST');
    });

    test('6.0 → GROWING UNREST (boundary)', () => {
        expect(getLevel(6).label).toBe('GROWING UNREST');
    });

    test('6.1 → FULL MELTDOWN', () => {
        expect(getLevel(6.1).label).toBe('FULL MELTDOWN');
    });

    test('8.0 → FULL MELTDOWN (boundary)', () => {
        expect(getLevel(8).label).toBe('FULL MELTDOWN');
    });

    test('8.1 → APOCALYPSE', () => {
        expect(getLevel(8.1).label).toBe('APOCALYPSE');
    });

    test('10 → APOCALYPSE', () => {
        expect(getLevel(10).label).toBe('APOCALYPSE');
    });

    test('beyond 10 → APOCALYPSE (clamped)', () => {
        expect(getLevel(15).label).toBe('APOCALYPSE');
    });

    test('returns full level object with key and dot', () => {
        const level = getLevel(5);
        expect(level).toHaveProperty('key', 'moderate');
        expect(level).toHaveProperty('dot', 'degraded');
    });
});

// =============================================
// Backend Score Calculation (calculateMisery)
// =============================================

describe('calculateMisery', () => {
    const NOW = Date.now();
    const FRESH_REDDIT = { lastFetched: new Date(NOW - 5 * 60000).toISOString() };

    test('all zeros when no data', () => {
        const result = calculateMisery(null, 0, 0, null, NOW);
        expect(result.total).toBe(0);
        expect(result.breakdown.status).toBe(0);
        expect(result.breakdown.bluesky).toBe(0);
    });

    // --- Status scoring ---
    test('minor indicator → status score 2', () => {
        const status = { status: { indicator: 'minor' } };
        const result = calculateMisery(status, 0, 0, null, NOW);
        expect(result.breakdown.status).toBe(2);
        expect(result.total).toBe(2);
    });

    test('major indicator → status score 4', () => {
        const status = { status: { indicator: 'major' } };
        const result = calculateMisery(status, 0, 0, null, NOW);
        expect(result.breakdown.status).toBe(4);
    });

    test('critical indicator → status score 6', () => {
        const status = { status: { indicator: 'critical' } };
        const result = calculateMisery(status, 0, 0, null, NOW);
        expect(result.breakdown.status).toBe(6);
    });

    test('degraded components add +0.5 each, capped at 2', () => {
        const status = {
            status: { indicator: 'none' },
            components: [
                { status: 'degraded_performance' },
                { status: 'degraded_performance' },
                { status: 'partial_outage' },
                { status: 'partial_outage' },
                { status: 'major_outage' },
            ]
        };
        const result = calculateMisery(status, 0, 0, null, NOW);
        // 5 bad components × 0.5 = 2.5 → capped at 2
        expect(result.breakdown.status).toBe(2);
    });

    test('minor + 3 bad components → 2 + 1.5 = 3.5', () => {
        const status = {
            status: { indicator: 'minor' },
            components: [
                { status: 'degraded_performance' },
                { status: 'partial_outage' },
                { status: 'operational' },
                { status: 'degraded_performance' },
            ]
        };
        const result = calculateMisery(status, 0, 0, null, NOW);
        // minor=2 + 3 bad × 0.5 = 2 + 1.5 = 3.5
        expect(result.breakdown.status).toBe(3.5);
    });

    // --- Bluesky scoring ---
    test('1 bluesky post → 0.5', () => {
        const result = calculateMisery(null, 1, 0, null, NOW);
        expect(result.breakdown.bluesky).toBe(0.5);
    });

    test('5 bluesky posts → 1', () => {
        const result = calculateMisery(null, 5, 0, null, NOW);
        expect(result.breakdown.bluesky).toBe(1);
    });

    test('15 bluesky posts → 1.5', () => {
        const result = calculateMisery(null, 15, 0, null, NOW);
        expect(result.breakdown.bluesky).toBe(1.5);
    });

    test('30 bluesky posts → 2', () => {
        const result = calculateMisery(null, 30, 0, null, NOW);
        expect(result.breakdown.bluesky).toBe(2);
    });

    test('30 bluesky comments → reply bonus 0.5', () => {
        const result = calculateMisery(null, 0, 30, null, NOW);
        expect(result.breakdown.bluesky).toBe(0.5);
    });

    test('75 bluesky comments → reply bonus 1', () => {
        const result = calculateMisery(null, 0, 75, null, NOW);
        expect(result.breakdown.bluesky).toBe(1);
    });

    test('30 posts + 75 comments → 2 + 1 = 3', () => {
        const result = calculateMisery(null, 30, 75, null, NOW);
        expect(result.breakdown.bluesky).toBe(3);
    });

    // --- Reddit scoring ---
    test('fresh reddit with 5 posts → score 2', () => {
        const reddit = { ...FRESH_REDDIT, recentPosts: 5, topPosts: [] };
        const result = calculateMisery(null, 0, 0, reddit, NOW);
        expect(result.breakdown.redditOutage + result.breakdown.redditUsage).toBe(2);
    });

    test('fresh reddit with 30 posts → score 5', () => {
        const reddit = { ...FRESH_REDDIT, recentPosts: 30, topPosts: [] };
        const result = calculateMisery(null, 0, 0, reddit, NOW);
        expect(result.breakdown.redditOutage + result.breakdown.redditUsage).toBe(5);
    });

    test('megathreads count as 4 extra posts', () => {
        const reddit = {
            ...FRESH_REDDIT,
            recentPosts: 3,
            topPosts: [{ isMegathread: true }]
        };
        // 3 + 4 = 7 → score 2 (5-9 range)
        const result = calculateMisery(null, 0, 0, reddit, NOW);
        expect(result.breakdown.redditOutage + result.breakdown.redditUsage).toBe(2);
    });

    test('stale reddit data (>30min) → score 0', () => {
        const staleReddit = {
            lastFetched: new Date(NOW - 35 * 60000).toISOString(),
            recentPosts: 50,
            topPosts: []
        };
        const result = calculateMisery(null, 0, 0, staleReddit, NOW);
        expect(result.breakdown.redditOutage).toBe(0);
        expect(result.breakdown.redditUsage).toBe(0);
    });

    test('reddit outage/usage ratio split', () => {
        const reddit = {
            ...FRESH_REDDIT,
            recentPosts: 10,
            topPosts: [],
            outagePosts: 6,
            usagePosts: 4
        };
        // 10 posts → score 3. Split: outage=3×0.6=1.8→1.8, usage=3×0.4=1.2→1.2
        const result = calculateMisery(null, 0, 0, reddit, NOW);
        expect(result.breakdown.redditOutage).toBe(1.8);
        expect(result.breakdown.redditUsage).toBe(1.2);
    });

    test('reddit with no categories → all outage', () => {
        const reddit = { ...FRESH_REDDIT, recentPosts: 5, topPosts: [] };
        const result = calculateMisery(null, 0, 0, reddit, NOW);
        expect(result.breakdown.redditOutage).toBe(2);
        expect(result.breakdown.redditUsage).toBe(0);
    });

    // --- Total ---
    test('total is capped at 10', () => {
        const status = { status: { indicator: 'critical' }, components: Array(10).fill({ status: 'major_outage' }) };
        // status: 6+2=8, plus bluesky 3, plus reddit 5 = 16 → capped at 10
        const reddit = { ...FRESH_REDDIT, recentPosts: 30, topPosts: [] };
        const result = calculateMisery(status, 30, 75, reddit, NOW);
        expect(result.total).toBe(10);
    });

    test('combined score sums all sources', () => {
        // minor=2, 5 bsky posts=1, 0 comments, 3 reddit posts=1
        const status = { status: { indicator: 'minor' } };
        const reddit = { ...FRESH_REDDIT, recentPosts: 3, topPosts: [] };
        const result = calculateMisery(status, 5, 0, reddit, NOW);
        expect(result.total).toBe(4); // 2+1+1
    });
});

// =============================================
// Frontend Breakdown (computeBreakdown)
// =============================================

describe('computeBreakdown', () => {
    test('official filter zeros out social scores', () => {
        const data = {
            status: { status: { indicator: 'minor' } },
            social: { recentPosts: 30, recentComments: 100, topPosts: [] },
            reddit: { lastFetched: new Date().toISOString(), recentPosts: 20, topPosts: [] }
        };
        const result = computeBreakdown(data, 'official');
        expect(result.bluesky).toBe(0);
        expect(result.reddit).toBe(0);
        expect(result.status).toBe(2);
    });

    test('all filter includes social scores', () => {
        const data = {
            status: { status: { indicator: 'minor' } },
            social: { recentPosts: 5, recentComments: 0, topPosts: [] },
        };
        const result = computeBreakdown(data, 'all');
        expect(result.status).toBe(2);
        expect(result.bluesky).toBe(1);
    });

    test('bluesky outage/usage split from topPosts categories', () => {
        const data = {
            social: {
                recentPosts: 10, recentComments: 0,
                topPosts: [
                    { category: 'outage' },
                    { category: 'outage' },
                    { category: 'usage' },
                ]
            }
        };
        const result = computeBreakdown(data, 'all');
        // bskyScore = 1 (5-14 posts), split 2/3 outage, 1/3 usage
        expect(result.outage).toBeCloseTo(0.7, 1);
        expect(result.usage).toBeCloseTo(0.3, 1);
    });

    test('excludes info-banner component from bad component count', () => {
        const data = {
            status: {
                status: { indicator: 'none' },
                components: [
                    { status: 'degraded_performance', name: 'API' },
                    { status: 'operational', name: 'Dashboard' },
                    { status: 'degraded_performance', name: 'Visit https://status.claude.com for more information' },
                ]
            }
        };
        const result = computeBreakdown(data, 'all');
        // Only 1 real bad component (API), info-banner excluded
        expect(result.status).toBe(0.5);
    });

    test('excludes Reddit data older than 24 hours from score', () => {
        const now = Date.now();
        const staleTime = new Date(now - 25 * 60 * 60 * 1000).toISOString();
        const data = {
            social: { recentPosts: 0, recentComments: 0, topPosts: [] },
            reddit: { lastFetched: staleTime, recentPosts: 10, topPosts: [], outagePosts: 10, usagePosts: 0 }
        };
        const result = computeBreakdown(data, 'all', now);
        expect(result.reddit).toBe(0);
    });

    test('includes Reddit data from earlier today in score', () => {
        const now = Date.now();
        const freshTime = new Date(now - 6 * 60 * 60 * 1000).toISOString();
        const data = {
            social: { recentPosts: 0, recentComments: 0, topPosts: [] },
            reddit: { lastFetched: freshTime, recentPosts: 10, topPosts: [], outagePosts: 10, usagePosts: 0 }
        };
        const result = computeBreakdown(data, 'all', now);
        expect(result.reddit).toBe(3);
    });
});

// =============================================
// Post Classification
// =============================================

describe('classifyPost', () => {
    test('strong outage signal near claude → outage', () => {
        expect(classifyPost('claude is down right now and i need to code', 0)).toBe('outage');
    });

    test('strong outage: 500 error with claude', () => {
        expect(classifyPost('claude api keeps giving 500 error', 0)).toBe('outage');
    });

    test('usage signal with frustration → usage', () => {
        expect(classifyPost('claude rate limit is so annoying, ugh', 0)).toBe('usage');
    });

    test('usage signal with high likes → usage', () => {
        expect(classifyPost('claude rate limit hit again today', 10)).toBe('usage');
    });

    test('usage signal with 2+ keywords → usage', () => {
        expect(classifyPost('claude rate limit and token limit hit at once', 0)).toBe('usage');
    });

    test('single usage signal without corroboration → rejected', () => {
        expect(classifyPost('claude rate limit is interesting', 0)).toBe(false);
    });

    test('weak outage with frustration → outage', () => {
        expect(classifyPost('claude api is so slow today wtf', 0)).toBe('outage');
    });

    test('weak outage with 2+ signals → outage', () => {
        expect(classifyPost('claude api is so slow and buggy today', 0)).toBe('outage');
    });

    test('single weak outage without corroboration → rejected', () => {
        expect(classifyPost('claude seems broken but maybe its me', 0)).toBe(false);
    });

    test('excluded: past tense → rejected', () => {
        expect(classifyPost('claude was down yesterday but its fine now', 0)).toBe(false);
    });

    test('excluded: positive sentiment → rejected', () => {
        expect(classifyPost('claude is great, works great for coding', 0)).toBe(false);
    });

    test('excluded: dependency humor → rejected', () => {
        expect(classifyPost('claude is down and i forgot how to code lol', 0)).toBe(false);
    });

    test('excluded: competitive switching → rejected', () => {
        expect(classifyPost('gave up on claude and switched to chatgpt', 0)).toBe(false);
    });

    test('no mention of claude or anthropic → rejected', () => {
        expect(classifyPost('the api is down and not working at all', 0)).toBe(false);
    });

    test('claude without AI context → rejected (could be a person)', () => {
        expect(classifyPost('claude came to dinner last night', 0)).toBe(false);
    });

    test('claude with AI context but no signal → rejected', () => {
        expect(classifyPost('i asked claude the ai model a question', 0)).toBe(false);
    });

    test('anthropic bypasses AI context check', () => {
        expect(classifyPost('anthropic outage affecting everyone', 0)).toBe('outage');
    });
});

// =============================================
// Signal Detection Helpers
// =============================================

describe('hasSignalNearby', () => {
    test('signal within radius of claude → true', () => {
        expect(hasSignalNearby('i think claude is down', ['is down'], 80)).toBe(true);
    });

    test('signal far from claude → false', () => {
        const padding = 'x'.repeat(100);
        expect(hasSignalNearby('claude ' + padding + ' is down', ['is down'], 80)).toBe(false);
    });

    test('signal near anthropic → true', () => {
        expect(hasSignalNearby('anthropic outage reported', ['outage'], 80)).toBe(true);
    });

    test('no signal → false', () => {
        expect(hasSignalNearby('claude is wonderful today', ['is down', 'outage'], 80)).toBe(false);
    });
});

describe('isExcludedPost', () => {
    test('past tense near claude → excluded', () => {
        expect(isExcludedPost('claude was down earlier today')).toBe(true);
    });

    test('positive near claude → excluded', () => {
        expect(isExcludedPost('i love claude it works great')).toBe(true);
    });

    test('no exclusion keyword → not excluded', () => {
        expect(isExcludedPost('claude is down right now')).toBe(false);
    });

    test('exclusion word far from claude → not excluded', () => {
        const padding = 'x'.repeat(100);
        expect(isExcludedPost('claude ' + padding + ' was down')).toBe(false);
    });
});

describe('hasAiContext', () => {
    test('api → true', () => {
        expect(hasAiContext('claude api is slow')).toBe(true);
    });

    test('sonnet → true', () => {
        expect(hasAiContext('claude sonnet 4 is amazing')).toBe(true);
    });

    test('no context → false', () => {
        expect(hasAiContext('claude is a nice name')).toBe(false);
    });
});

// =============================================
// Utility Functions
// =============================================

describe('truncateText', () => {
    test('short text unchanged', () => {
        expect(truncateText('hello world', 20)).toBe('hello world');
    });

    test('long text truncated with ...', () => {
        expect(truncateText('a'.repeat(50), 20)).toBe('a'.repeat(20) + '...');
    });

    test('newlines replaced with spaces', () => {
        expect(truncateText('hello\n\nworld', 20)).toBe('hello world');
    });

    test('leading/trailing whitespace trimmed', () => {
        expect(truncateText('  hello  ', 20)).toBe('hello');
    });
});

describe('truncate', () => {
    test('short string unchanged', () => {
        expect(truncate('hi', 10)).toBe('hi');
    });

    test('long string truncated', () => {
        expect(truncate('hello world', 5)).toBe('hello...');
    });

    test('null → empty string', () => {
        expect(truncate(null, 10)).toBe('');
    });

    test('empty string → empty string', () => {
        expect(truncate('', 10)).toBe('');
    });
});

describe('sanitizeUrl', () => {
    test('https URL passes', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    test('http URL passes', () => {
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    test('javascript: URL blocked', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    });

    test('data: URL blocked', () => {
        expect(sanitizeUrl('data:text/html,<h1>hi</h1>')).toBe('#');
    });

    test('null → #', () => {
        expect(sanitizeUrl(null)).toBe('#');
    });

    test('empty string → #', () => {
        expect(sanitizeUrl('')).toBe('#');
    });

    test('invalid URL → #', () => {
        expect(sanitizeUrl('not a url')).toBe('#');
    });
});

describe('bskyPostUrl', () => {
    test('converts at:// URI to web URL', () => {
        const uri = 'at://did:plc:abc123/app.bsky.feed.post/xyz789';
        expect(bskyPostUrl(uri)).toBe('https://bsky.app/profile/did:plc:abc123/post/xyz789');
    });

    test('fallback for malformed URI', () => {
        expect(bskyPostUrl('at://short')).toBe('https://bsky.app');
    });
});

describe('timeAgo', () => {
    test('< 60 seconds → just now', () => {
        const now = Date.now();
        expect(timeAgo(new Date(now - 30000).toISOString(), now)).toBe('just now');
    });

    test('5 minutes → 5m ago', () => {
        const now = Date.now();
        expect(timeAgo(new Date(now - 5 * 60000).toISOString(), now)).toBe('5m ago');
    });

    test('2 hours → 2h ago', () => {
        const now = Date.now();
        expect(timeAgo(new Date(now - 2 * 3600000).toISOString(), now)).toBe('2h ago');
    });

    test('3 days → 3d ago', () => {
        const now = Date.now();
        expect(timeAgo(new Date(now - 3 * 86400000).toISOString(), now)).toBe('3d ago');
    });
});

// =============================================
// RSS Generation
// =============================================

describe('escapeXml', () => {
    test('escapes all XML entities', () => {
        expect(escapeXml('a & b < c > d "e" \'f\'')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
    });

    test('null/empty → empty string', () => {
        expect(escapeXml(null)).toBe('');
        expect(escapeXml('')).toBe('');
    });

    test('no special chars → unchanged', () => {
        expect(escapeXml('hello world')).toBe('hello world');
    });
});

describe('buildIncidentItems', () => {
    test('builds RSS items from incidents', () => {
        const incidents = [{
            name: 'API Degraded',
            impact: 'minor',
            status: 'investigating',
            url: 'https://status.claude.com/incidents/123',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T01:00:00Z',
            updates: [{ body: 'We are investigating' }]
        }];
        const items = buildIncidentItems(incidents);
        expect(items.length).toBe(1);
        expect(items[0]).toContain('[MINOR]');
        expect(items[0]).toContain('API Degraded');
        expect(items[0]).toContain('<category>incident</category>');
        expect(items[0]).toContain('We are investigating');
    });

    test('limits to 5 incidents', () => {
        const incidents = Array.from({ length: 10 }, (_, i) => ({
            name: 'Incident ' + i,
            impact: 'minor',
            createdAt: '2025-01-01T00:00:00Z',
        }));
        expect(buildIncidentItems(incidents).length).toBe(5);
    });

    test('null/empty → empty array', () => {
        expect(buildIncidentItems(null)).toEqual([]);
        expect(buildIncidentItems([])).toEqual([]);
    });

    test('missing fields handled gracefully', () => {
        const incidents = [{ name: 'Unknown Issue', createdAt: '2025-01-01T00:00:00Z' }];
        const items = buildIncidentItems(incidents);
        expect(items.length).toBe(1);
        expect(items[0]).toContain('[INFO]'); // default impact
    });
});

describe('buildFeed', () => {
    test('produces valid RSS 2.0 structure', () => {
        const feed = buildFeed({
            title: 'Test Feed',
            description: 'A test',
            selfUrl: 'https://example.com/feed.xml',
            now: '2025-01-01T00:00:00Z',
            items: ['    <item><title>Test</title></item>']
        });
        expect(feed).toContain('<?xml version="1.0"');
        expect(feed).toContain('<rss version="2.0"');
        expect(feed).toContain('<title>Test Feed</title>');
        expect(feed).toContain('<description>A test</description>');
        expect(feed).toContain('<ttl>15</ttl>');
        expect(feed).toContain('rel="self"');
        expect(feed).toContain('</rss>');
    });

    test('escapes title and description', () => {
        const feed = buildFeed({
            title: 'Feed & More',
            description: '<bold>',
            selfUrl: 'https://example.com/feed.xml',
            now: '2025-01-01T00:00:00Z',
            items: []
        });
        expect(feed).toContain('Feed &amp; More');
        expect(feed).toContain('&lt;bold&gt;');
    });
});
