// ============================================
// Parsed — Puzzle Data & Daily Selection
// Hand-crafted puzzles for v1
// ============================================

var PUZZLES = [
    // Puzzle 0 — Rocket launch: variables are confusable (fuel/altitude/thrust all identifiers)
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"fuel",y:"id",f:0},{t:"=",y:"op",f:1},{t:"100",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"altitude",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"thrust",y:"id",f:0},{t:"=",y:"op",f:1},{t:"25",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"fuel",y:"id",f:0},{t:">",y:"op",f:1},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"altitude",y:"id",f:0},{t:"=",y:"op",f:1},{t:"altitude",y:"id",f:0},{t:"+",y:"op",f:0},{t:"thrust",y:"id",f:0}],
            [{t:"fuel",y:"id",f:0},{t:"=",y:"op",f:1},{t:"fuel",y:"id",f:0},{t:"-",y:"op",f:0},{t:"thrust",y:"id",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"altitude",y:"id",f:0}]
        ],
        goal: "\uD83D\uDE80 Burn thrust from fuel each tick. What altitude do we reach?",
        output: "100",
        shareResult: "\uD83D\uDE80 Launch successful!\nAltitude: \u2588\u2588\u2588\u2588\u2588 100m \u2705\nFuel: \u2591\u2591\u2591\u2591\u2591 empty",
        par: 5,
        difficulty: "medium",
        id: "ps001"
    },
    // Puzzle 1 — Dungeon crawler: hp/damage/rooms/armor all confusable, operators matter
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"hp",y:"id",f:0},{t:"=",y:"op",f:1},{t:"50",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"armor",y:"id",f:0},{t:"=",y:"op",f:1},{t:"5",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"damage",y:"id",f:0},{t:"=",y:"op",f:1},{t:"12",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"rooms",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"hp",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"hp",y:"id",f:0},{t:"=",y:"op",f:1},{t:"hp",y:"id",f:0},{t:"-",y:"op",f:0},{t:"damage",y:"id",f:0},{t:"+",y:"op",f:0},{t:"armor",y:"id",f:0}],
            [{t:"rooms",y:"id",f:0},{t:"=",y:"op",f:1},{t:"rooms",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"rooms",y:"id",f:0}]
        ],
        goal: "\u2694\uFE0F Each room deals damage, armor reduces it. How many rooms cleared?",
        output: "8",
        shareResult: "\u2694\uFE0F Dungeon run:\n\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\uD83D\uDEAA\nHP: \u2591\u2591\u2591\u2591\u2591 -6/50\n8 rooms cleared!",
        par: 6,
        difficulty: "hard",
        id: "ps002"
    },
    // Puzzle 2 — Potion brewing: multi-step recipe with conditionals
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"heat",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"stirs",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"potency",y:"id",f:0},{t:"=",y:"op",f:1},{t:"1",y:"lit",f:0}],
            [{t:"while",y:"kw",f:1},{t:"stirs",y:"id",f:0},{t:"<",y:"op",f:1},{t:"5",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"heat",y:"id",f:0},{t:"=",y:"op",f:1},{t:"heat",y:"id",f:0},{t:"+",y:"op",f:0},{t:"3",y:"lit",f:0}],
            [{t:"potency",y:"id",f:0},{t:"=",y:"op",f:1},{t:"potency",y:"id",f:0},{t:"*",y:"op",f:0},{t:"2",y:"lit",f:0}],
            [{t:"stirs",y:"id",f:0},{t:"=",y:"op",f:1},{t:"stirs",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"if",y:"kw",f:1},{t:"heat",y:"id",f:0},{t:">",y:"op",f:0},{t:"10",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"potency",y:"id",f:0},{t:"=",y:"op",f:1},{t:"potency",y:"id",f:0},{t:"+",y:"op",f:0},{t:"heat",y:"id",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"potency",y:"id",f:0}]
        ],
        goal: "\uD83E\uDDEA Stir 5 times (doubles potency each), add heat bonus if hot enough",
        output: "47",
        shareResult: "\uD83E\uDDEA Potion complete!\nStirs: \uD83E\uDD44\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44\nHeat: \u2588\u2588\u2588\u2588\u2588\u2588 15\u00B0\nPotency: 47 \u2728",
        par: 6,
        difficulty: "hard",
        id: "ps003"
    },
    // Puzzle 3 — Shield charge: operators and order matter (multiply vs add)
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"charge",y:"id",f:0},{t:"=",y:"op",f:1},{t:"2",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"boost",y:"id",f:0},{t:"=",y:"op",f:1},{t:"3",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"rounds",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"rounds",y:"id",f:0},{t:"<",y:"op",f:1},{t:"3",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"charge",y:"id",f:0},{t:"=",y:"op",f:1},{t:"charge",y:"id",f:0},{t:"*",y:"op",f:0},{t:"boost",y:"id",f:0}],
            [{t:"boost",y:"id",f:0},{t:"=",y:"op",f:1},{t:"boost",y:"id",f:0},{t:"-",y:"op",f:0},{t:"1",y:"lit",f:1}],
            [{t:"rounds",y:"id",f:0},{t:"=",y:"op",f:1},{t:"rounds",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"charge",y:"id",f:0}]
        ],
        goal: "\uD83D\uDEE1\uFE0F Multiply charge by boost each round, but boost decays",
        output: "12",
        shareResult: "\uD83D\uDEE1\uFE0F Shield charged!\nRound 1: 2\u00D73 = 6\nRound 2: 6\u00D72 = 12\nRound 3: 12\u00D71 = 12\n\u26A1 Power: 12",
        par: 5,
        difficulty: "medium",
        id: "ps004"
    },
    // Puzzle 4 — Treasure vault: if/else with confusable variables
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"gold",y:"id",f:0},{t:"=",y:"op",f:1},{t:"40",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"gems",y:"id",f:0},{t:"=",y:"op",f:1},{t:"7",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"bonus",y:"id",f:0},{t:"=",y:"op",f:1},{t:"gems",y:"id",f:0},{t:"*",y:"op",f:0},{t:"5",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"loot",y:"id",f:1},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"if",y:"kw",f:1},{t:"gold",y:"id",f:0},{t:">",y:"op",f:0},{t:"20",y:"lit",f:0},{t:"{",y:"pn",f:1}],
            [{t:"loot",y:"id",f:0},{t:"=",y:"op",f:1},{t:"gold",y:"id",f:0},{t:"+",y:"op",f:0},{t:"bonus",y:"id",f:0}],
            [{t:"}",y:"pn",f:1},{t:"else",y:"kw",f:1},{t:"{",y:"pn",f:1}],
            [{t:"loot",y:"id",f:0},{t:"=",y:"op",f:1},{t:"gems",y:"id",f:0},{t:"*",y:"op",f:0},{t:"2",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"loot",y:"id",f:0}]
        ],
        goal: "\uD83D\uDCB0 Rich vault (gold>20)? Take gold + gem bonus. Poor? Just gems\u00D72",
        output: "75",
        shareResult: "\uD83D\uDCB0 Vault raided!\n\uD83E\uDE99 Gold: 40 + \uD83D\uDC8E Bonus: 35\nTotal loot: 75!",
        par: 6,
        difficulty: "hard",
        id: "ps005"
    },
    // Puzzle 5 — Campfire cooking: while loop with two resources depleting differently
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"wood",y:"id",f:0},{t:"=",y:"op",f:1},{t:"10",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"food",y:"id",f:0},{t:"=",y:"op",f:1},{t:"6",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"cooked",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"wood",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"if",y:"kw",f:1},{t:"food",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"cooked",y:"id",f:0},{t:"=",y:"op",f:1},{t:"cooked",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"food",y:"id",f:0},{t:"=",y:"op",f:1},{t:"food",y:"id",f:0},{t:"-",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"wood",y:"id",f:0},{t:"=",y:"op",f:1},{t:"wood",y:"id",f:0},{t:"-",y:"op",f:0},{t:"2",y:"lit",f:0}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"cooked",y:"id",f:0}]
        ],
        goal: "\uD83D\uDD25 Burn 2 wood per tick, cook 1 food per tick (if food remains)",
        output: "5",
        shareResult: "\uD83D\uDD25 Campfire done!\n\uD83C\uDF56\uD83C\uDF56\uD83C\uDF56\uD83C\uDF56\uD83C\uDF56 cooked\n\uD83E\uDEB5 Wood: \u2591\u2591\u2591\u2591\u2591 0/10\n5 meals prepared!",
        par: 5,
        difficulty: "hard",
        id: "ps006"
    },
    // Puzzle 6 — Dragon taming: condition direction matters (> vs <), values confusable
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"trust",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"fear",y:"id",f:0},{t:"=",y:"op",f:1},{t:"10",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"days",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"fear",y:"id",f:0},{t:">",y:"op",f:0},{t:"trust",y:"id",f:0},{t:"{",y:"pn",f:1}],
            [{t:"trust",y:"id",f:0},{t:"=",y:"op",f:1},{t:"trust",y:"id",f:0},{t:"+",y:"op",f:0},{t:"3",y:"lit",f:0}],
            [{t:"fear",y:"id",f:0},{t:"=",y:"op",f:1},{t:"fear",y:"id",f:0},{t:"-",y:"op",f:0},{t:"1",y:"lit",f:0}],
            [{t:"days",y:"id",f:0},{t:"=",y:"op",f:1},{t:"days",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"days",y:"id",f:0}]
        ],
        goal: "\uD83D\uDC09 Build trust (+3/day) while fear fades (-1/day). How many days until tamed?",
        output: "3",
        shareResult: "\uD83D\uDC09 Dragon tamed!\nTrust: \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 9\nFear: \u2588\u2588\u2588\u2588\u2588\u2588\u2588 7\n3 days of patience!",
        par: 5,
        difficulty: "medium",
        id: "ps007"
    },
    // Puzzle 7 — Space navigation: multiple confusable variables + operators
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"x",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"y",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"let",y:"kw",f:1},{t:"steps",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"steps",y:"id",f:0},{t:"<",y:"op",f:1},{t:"4",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"x",y:"id",f:0},{t:"=",y:"op",f:1},{t:"x",y:"id",f:0},{t:"+",y:"op",f:0},{t:"2",y:"lit",f:0}],
            [{t:"y",y:"id",f:0},{t:"=",y:"op",f:1},{t:"y",y:"id",f:0},{t:"+",y:"op",f:0},{t:"3",y:"lit",f:0}],
            [{t:"steps",y:"id",f:0},{t:"=",y:"op",f:1},{t:"steps",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"let",y:"kw",f:1},{t:"dist",y:"id",f:1},{t:"=",y:"op",f:1},{t:"x",y:"id",f:0},{t:"+",y:"op",f:0},{t:"y",y:"id",f:0}],
            [{t:"return",y:"kw",f:1},{t:"dist",y:"id",f:1}]
        ],
        goal: "\uD83D\uDEF8 Move +2x, +3y each step for 4 steps. Total distance (x+y)?",
        output: "20",
        shareResult: "\uD83D\uDEF8 Navigation complete!\nPosition: (8, 12)\nManhattan distance: 20\n\u2B50 Star reached!",
        par: 5,
        difficulty: "medium",
        id: "ps008"
    },
    // Puzzle 8 — Encryption: variable swap + transform, hard to track mentally
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"a",y:"id",f:0},{t:"=",y:"op",f:1},{t:"7",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"b",y:"id",f:0},{t:"=",y:"op",f:1},{t:"3",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"key",y:"id",f:0},{t:"=",y:"op",f:1},{t:"a",y:"id",f:0},{t:"+",y:"op",f:0},{t:"b",y:"id",f:0}],
            [{t:"let",y:"kw",f:1},{t:"temp",y:"id",f:0},{t:"=",y:"op",f:1},{t:"a",y:"id",f:0},{t:"*",y:"op",f:0},{t:"b",y:"id",f:0}],
            [{t:"a",y:"id",f:0},{t:"=",y:"op",f:1},{t:"temp",y:"id",f:0},{t:"-",y:"op",f:0},{t:"key",y:"id",f:0}],
            [{t:"b",y:"id",f:0},{t:"=",y:"op",f:1},{t:"temp",y:"id",f:0},{t:"+",y:"op",f:0},{t:"key",y:"id",f:0}],
            [{t:"return",y:"kw",f:1},{t:"a",y:"id",f:0},{t:"+",y:"op",f:0},{t:"b",y:"id",f:0}]
        ],
        goal: "\uD83D\uDD10 Encrypt: key=a+b, temp=a*b. Then transform a and b. What's a+b?",
        output: "42",
        shareResult: "\uD83D\uDD10 Encrypted!\na=7, b=3 \u2192 key=10, temp=21\na\u219211, b\u219231\nCipher: 42",
        par: 6,
        difficulty: "hard",
        id: "ps009"
    },
    // Puzzle 9 — Boss fight: multi-phase with condition flips
    {
        lines: [
            [{t:"let",y:"kw",f:1},{t:"boss",y:"id",f:0},{t:"=",y:"op",f:1},{t:"30",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"hero",y:"id",f:0},{t:"=",y:"op",f:1},{t:"20",y:"lit",f:0}],
            [{t:"let",y:"kw",f:1},{t:"turns",y:"id",f:0},{t:"=",y:"op",f:1},{t:"0",y:"lit",f:1}],
            [{t:"while",y:"kw",f:1},{t:"boss",y:"id",f:0},{t:">",y:"op",f:0},{t:"0",y:"lit",f:1},{t:"{",y:"pn",f:1}],
            [{t:"boss",y:"id",f:0},{t:"=",y:"op",f:1},{t:"boss",y:"id",f:0},{t:"-",y:"op",f:0},{t:"hero",y:"id",f:0}],
            [{t:"hero",y:"id",f:0},{t:"=",y:"op",f:1},{t:"hero",y:"id",f:0},{t:"-",y:"op",f:0},{t:"5",y:"lit",f:0}],
            [{t:"turns",y:"id",f:0},{t:"=",y:"op",f:1},{t:"turns",y:"id",f:0},{t:"+",y:"op",f:1},{t:"1",y:"lit",f:1}],
            [{t:"}",y:"pn",f:1}],
            [{t:"return",y:"kw",f:1},{t:"turns",y:"id",f:0}]
        ],
        goal: "\uD83D\uDC7E Hero attacks boss each turn, but hero weakens by 5. How many turns?",
        output: "2",
        shareResult: "\uD83D\uDC7E Boss fight!\nTurn 1: \u2694\uFE0F 20 dmg \u2192 Boss: 10hp\nTurn 2: \u2694\uFE0F 15 dmg \u2192 Boss: \u2620\uFE0F\nVictory in 2 turns!",
        par: 5,
        difficulty: "hard",
        id: "ps010"
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
