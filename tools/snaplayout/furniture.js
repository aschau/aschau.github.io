(function () {
    'use strict';

    // All dimensions in inches (canonical unit)
    // style: 'room' = thick wall-colored border, subtle fill
    // style: 'door' = door with swing arc
    // style: 'window' = double-line wall opening
    // shape: 'circle' = renders as circle instead of rectangle
    window.FURNITURE_LIBRARY = {
        structure: {
            label: 'Structure',
            icon: '\u{1F3E0}',
            items: [
                { id: 'room-living', label: 'Living Room', w: 240, h: 192, style: 'room' },
                { id: 'room-bedroom', label: 'Bedroom', w: 168, h: 144, style: 'room' },
                { id: 'room-kitchen', label: 'Kitchen', w: 144, h: 120, style: 'room' },
                { id: 'room-bathroom', label: 'Bathroom', w: 96, h: 84, style: 'room' },
                { id: 'room-dining', label: 'Dining Room', w: 168, h: 144, style: 'room' },
                { id: 'room-office', label: 'Office', w: 132, h: 120, style: 'room' },
                { id: 'room-closet', label: 'Closet', w: 72, h: 48, style: 'room' },
                { id: 'room-hallway', label: 'Hallway', w: 144, h: 48, style: 'room' },
                { id: 'room-custom', label: 'Custom Room', w: 144, h: 120, style: 'room' },
                { id: 'door-standard', label: 'Door (36")', w: 36, h: 6, style: 'door' },
                { id: 'door-wide', label: 'Wide Door (48")', w: 48, h: 6, style: 'door' },
                { id: 'door-double', label: 'Double Door (72")', w: 72, h: 6, style: 'door' },
                { id: 'window-small', label: 'Window (24")', w: 24, h: 6, style: 'window' },
                { id: 'window-medium', label: 'Window (36")', w: 36, h: 6, style: 'window' },
                { id: 'window-large', label: 'Window (60")', w: 60, h: 6, style: 'window' }
            ]
        },
        living: {
            label: 'Living Room',
            icon: '\u{1F6CB}',
            items: [
                { id: 'couch', label: 'Couch', w: 84, h: 36 },
                { id: 'loveseat', label: 'Loveseat', w: 60, h: 36 },
                { id: 'armchair', label: 'Armchair', w: 36, h: 36 },
                { id: 'coffee-table', label: 'Coffee Table', w: 48, h: 24 },
                { id: 'tv-stand', label: 'TV Stand', w: 60, h: 18 },
                { id: 'bookshelf', label: 'Bookshelf', w: 36, h: 12 },
                { id: 'end-table', label: 'End Table', w: 24, h: 24 }
            ]
        },
        bedroom: {
            label: 'Bedroom',
            icon: '\u{1F6CF}',
            items: [
                { id: 'king-bed', label: 'King Bed', w: 80, h: 76 },
                { id: 'queen-bed', label: 'Queen Bed', w: 80, h: 60 },
                { id: 'twin-bed', label: 'Twin Bed', w: 75, h: 38 },
                { id: 'dresser', label: 'Dresser', w: 60, h: 18 },
                { id: 'nightstand', label: 'Nightstand', w: 24, h: 16 },
                { id: 'desk', label: 'Desk', w: 48, h: 24 },
                { id: 'office-chair', label: 'Office Chair', w: 24, h: 24, shape: 'circle' }
            ]
        },
        dining: {
            label: 'Dining',
            icon: '\u{1F37D}',
            items: [
                { id: 'dining-table', label: 'Dining Table', w: 72, h: 36 },
                { id: 'round-table', label: 'Round Table', w: 48, h: 48, shape: 'circle' },
                { id: 'dining-chair', label: 'Chair', w: 18, h: 18 }
            ]
        },
        kitchen: {
            label: 'Kitchen',
            icon: '\u{1F373}',
            items: [
                { id: 'fridge', label: 'Fridge', w: 36, h: 30 },
                { id: 'stove', label: 'Stove', w: 30, h: 26 },
                { id: 'dishwasher', label: 'Dishwasher', w: 24, h: 24 },
                { id: 'counter-small', label: 'Counter (S)', w: 36, h: 24 },
                { id: 'counter-large', label: 'Counter (L)', w: 60, h: 24 }
            ]
        },
        bathroom: {
            label: 'Bathroom',
            icon: '\u{1F6C1}',
            items: [
                { id: 'bathtub', label: 'Bathtub', w: 60, h: 30 },
                { id: 'toilet', label: 'Toilet', w: 28, h: 18 },
                { id: 'sink', label: 'Sink', w: 24, h: 20 },
                { id: 'vanity', label: 'Vanity', w: 48, h: 22 }
            ]
        }
    };
})();
