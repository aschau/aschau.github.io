// ============================================
// Gamification — Testable Logic (Arcade Edition)
// Pure functions extracted from gamification.js for unit testing.
// Browser code (gamification.js) keeps its own copies inside the IIFE;
// this module is the canonical reference for tests.
// ── Keep in sync with js/gamification.js ──
// ============================================

'use strict';

var ACHIEVEMENTS = {
    "cabinet-crawler":  { title: "Cabinet Crawler",  desc: "Visited all 5 sections",           hint: "Visit every cabinet in the arcade...",   icon: "\uD83D\uDD79\uFE0F" },
    "card-collector":   { title: "Card Collector",   desc: "Flipped every card",               hint: "There's something on the back...",       icon: "\uD83C\uDCCF" },
    "tab-master":       { title: "Tab Master",       desc: "Clicked every tab",                hint: "Check every category...",                icon: "\uD83D\uDCC1" },
    "pixel-walker":     { title: "Pixel Walker",     desc: "Used keyboard navigation",         hint: "Try the arrow keys...",                  icon: "\u2328\uFE0F" },
    curious:            { title: "Curious",          desc: "Clicked an external link",         hint: "Follow a link to the outside...",        icon: "\uD83D\uDD0D" },
    "night-owl":        { title: "Night Owl",        desc: "Visited after 10 PM",              hint: "Come back when the moon is out...",      icon: "\uD83C\uDF19" },
    "deep-diver":       { title: "Deep Diver",       desc: "Visited a project detail page",    hint: "Go deeper into a project...",            icon: "\uD83E\uDD3F" },
    "social-butterfly": { title: "Social Butterfly", desc: "Clicked a social profile link",    hint: "Connect on social media...",             icon: "\uD83E\uDD8B" },
    "player-one":       { title: "Player One",       desc: "Visited the Play section",         hint: "Ready Player One...",                    icon: "\uD83C\uDFAE" }
};

var SECTIONS = ["home", "about", "work", "personal", "play"];

// All tab IDs across Work and Personal sections
var ALL_TABS = ["w-blizzard", "w-mw", "w-sega", "w-trigger", "w-stb", "pp-fc", "pp-wh", "pp-ai", "pp-web", "pp-col"];

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
 */
function unlockAchievement(storage, storageKey, id) {
    var data = getJSON(storage, storageKey, {});
    if (data[id]) return false;
    data[id] = { unlocked: true, date: new Date().toISOString() };
    setJSON(storage, storageKey, data);
    return true;
}

/**
 * Process a section visit. Returns achievements to unlock.
 * @param {string} section - section id (e.g. "work", "about")
 * @param {string[]} previouslyVisited - sections already visited
 * @returns {{ sectionsToSave: string[], achievementsToUnlock: string[] }}
 */
function processSectionVisit(section, previouslyVisited) {
    var sections = previouslyVisited.slice();
    var achievements = [];

    if (SECTIONS.indexOf(section) !== -1 && sections.indexOf(section) === -1) {
        sections.push(section);
    }

    // Cabinet Crawler: visited all 6 sections
    if (sections.length >= SECTIONS.length) {
        achievements.push("cabinet-crawler");
    }

    // Player One: visited the play section
    if (section === "play") {
        achievements.push("player-one");
    }

    return { sectionsToSave: sections, achievementsToUnlock: achievements };
}

/**
 * Check if all tabs have been clicked.
 * @param {string[]} clickedTabs - tab IDs that have been clicked
 * @returns {boolean}
 */
function checkTabMaster(clickedTabs) {
    for (var i = 0; i < ALL_TABS.length; i++) {
        if (clickedTabs.indexOf(ALL_TABS[i]) === -1) return false;
    }
    return true;
}

/**
 * Check if all flippable cards in a section have been flipped.
 * @param {number[]} flippedIndices - indices of flipped cards
 * @param {number} totalFlippable - total number of flippable cards
 * @returns {boolean}
 */
function checkSectionComplete(flippedIndices, totalFlippable) {
    if (totalFlippable <= 0) return false;
    var unique = [];
    for (var i = 0; i < flippedIndices.length; i++) {
        if (unique.indexOf(flippedIndices[i]) === -1) unique.push(flippedIndices[i]);
    }
    return unique.length >= totalFlippable;
}

/**
 * Check if ALL sections' cards have been flipped (card collector).
 * @param {object} flippedMap - { sectionId: [indices], ... }
 * @param {object} totalMap - { sectionId: totalFlippable, ... }
 * @returns {boolean}
 */
function checkCardCollector(flippedMap, totalMap) {
    var sectionIds = Object.keys(totalMap);
    for (var i = 0; i < sectionIds.length; i++) {
        var id = sectionIds[i];
        if (totalMap[id] <= 0) continue;
        if (!flippedMap[id] || !checkSectionComplete(flippedMap[id], totalMap[id])) return false;
    }
    return true;
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
 * Calculate exploration progress percentage.
 * @param {number} sectionsVisited - number of sections visited
 * @returns {number} percentage (0-100)
 */
function calculateProgress(sectionsVisited) {
    return Math.round((sectionsVisited / SECTIONS.length) * 100);
}

module.exports = {
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
};
