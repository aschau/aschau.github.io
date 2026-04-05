// ============================================
// Misery Index — Testable Logic
// Pure functions extracted from app.js and fetch-misery-data.js
// for unit testing. Browser/Node code keeps its own copies
// inside their respective IIFEs/scripts.
// ============================================

'use strict';

// ── Levels ────────────────────────────────────────────────

var LEVELS = [
    { max: 1,  key: 'calm',       label: 'ALL CLEAR',        dot: 'operational' },
    { max: 3,  key: 'mild',       label: 'MINOR GRUMBLING',  dot: 'operational' },
    { max: 6,  key: 'moderate',   label: 'GROWING UNREST',   dot: 'degraded'    },
    { max: 8,  key: 'severe',     label: 'FULL MELTDOWN',    dot: 'major'       },
    { max: 10, key: 'apocalypse', label: 'APOCALYPSE',       dot: 'major'       }
];

function getLevel(index) {
    for (var i = 0; i < LEVELS.length; i++) {
        if (index <= LEVELS[i].max) return LEVELS[i];
    }
    return LEVELS[LEVELS.length - 1];
}

// ── Backend score calculation (from fetch-misery-data.js) ──

var REDDIT_STALE_MS = 30 * 60 * 1000;

function calculateMisery(statusData, bskyPosts, bskyComments, redditData, nowMs) {
    var statusScore = 0;
    var redditScore = 0;
    var bskyScore = 0;
    var bskyReplyScore = 0;
    var now = nowMs || Date.now();

    if (statusData && statusData.status) {
        var indicator = statusData.status.indicator;
        if (indicator === 'minor') statusScore += 2;
        else if (indicator === 'major') statusScore += 4;
        else if (indicator === 'critical') statusScore += 6;

        if (statusData.components) {
            var badComponents = statusData.components.filter(function (c) {
                return c.status !== 'operational';
            });
            statusScore += Math.min(badComponents.length * 0.5, 2);
        }
    }

    var redditOutageScore = 0;
    var redditUsageScore = 0;
    if (redditData && redditData.lastFetched) {
        var redditAge = now - new Date(redditData.lastFetched).getTime();
        if (redditAge < REDDIT_STALE_MS) {
            var megathreads = (redditData.topPosts || []).filter(function (p) { return p.isMegathread; }).length;
            var rPosts = (redditData.recentPosts || 0) + (megathreads * 4);
            if (rPosts >= 30) redditScore = 5;
            else if (rPosts >= 20) redditScore = 4;
            else if (rPosts >= 10) redditScore = 3;
            else if (rPosts >= 5) redditScore = 2;
            else if (rPosts >= 3) redditScore = 1;
            else if (rPosts >= 1) redditScore = 0.5;

            var outageN = redditData.outagePosts || 0;
            var usageN = redditData.usagePosts || 0;
            var totalN = outageN + usageN;
            if (totalN > 0) {
                redditOutageScore = Math.round(redditScore * (outageN / totalN) * 10) / 10;
                redditUsageScore = Math.round(redditScore * (usageN / totalN) * 10) / 10;
            } else {
                redditOutageScore = redditScore;
            }
        }
    }

    if (bskyPosts >= 30) bskyScore = 2;
    else if (bskyPosts >= 15) bskyScore = 1.5;
    else if (bskyPosts >= 5) bskyScore = 1;
    else if (bskyPosts >= 1) bskyScore = 0.5;

    if (bskyComments >= 75) bskyReplyScore = 1;
    else if (bskyComments >= 30) bskyReplyScore = 0.5;

    var total = Math.min(Math.round((statusScore + bskyScore + bskyReplyScore + redditScore) * 10) / 10, 10);

    return {
        total: total,
        breakdown: {
            status: statusScore,
            bluesky: bskyScore + bskyReplyScore,
            redditOutage: redditOutageScore,
            redditUsage: redditUsageScore
        }
    };
}

// ── Frontend breakdown (from app.js) ───────────────────────

function computeBreakdown(data, sourceFilter) {
    var statusScore = 0;
    var bskyScore = 0;
    var redditOutageScore = 0;
    var redditUsageScore = 0;

    if (data.status && data.status.status) {
        var ind = data.status.status.indicator;
        if (ind === 'minor') statusScore += 2;
        else if (ind === 'major') statusScore += 4;
        else if (ind === 'critical') statusScore += 6;
        if (data.status.components) {
            var bad = data.status.components.filter(function (c) {
                return c.status !== 'operational' &&
                    c.name !== 'Visit https://status.claude.com for more information';
            });
            statusScore += Math.min(bad.length * 0.5, 2);
        }
    }

    if (sourceFilter !== 'official') {
        var bskyPosts = data.social ? data.social.recentPosts : 0;
        var bskyComments = data.social ? data.social.recentComments : 0;
        if (bskyPosts >= 30) bskyScore += 2;
        else if (bskyPosts >= 15) bskyScore += 1.5;
        else if (bskyPosts >= 5) bskyScore += 1;
        else if (bskyPosts >= 1) bskyScore += 0.5;
        if (bskyComments >= 75) bskyScore += 1;
        else if (bskyComments >= 30) bskyScore += 0.5;

        if (data.reddit && data.reddit.lastFetched) {
            var megas = (data.reddit.topPosts || []).filter(function (p) { return p.isMegathread; }).length;
            var rPosts = (data.reddit.recentPosts || 0) + (megas * 4);
            var redditTotal = 0;
            if (rPosts >= 30) redditTotal = 5;
            else if (rPosts >= 20) redditTotal = 4;
            else if (rPosts >= 10) redditTotal = 3;
            else if (rPosts >= 5) redditTotal = 2;
            else if (rPosts >= 3) redditTotal = 1;
            else if (rPosts >= 1) redditTotal = 0.5;

            var outageN = data.reddit.outagePosts || 0;
            var usageN = data.reddit.usagePosts || 0;
            var totalN = outageN + usageN;
            if (totalN > 0) {
                redditOutageScore = Math.round(redditTotal * (outageN / totalN) * 10) / 10;
                redditUsageScore = Math.round(redditTotal * (usageN / totalN) * 10) / 10;
            } else {
                redditOutageScore = redditTotal;
            }
        }
    }

    var bskyOutageScore = bskyScore;
    var bskyUsageScore = 0;
    if (bskyScore > 0 && data.social && data.social.topPosts) {
        var bskyOutN = 0, bskyUsN = 0;
        data.social.topPosts.forEach(function (p) {
            if (p.category === 'usage') bskyUsN++;
            else bskyOutN++;
        });
        var bskyTotN = bskyOutN + bskyUsN;
        if (bskyTotN > 0 && bskyUsN > 0) {
            bskyOutageScore = Math.round(bskyScore * (bskyOutN / bskyTotN) * 10) / 10;
            bskyUsageScore = Math.round(bskyScore * (bskyUsN / bskyTotN) * 10) / 10;
        }
    }

    var totalOutage = redditOutageScore + bskyOutageScore;
    var totalUsage = redditUsageScore + bskyUsageScore;

    return {
        status: statusScore,
        bluesky: bskyScore,
        reddit: redditOutageScore + redditUsageScore,
        outage: totalOutage,
        usage: totalUsage
    };
}

// ── Post classification (from fetch-misery-data.js) ────────

var STRONG_OUTAGE = [
    'is down', 'went down', 'goes down', 'going down',
    'outage', 'not working',
    "can't use", 'cant use', "won't work", "doesn't work", 'stopped working',
    'keeps crashing', 'keeps failing',
    'overloaded', '500 error', '502', '503', '504',
    'please fix', 'is it just me'
];

var USAGE_SIGNALS = [
    'rate limit', 'token limit', 'usage limit', 'message limit',
    'limit reached', 'hit the limit', 'hit my limit', 'out of messages',
    'throttl', 'capped', 'usage cap', 'daily limit', 'pro limit',
    'token usage', 'burning my usage', 'burning usage', 'save token',
    'burn through token', 'eating my token', 'eating token',
    'wasting token', 'draining token', 'token drain'
];

var WEAK_OUTAGE = [
    'unavailable', 'degraded', 'so slow', 'broken',
    'nerfed', 'bug', 'buggy', 'unusable'
];

var EXCLUSIONS = [
    'was down', 'were down', 'was broken', 'was unusable',
    'remember when', 'last week', 'last month', 'yesterday',
    'used to be', 'months ago', 'back when',
    'fixed the bug', 'fixed a bug', 'found the bug', 'helped me',
    'love claude', 'claude is great', 'claude is amazing',
    'impressed', 'works great', 'working great', 'working well',
    'back up', 'is back', 'working again', 'resolved',
    'addicted', 'withdrawal', 'forgot how to code', 'lost without',
    "can't code without", 'dependent on', 'dependency on',
    'switched to', 'switching to', 'going back to', 'gave up on',
    'switched from', 'moved to',
    'worse than', 'better than', 'compared to',
    'sucks', 'terrible', 'garbage', 'useless'
];

var AI_CONTEXT = [
    'ai', 'api', 'llm', 'chatbot', 'model', 'token', 'prompt', 'code',
    'coding', 'sonnet', 'opus', 'haiku', 'anthropic', 'claude.ai', 'cursor',
    'copilot', 'chatgpt', 'openai', 'gemini', 'developer', 'programming',
    'vibe cod', 'agentic', 'context window', 'rate limit', 'usage limit'
];

var FRUSTRATION_RE = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful|ridiculous|forcing|ruining|unusable|unbearable|fed up|absurd|insane|unacceptable|rethink|give up|giving up)\b/i;

function hasSignalNearby(text, signals, radius) {
    return signals.some(function (w) {
        var idx = text.indexOf(w);
        while (idx !== -1) {
            var nearby = text.substring(Math.max(0, idx - radius), idx + w.length + radius);
            if (nearby.includes('claude') || nearby.includes('anthropic')) return true;
            idx = text.indexOf(w, idx + 1);
        }
        return false;
    });
}

function isExcludedPost(text) {
    return EXCLUSIONS.some(function (w) {
        var idx = text.indexOf(w);
        while (idx !== -1) {
            var nearby = text.substring(Math.max(0, idx - 60), idx + w.length + 60);
            if (nearby.includes('claude') || nearby.includes('anthropic')) return true;
            idx = text.indexOf(w, idx + 1);
        }
        return false;
    });
}

function hasAiContext(text) {
    return AI_CONTEXT.some(function (w) { return text.includes(w); });
}

/**
 * Classify a post's text into a category.
 * @param {string} text - lowercased post text
 * @param {number} likeCount - post likes/upvotes
 * @returns {string|false} 'outage', 'usage', or false (rejected)
 */
function classifyPost(text, likeCount) {
    var hasClaude = text.includes('claude');
    var hasAnthropic = text.includes('anthropic');
    if (!hasClaude && !hasAnthropic) return false;

    if (hasClaude && !hasAnthropic) {
        if (!hasAiContext(text)) return false;
    }

    if (isExcludedPost(text)) return false;

    var hasFrustration = FRUSTRATION_RE.test(text);
    var category = false;

    if (hasSignalNearby(text, STRONG_OUTAGE, 80)) {
        category = 'outage';
    } else if (hasSignalNearby(text, USAGE_SIGNALS, 80)) {
        var usageCount = USAGE_SIGNALS.filter(function (w) { return text.includes(w); }).length;
        if (usageCount >= 2 || hasFrustration || (likeCount || 0) >= 5) category = 'usage';
    }

    if (!category && hasSignalNearby(text, WEAK_OUTAGE, 80)) {
        var weakCount = WEAK_OUTAGE.filter(function (w) { return text.includes(w); }).length;
        if (weakCount >= 2 || hasFrustration) category = 'outage';
    }

    return category;
}

// ── Utilities ──────────────────────────────────────────────

function truncateText(text, len) {
    var clean = text.replace(/\n+/g, ' ').trim();
    if (clean.length <= len) return clean;
    return clean.substring(0, len) + '...';
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function sanitizeUrl(url) {
    if (!url) return '#';
    try {
        var parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
    } catch (e) { /* invalid URL */ }
    return '#';
}

function bskyPostUrl(uri) {
    var parts = uri.replace('at://', '').split('/');
    if (parts.length >= 3) {
        return 'https://bsky.app/profile/' + parts[0] + '/post/' + parts[2];
    }
    return 'https://bsky.app';
}

function timeAgo(isoString, nowMs) {
    var diff = ((nowMs || Date.now()) - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

// ── RSS helpers (from fetch-misery-data.js) ────────────────

function escapeXml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildIncidentItems(incidents) {
    var items = [];
    (incidents || []).slice(0, 5).forEach(function (inc) {
        var incDate = inc.updatedAt || inc.createdAt;
        items.push(
            '    <item>\n' +
            '      <title>[' + escapeXml((inc.impact || 'info').toUpperCase()) + '] ' + escapeXml(inc.name) + '</title>\n' +
            '      <link>' + escapeXml(inc.url || 'https://status.claude.com') + '</link>\n' +
            '      <guid isPermaLink="false">incident-' + escapeXml(inc.url || inc.name) + '</guid>\n' +
            '      <pubDate>' + new Date(incDate).toUTCString() + '</pubDate>\n' +
            '      <description>' + escapeXml(
                'Status: ' + (inc.status || 'unknown') + '. Impact: ' + (inc.impact || 'none') + '.' +
                (inc.updates && inc.updates[0] ? ' Latest: ' + inc.updates[0].body : '')
            ) + '</description>\n' +
            '      <category>incident</category>\n' +
            '    </item>'
        );
    });
    return items;
}

function buildFeed(opts) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
        '  <channel>\n' +
        '    <title>' + escapeXml(opts.title) + '</title>\n' +
        '    <link>https://www.raggedydoc.com/tools/misery-index/</link>\n' +
        '    <description>' + escapeXml(opts.description) + '</description>\n' +
        '    <language>en-us</language>\n' +
        '    <lastBuildDate>' + new Date(opts.now).toUTCString() + '</lastBuildDate>\n' +
        '    <ttl>15</ttl>\n' +
        '    <atom:link href="' + opts.selfUrl + '" rel="self" type="application/rss+xml"/>\n' +
        '    <image>\n' +
        '      <url>https://www.raggedydoc.com/tools/misery-index/favicon.png</url>\n' +
        '      <title>' + escapeXml(opts.title) + '</title>\n' +
        '      <link>https://www.raggedydoc.com/tools/misery-index/</link>\n' +
        '    </image>\n' +
        opts.items.join('\n') + '\n' +
        '  </channel>\n' +
        '</rss>\n';
}

module.exports = {
    LEVELS,
    REDDIT_STALE_MS,
    getLevel,
    calculateMisery,
    computeBreakdown,
    STRONG_OUTAGE,
    USAGE_SIGNALS,
    WEAK_OUTAGE,
    EXCLUSIONS,
    AI_CONTEXT,
    FRUSTRATION_RE,
    hasSignalNearby,
    isExcludedPost,
    hasAiContext,
    classifyPost,
    truncateText,
    truncate,
    sanitizeUrl,
    bskyPostUrl,
    timeAgo,
    escapeXml,
    buildIncidentItems,
    buildFeed,
};
