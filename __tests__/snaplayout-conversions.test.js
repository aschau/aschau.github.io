const {
    CONVERSIONS,
    formatDimensions,
    inchesToDisplay,
    areaToDisplay,
    pxToInches,
    inchesToPx,
} = require('../tools/snaplayout/conversions.module');

// =============================================
// CONVERSIONS table round-trips
// =============================================

describe('CONVERSIONS round-trips', () => {
    test('feet: 12 inches = 1 foot', () => {
        expect(CONVERSIONS.ft.fromInches(12)).toBe(1);
        expect(CONVERSIONS.ft.toInches(1)).toBe(12);
    });

    test('inches: identity', () => {
        expect(CONVERSIONS.in.fromInches(42)).toBe(42);
        expect(CONVERSIONS.in.toInches(42)).toBe(42);
    });

    test('centimeters: 1 inch = 2.54 cm', () => {
        expect(CONVERSIONS.cm.fromInches(1)).toBeCloseTo(2.54);
        expect(CONVERSIONS.cm.toInches(2.54)).toBeCloseTo(1);
    });

    test('meters: 1 inch = 0.0254 m', () => {
        expect(CONVERSIONS.m.fromInches(1)).toBeCloseTo(0.0254);
        expect(CONVERSIONS.m.toInches(0.0254)).toBeCloseTo(1);
    });

    test('round-trip: convert to unit and back gives original value', () => {
        const testValue = 36; // inches
        for (const unit of ['ft', 'in', 'cm', 'm']) {
            const c = CONVERSIONS[unit];
            expect(c.toInches(c.fromInches(testValue))).toBeCloseTo(testValue);
        }
    });

    test('known values: 72 inches = 6 feet = 182.88 cm = 1.8288 m', () => {
        expect(CONVERSIONS.ft.fromInches(72)).toBeCloseTo(6);
        expect(CONVERSIONS.cm.fromInches(72)).toBeCloseTo(182.88);
        expect(CONVERSIONS.m.fromInches(72)).toBeCloseTo(1.8288);
    });
});

// =============================================
// formatDimensions
// =============================================

describe('formatDimensions', () => {
    test('feet: 1 decimal place', () => {
        const result = formatDimensions(120, 96, 'ft');
        expect(result).toBe('10.0 \u00d7 8.0 ft');
    });

    test('inches: rounded to integer', () => {
        const result = formatDimensions(36, 48, 'in');
        expect(result).toBe('36 \u00d7 48 in');
    });

    test('centimeters: 1 decimal place', () => {
        const result = formatDimensions(12, 12, 'cm');
        // 12 in = 30.48 cm
        expect(result).toBe('30.5 \u00d7 30.5 cm');
    });

    test('meters: 2 decimal places', () => {
        const result = formatDimensions(120, 120, 'm');
        // 120 in = 3.048 m
        expect(result).toBe('3.05 \u00d7 3.05 m');
    });
});

// =============================================
// inchesToDisplay
// =============================================

describe('inchesToDisplay', () => {
    test('feet display', () => {
        expect(inchesToDisplay(36, 'ft')).toBe('3.0 ft');
    });

    test('inches display (rounded)', () => {
        expect(inchesToDisplay(36.7, 'in')).toBe('37 in');
    });

    test('cm display', () => {
        expect(inchesToDisplay(10, 'cm')).toBe('25.4 cm');
    });

    test('meters display', () => {
        expect(inchesToDisplay(100, 'm')).toBe('2.54 m');
    });
});

// =============================================
// areaToDisplay
// =============================================

describe('areaToDisplay', () => {
    test('sq ft: 144 sq inches = 1 sq ft', () => {
        expect(areaToDisplay(144, 'ft')).toBe('1 sq ft');
    });

    test('sq in: identity', () => {
        expect(areaToDisplay(100, 'in')).toBe('100 sq in');
    });

    test('sq cm: 1 sq inch = 6.4516 sq cm', () => {
        const result = areaToDisplay(1, 'cm');
        expect(result).toBe('6 sq cm');
    });

    test('sq m: larger area', () => {
        // 10000 sq inches = 10000 * 0.00064516 = 6.4516 sq m
        const result = areaToDisplay(10000, 'm');
        expect(result).toBe('6.5 sq m');
    });

    test('sq ft: typical room (12x10 ft = 120 sq ft)', () => {
        // 12*10 ft = 144*12 * 120*12... actually: 12ft * 10ft = 17280 sq in
        const sqInches = 144 * 10 * 12; // 17280
        expect(areaToDisplay(sqInches, 'ft')).toBe('120 sq ft');
    });
});

// =============================================
// pxToInches / inchesToPx
// =============================================

describe('px/inches conversion', () => {
    test('pxToInches with default PPI', () => {
        expect(pxToInches(100, 4)).toBe(25);
    });

    test('inchesToPx with default PPI', () => {
        expect(inchesToPx(25, 4)).toBe(100);
    });

    test('round-trip: px → inches → px', () => {
        const ppi = 4;
        expect(inchesToPx(pxToInches(200, ppi), ppi)).toBe(200);
    });

    test('different PPI values', () => {
        expect(pxToInches(100, 10)).toBe(10);
        expect(inchesToPx(10, 10)).toBe(100);
    });
});
