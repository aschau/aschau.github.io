// ============================================
// SnapLayout — Testable Conversion Logic
// Pure functions extracted from app.js for unit testing.
// Browser code (app.js) keeps its own copies inside the IIFE;
// this module is the canonical reference for tests.
// ── Keep in sync with tools/snaplayout/app.js ──
// ============================================

'use strict';

const CONVERSIONS = {
    ft: { fromInches: v => v / 12, toInches: v => v * 12, label: 'ft', areaLabel: 'sq ft', areaDiv: 144 },
    in: { fromInches: v => v, toInches: v => v, label: 'in', areaLabel: 'sq in', areaDiv: 1 },
    cm: { fromInches: v => v * 2.54, toInches: v => v / 2.54, label: 'cm', areaLabel: 'sq cm', areaDiv: 1 / 6.4516 },
    m:  { fromInches: v => v * 0.0254, toInches: v => v / 0.0254, label: 'm', areaLabel: 'sq m', areaDiv: 1 / 0.00064516 },
};

function formatDimensions(wInches, hInches, unit) {
    const c = CONVERSIONS[unit];
    const wVal = c.fromInches(wInches);
    const hVal = c.fromInches(hInches);
    const fmt = (v) => {
        if (unit === 'ft') return v.toFixed(1);
        if (unit === 'in') return Math.round(v).toString();
        if (unit === 'cm') return v.toFixed(1);
        return v.toFixed(2);
    };
    return fmt(wVal) + ' \u00d7 ' + fmt(hVal) + ' ' + unit;
}

function inchesToDisplay(inches, unit) {
    const c = CONVERSIONS[unit];
    const val = c.fromInches(inches);
    if (unit === 'ft') return val.toFixed(1) + ' ft';
    if (unit === 'in') return Math.round(val) + ' in';
    if (unit === 'cm') return val.toFixed(1) + ' cm';
    return val.toFixed(2) + ' m';
}

function areaToDisplay(sqInches, unit) {
    if (unit === 'ft') return (sqInches / 144).toFixed(0) + ' sq ft';
    if (unit === 'in') return Math.round(sqInches) + ' sq in';
    if (unit === 'cm') return (sqInches * 6.4516).toFixed(0) + ' sq cm';
    return (sqInches * 0.00064516).toFixed(1) + ' sq m';
}

function pxToInches(px, pixelsPerInch) {
    return px / pixelsPerInch;
}

function inchesToPx(inches, pixelsPerInch) {
    return inches * pixelsPerInch;
}

module.exports = {
    CONVERSIONS,
    formatDimensions,
    inchesToDisplay,
    areaToDisplay,
    pxToInches,
    inchesToPx,
};
