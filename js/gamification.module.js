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
    "card-collector":   { title: "Card Collector",   desc: "Flipped a card",                   hint: "There's something on the back...",       icon: "\uD83C\uDCCF" },
    "pixel-walker":     { title: "Pixel Walker",     desc: "Used keyboard navigation",         hint: "Try the arrow keys...",                  icon: "\u2328\uFE0F" },
    curious:            { title: "Curious",          desc: "Clicked an external link",         hint: "Follow a link to the outside...",        icon: "\uD83D\uDD0D" },
    "night-owl":        { title: "Night Owl",        desc: "Visited after 10 PM",              hint: "Come back when the moon is out...",      icon: "\uD83C\uDF19" },
    "deep-diver":       { title: "Deep Diver",       desc: "Visited a project detail page",    hint: "Go deeper into a project...",            icon: "\uD83E\uDD3F" },
    "social-butterfly": { title: "Social Butterfly", desc: "Clicked a social profile link",    hint: "Connect on social media...",             icon: "\uD83E\uDD8B" },
    "player-one":       { title: "Player One",       desc: "Visited the Play section",         hint: "Ready Player One...",                    icon: "\uD83C\uDFAE" },
    commander:          { title: "Commander",        desc: "Met the commander",                hint: "Step into the command zone...",          icon: "\uD83D\uDC51" },
    "first-draw":       { title: "Starter Deck",     desc: "Opened your first deck",           hint: "Visit Work or Personal...",              icon: "\uD83C\uDFB4" },
    "full-hand":        { title: "Set Mastery",      desc: "Opened every deck in a section",   hint: "Play every deck in Work or Personal...", icon: "\u270B" }
};

var SECTIONS = ["home", "about", "work", "personal", "play"];

// Work and Personal deck (hand-card) IDs, grouped
var WORK_DECKS = ["w-blizzard", "w-mw", "w-sega", "w-trigger", "w-stb"];
var PERSONAL_DECKS = ["pp-fc", "pp-wh", "pp-ai", "pp-web", "pp-col"];
var ALL_TABS = WORK_DECKS.concat(PERSONAL_DECKS);

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

    // Cabinet Crawler: visited all sections
    if (sections.length >= SECTIONS.length) {
        achievements.push("cabinet-crawler");
    }

    // Player One: visited the play section
    if (section === "play") {
        achievements.push("player-one");
    }

    // Commander: visited the About section
    if (section === "about") {
        achievements.push("commander");
    }

    // Starter Deck: visiting Work or Personal opens a deck automatically
    if (section === "work" || section === "personal") {
        achievements.push("first-draw");
    }

    return { sectionsToSave: sections, achievementsToUnlock: achievements };
}

/**
 * Check if any single "section" (Work OR Personal) has had all its decks opened.
 * @param {string[]} clickedTabs - tab/deck IDs clicked so far
 * @returns {boolean}
 */
function checkFullHand(clickedTabs) {
    var workComplete = WORK_DECKS.every(function(id) { return clickedTabs.indexOf(id) !== -1; });
    var personalComplete = PERSONAL_DECKS.every(function(id) { return clickedTabs.indexOf(id) !== -1; });
    return workComplete || personalComplete;
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
    WORK_DECKS,
    PERSONAL_DECKS,
    getJSON,
    setJSON,
    unlockAchievement,
    processSectionVisit,
    checkFullHand,
    checkSectionComplete,
    checkCardCollector,
    checkNightOwl,
    calculateProgress,
};
