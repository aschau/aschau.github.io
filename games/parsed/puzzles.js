// ============================================
// Parsed — Puzzle Data & Daily Selection
// Hand-crafted puzzles for v1
// ============================================

var PUZZLES = [
    // Puzzle 0 — Easy: Unlock the door
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"key",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"door",y:"id",f:0},{t:"=",y:"op",f:1},{t:"false",y:"lit",f:0}],
            [{t:"if",y:"kw",f:1},{t:"key",y:"id",f:0},{t:"==",y:"op",f:1},{t:"true",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"door",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"door",y:"id",f:1}]
        ],
        goal: "\uD83D\uDD11 Use the key to unlock the door",
        output: "true",
        shareResult: "\uD83D\uDD11 \u2192 \uD83D\uDEAA\u2705\nDoor unlocked!",
        par: 3,
        difficulty: "easy",
        id: "hf001"
    },
    // Puzzle 1 — Easy: Brew a potion
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"herbs",y:"id",f:0},{t:"=",y:"op",f:1},{t:"3",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"water",y:"id",f:0},{t:"=",y:"op",f:1},{t:"2",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"potion",y:"id",f:1},{t:"=",y:"op",f:1},{t:"herbs",y:"id",f:0},{t:"+",y:"op",f:1},{t:"water",y:"id",f:0}],
            [{t:"return",y:"kw",f:1},{t:"potion",y:"id",f:1}]
        ],
        goal: "\uD83E\uDDEA Mix 3 herbs + 2 water to brew a potion",
        output: "5",
        shareResult: "\uD83C\uDF3F\uD83C\uDF3F\uD83C\uDF3F + \uD83D\uDCA7\uD83D\uDCA7 = \uD83E\uDDEA\nPotion brewed!",
        par: 3,
        difficulty: "easy",
        id: "hf002"
    },
    // Puzzle 2 — Easy: Pick the ripe fruit
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"ripeness",y:"id",f:1},{t:"=",y:"op",f:1},{t:"8",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"ready",y:"id",f:0},{t:"=",y:"op",f:1},{t:"false",y:"lit",f:0}],
            [{t:"if",y:"kw",f:1},{t:"ripeness",y:"id",f:0},{t:">",y:"op",f:0},{t:"5",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"ready",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"ready",y:"id",f:1}]
        ],
        goal: "\uD83C\uDF4E Pick the fruit only when it's ripe enough (> 5)",
        output: "true",
        shareResult: "\uD83C\uDF4E Ripeness: \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591 8/10\nFruit picked!",
        par: 4,
        difficulty: "easy",
        id: "hf003"
    },
    // Puzzle 3 — Medium: Launch sequence
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"fuel",y:"id",f:0},{t:"=",y:"op",f:1},{t:"100",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"altitude",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:0}],
            [{t:"while",y:"kw",f:1},{t:"fuel",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"altitude",y:"id",f:0},{t:"=",y:"op",f:1},{t:"altitude",y:"id",f:0},{t:"+",y:"op",f:1},{t:"10",y:"lit",f:1}],
            [{t:"fuel",y:"id",f:0},{t:"=",y:"op",f:1},{t:"fuel",y:"id",f:0},{t:"-",y:"op",f:0},{t:"20",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"altitude",y:"id",f:1}]
        ],
        goal: "\uD83D\uDE80 Burn fuel to reach orbit! How high can we go?",
        output: "50",
        shareResult: "\uD83D\uDE80 Launch successful!\nAltitude: \u2588\u2588\u2588\u2588\u2588 50m \u2705\nFuel: \u2591\u2591\u2591\u2591\u2591 0",
        par: 5,
        difficulty: "medium",
        id: "hf004"
    },
    // Puzzle 4 — Medium: Feed the dragon
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"hunger",y:"id",f:0},{t:"=",y:"op",f:1},{t:"5",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"snacks",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:0}],
            [{t:"while",y:"kw",f:1},{t:"hunger",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"snacks",y:"id",f:0},{t:"=",y:"op",f:1},{t:"snacks",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"hunger",y:"id",f:0},{t:"=",y:"op",f:1},{t:"hunger",y:"id",f:0},{t:"-",y:"op",f:0},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"snacks",y:"id",f:1}]
        ],
        goal: "\uD83D\uDC09 Feed snacks until the dragon isn't hungry",
        output: "5",
        shareResult: "\uD83D\uDC09 Hunger: \u2591\u2591\u2591\u2591\u2591 0/5\n\uD83C\uDF6A\uD83C\uDF6A\uD83C\uDF6A\uD83C\uDF6A\uD83C\uDF6A fed!\nDragon happy!",
        par: 5,
        difficulty: "medium",
        id: "hf005"
    },
    // Puzzle 5 — Medium: Weather check
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"temp",y:"id",f:1},{t:"=",y:"op",f:1},{t:"35",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"outfit",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:0}],
            [{t:"if",y:"kw",f:1},{t:"temp",y:"id",f:0},{t:">",y:"op",f:0},{t:"30",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"outfit",y:"id",f:0},{t:"=",y:"op",f:1},{t:"1",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1},{t:"else",y:"kw",f:1},{t:"{",y:"pn",f:1}],
            [{t:"outfit",y:"id",f:0},{t:"=",y:"op",f:1},{t:"2",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"outfit",y:"id",f:1}]
        ],
        goal: "\u2600\uFE0F Hot day? Wear shorts (1). Cold? Wear jacket (2)",
        output: "1",
        shareResult: "\u2600\uFE0F 35\u00B0 \u2014 It's hot out!\n\uD83E\uDE73 Shorts it is!",
        par: 5,
        difficulty: "medium",
        id: "hf006"
    },
    // Puzzle 6 — Medium: Treasure chest combination
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"dial_a",y:"id",f:0},{t:"=",y:"op",f:1},{t:"7",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"dial_b",y:"id",f:0},{t:"=",y:"op",f:1},{t:"3",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"combo",y:"id",f:1},{t:"=",y:"op",f:1},{t:"dial_a",y:"id",f:0},{t:"*",y:"op",f:0},{t:"dial_b",y:"id",f:0}],
            [{t:"let",y:"kw",f:1},{t:"unlocked",y:"id",f:0},{t:"=",y:"op",f:1},{t:"false",y:"lit",f:0}],
            [{t:"if",y:"kw",f:1},{t:"combo",y:"id",f:0},{t:"==",y:"op",f:0},{t:"21",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"unlocked",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"unlocked",y:"id",f:1}]
        ],
        goal: "\uD83D\uDD12 Set the dials so the combo equals 21 to open the chest",
        output: "true",
        shareResult: "\uD83D\uDD12 Dial A: 7 \u00D7 Dial B: 3 = 21\n\uD83D\uDCE6 Chest unlocked!",
        par: 5,
        difficulty: "medium",
        id: "hf007"
    },
    // Puzzle 7 — Hard: Charge the shield
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"energy",y:"id",f:0},{t:"=",y:"op",f:1},{t:"1",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"rounds",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"rounds",y:"id",f:0},{t:"<",y:"op",f:1},{t:"4",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"energy",y:"id",f:0},{t:"=",y:"op",f:1},{t:"energy",y:"id",f:0},{t:"*",y:"op",f:0},{t:"2",y:"lit",f:1}],
            [{t:"rounds",y:"id",f:0},{t:"=",y:"op",f:1},{t:"rounds",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"energy",y:"id",f:1}]
        ],
        goal: "\uD83D\uDEE1\uFE0F Double the energy each round for 4 rounds",
        output: "16",
        shareResult: "\uD83D\uDEE1\uFE0F Energy: 1\u21922\u21924\u21928\u219216\n\u26A1 Shield fully charged!",
        par: 5,
        difficulty: "hard",
        id: "hf008"
    },
    // Puzzle 8 — Easy: Light the campfire
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"wood",y:"id",f:0},{t:"=",y:"op",f:1},{t:"3",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"match",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"fire",y:"id",f:1},{t:"=",y:"op",f:1},{t:"false",y:"lit",f:1}],
            [{t:"if",y:"kw",f:1},{t:"wood",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"if",y:"kw",f:1},{t:"match",y:"id",f:0},{t:"==",y:"op",f:1},{t:"true",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"fire",y:"id",f:0},{t:"=",y:"op",f:1},{t:"true",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"fire",y:"id",f:1}]
        ],
        goal: "\uD83D\uDD25 Need wood AND a match to start the fire",
        output: "true",
        shareResult: "\uD83E\uDEB5 + \uD83E\uDE94 = \uD83D\uDD25\nCampfire lit!",
        par: 4,
        difficulty: "easy",
        id: "hf009"
    },
    // Puzzle 9 — Hard: Dungeon crawler HP
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"hp",y:"id",f:0},{t:"=",y:"op",f:1},{t:"100",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"rooms",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"hp",y:"id",f:0},{t:">",y:"op",f:0},{t:"20",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"hp",y:"id",f:0},{t:"=",y:"op",f:1},{t:"hp",y:"id",f:0},{t:"-",y:"op",f:0},{t:"15",y:"lit",f:0}],
            [{t:"rooms",y:"id",f:0},{t:"=",y:"op",f:1},{t:"rooms",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"rooms",y:"id",f:1}]
        ],
        goal: "\u2694\uFE0F Clear rooms until HP is too low. How many rooms cleared?",
        output: "6",
        shareResult: "\u2694\uFE0F Dungeon run:\n\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA \u2714\uFE0F\nHP: \u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 10/100\n6 rooms cleared!",
        par: 5,
        difficulty: "hard",
        id: "hf010"
    }
];

var LAUNCH_EPOCH = new Date('2026-03-18T00:00:00');

function getDailyPuzzleIndex() {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var epoch = new Date(LAUNCH_EPOCH);
    epoch.setHours(0, 0, 0, 0);
    var dayIndex = Math.floor((now - epoch) / 86400000);
    return ((dayIndex % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
}

function getDailyPuzzleNumber() {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var epoch = new Date(LAUNCH_EPOCH);
    epoch.setHours(0, 0, 0, 0);
    return Math.floor((now - epoch) / 86400000) + 1;
}

function getDailyPuzzle() {
    var index = getDailyPuzzleIndex();
    return JSON.parse(JSON.stringify(PUZZLES[index]));
}

function getTodayDateString() {
    return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
