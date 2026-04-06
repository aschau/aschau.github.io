// ============================================
// Gamification — Testable Logic
// Pure functions extracted from gamification.js for unit testing.
// Browser code (gamification.js) keeps its own copies inside the IIFE;
// this module is the canonical reference for tests.
// ── Keep in sync with js/gamification.js ──
// ============================================

'use strict';

var ACHIEVEMENTS = {
    explorer:     { title: "Explorer",      desc: "Visited all 4 pages",              hint: "Visit every main page...",              icon: "\uD83E\uDDED" },
    curious:      { title: "Curious",       desc: "Clicked an external link",         hint: "Follow a link to the outside...",       icon: "\uD83D\uDD0D" },
    "night-owl":  { title: "Night Owl",     desc: "Visited after 10 PM",              hint: "Come back when the moon is out...",     icon: "\uD83C\uDF19" },
    "speed-reader": { title: "Speed Reader", desc: "Scrolled to the bottom in under 10s", hint: "Reach the bottom before time runs out...", icon: "\u26A1" },
    "deep-diver":   { title: "Deep Diver",   desc: "Visited a project detail page",     hint: "Go deeper into a project...",           icon: "\uD83E\uDD3F" },
    "timeline-historian": { title: "Timeline Historian", desc: "Expanded all timeline entries", hint: "Explore every chapter of the journey...", icon: "\uD83D\uDCDC" },
    "skill-scout":  { title: "Skill Scout",  desc: "Visited the About page",           hint: "Learn more about who I am...",          icon: "\uD83C\uDFAF" },
    "social-butterfly": { title: "Social Butterfly", desc: "Clicked a social profile link", hint: "Connect on social media...",           icon: "\uD83E\uDD8B" },
    "player-one":       { title: "Player One",      desc: "Launched a web game",             hint: "Ready Player One...",                   icon: "\uD83C\uDFAE" }
};

var MAIN_PAGES = ["index.html", "aboutMe.html", "workprojects.html", "personalprojects.html", "deep-dive"];

// === Storage Helpers ===

function getJSON(storage, key, fallback) {
    try {
        var val = storage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch (e) {
        return fallback;
    }
}

function setJSON(storage, key, val) {
    try {
        storage.setItem(key, JSON.stringify(val));
    } catch (e) {}
}

// === Achievement Logic ===

/**
 * Attempt to unlock an achievement. Returns true if newly unlocked, false if already had it.
 * @param {object} storage - localStorage-like object
 * @param {string} storageKey - key for achievements in storage
 * @param {string} id - achievement id
 * @returns {boolean} true if newly unlocked
 */
function unlockAchievement(storage, storageKey, id) {
    var data = getJSON(storage, storageKey, {});
    if (data[id]) return false;
    data[id] = { unlocked: true, date: new Date().toISOString() };
    setJSON(storage, storageKey, data);
    return true;
}

/**
 * Determine which achievements should fire given a page visit.
 * Returns an array of achievement ids to unlock.
 * @param {string} page - current page filename (e.g. "aboutMe.html")
 * @param {string[]} previouslyVisited - pages already visited
 * @param {string} pathname - full window.location.pathname
 * @returns {{ pagesToSave: string[], achievementsToUnlock: string[] }}
 */
function processPageVisit(page, previouslyVisited, pathname) {
    var pages = previouslyVisited.slice(); // copy
    var achievements = [];

    // Track new page visit
    if (MAIN_PAGES.indexOf(page) !== -1 && pages.indexOf(page) === -1) {
        pages.push(page);
    }

    // Explorer: visited all 4 main pages (excluding deep-dive)
    var mainCount = 0;
    for (var i = 0; i < pages.length; i++) {
        if (pages[i] !== "deep-dive") mainCount++;
    }
    if (mainCount >= 4) {
        achievements.push("explorer");
    }

    // Skill Scout: visited aboutMe.html
    if (page === "aboutMe.html") {
        achievements.push("skill-scout");
    }

    // Deep Diver: visiting a project detail page
    if (pathname.indexOf("projects/") !== -1) {
        achievements.push("deep-diver");
        if (pages.indexOf("deep-dive") === -1) {
            pages.push("deep-dive");
        }
    }

    return { pagesToSave: pages, achievementsToUnlock: achievements };
}

/**
 * Check if night-owl achievement should fire.
 * @param {number} hour - current hour (0-23)
 * @returns {boolean}
 */
function checkNightOwl(hour) {
    return hour >= 22 || hour < 5;
}

/**
 * Check if speed-reader achievement should fire.
 * @param {number} elapsedMs - time since page load in milliseconds
 * @param {boolean} atBottom - whether user has scrolled to the bottom
 * @returns {boolean}
 */
function checkSpeedReader(elapsedMs, atBottom) {
    return atBottom && elapsedMs < 10000;
}

/**
 * Calculate exploration progress percentage.
 * @param {number} pagesVisited - number of pages visited
 * @param {number} totalPages - total number of trackable pages
 * @returns {number} percentage (0-100)
 */
function calculateProgress(pagesVisited, totalPages) {
    return Math.round((pagesVisited / totalPages) * 100);
}

/**
 * Check timeline-historian: have all entries been expanded?
 * @param {object} expandedSet - map of entry indices that have been expanded
 * @param {number} totalEntries - total number of timeline entries
 * @returns {boolean}
 */
function checkTimelineHistorian(expandedSet, totalEntries) {
    return Object.keys(expandedSet).length >= totalEntries;
}

module.exports = {
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
};
