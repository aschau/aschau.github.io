"""Generate 30 themed puzzles for Parsed.

Each puzzle has:
- Themed variable names and scenario
- Multiple confusable movable tokens
- A correct output verified by the interpreter
- A themed shareResult for social sharing

Usage: python generate.py
Outputs: puzzles.js (overwrites existing)
"""

import json
import hashlib
import random

# ============================================
# Interpreter (matches game.js logic exactly)
# ============================================

class Interpreter:
    def __init__(self):
        self.vars = {}
        self.output = None

    def run(self, lines):
        self.vars = {}
        self.output = None
        self._exec_block(lines, 0, len(lines) - 1)
        return self.output

    def _exec_block(self, lines, start, end):
        i = start
        safety = 0
        while i <= end and safety < 500:
            safety += 1
            line = lines[i]
            if not line:
                i += 1
                continue
            if line == ['{'] or line == ['}']:
                i += 1
                continue
            if line[0] == '}' and len(line) == 1:
                i += 1
                continue
            if line[0] == '}':
                i += 1
                continue

            first = line[0]

            if first == 'let':
                var_name = line[1]
                expr = [t for t in line[3:] if t not in ('{', '}')]
                self.vars[var_name] = self._eval_expr(expr)
                i += 1
            elif first == 'return':
                self.output = self._eval_expr(line[1:])
                return
            elif first == 'while':
                block_end = self._find_block_end(lines, i)
                cond = self._get_condition(line)
                loop_count = 0
                while self._eval_condition(cond) and loop_count < 100:
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
                    loop_count += 1
                i = block_end + 1
            elif first == 'if':
                block_end = self._find_block_end(lines, i)
                cond = self._get_condition(line)
                has_else = False
                else_line = block_end
                if block_end < len(lines):
                    bl = lines[block_end]
                    if len(bl) > 1 and 'else' in bl:
                        has_else = True
                if self._eval_condition(cond):
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
                    if has_else:
                        else_end = self._find_else_end(lines, else_line)
                        i = else_end + 1
                    else:
                        i = block_end + 1
                else:
                    if has_else:
                        else_end = self._find_else_end(lines, else_line)
                        self._exec_block(lines, else_line + 1, else_end - 1)
                        if self.output is not None:
                            return
                        i = else_end + 1
                    else:
                        i = block_end + 1
            else:
                if len(line) >= 3 and line[1] == '=':
                    self.vars[line[0]] = self._eval_expr(line[2:])
                i += 1

    def _get_condition(self, line):
        tokens = []
        started = False
        for t in line:
            if t == '{':
                break
            if started:
                tokens.append(t)
            if t in ('while', 'if'):
                started = True
        return tokens

    def _eval_condition(self, tokens):
        if len(tokens) == 3:
            left = self._resolve(tokens[0])
            op = tokens[1]
            right = self._resolve(tokens[2])
            ops = {'<': lambda a,b: a<b, '>': lambda a,b: a>b, '<=': lambda a,b: a<=b,
                   '>=': lambda a,b: a>=b, '==': lambda a,b: a==b, '!=': lambda a,b: a!=b}
            return ops.get(op, lambda a,b: False)(left, right)
        return False

    def _eval_expr(self, tokens):
        if not tokens:
            return 0
        if len(tokens) == 1:
            return self._resolve(tokens[0])
        result = self._resolve(tokens[0])
        i = 1
        while i < len(tokens) - 1:
            op = tokens[i]
            right = self._resolve(tokens[i + 1])
            if op == '+': result += right
            elif op == '-': result -= right
            elif op == '*': result *= right
            elif op == '/': result = result // right if right else 0
            i += 2
        return result

    def _resolve(self, token):
        if token == 'true': return True
        if token == 'false': return False
        try: return int(token)
        except (ValueError, TypeError): pass
        return self.vars.get(token, 0)

    def _find_block_end(self, lines, start):
        depth = 0
        for i in range(start, len(lines)):
            for t in lines[i]:
                if t == '{': depth += 1
                elif t == '}':
                    depth -= 1
                    if depth == 0: return i
        return len(lines) - 1

    def _find_else_end(self, lines, else_line):
        depth = 1
        for i in range(else_line + 1, len(lines)):
            for t in lines[i]:
                if t == '{': depth += 1
                elif t == '}':
                    depth -= 1
                    if depth == 0: return i
        return len(lines) - 1


# ============================================
# Puzzle Templates
# ============================================

def T(text, typ, fixed):
    """Create a token dict."""
    return {"t": text, "y": typ, "f": 1 if fixed else 0}

def kw(text, fixed=True):
    return T(text, "kw", fixed)

def id_(text, fixed=False):
    return T(text, "id", fixed)

def op(text, fixed=True):
    return T(text, "op", fixed)

def op_m(text):
    """Movable operator."""
    return T(text, "op", False)

def lit(text, fixed=True):
    return T(text, "lit", fixed)

def lit_m(text):
    """Movable literal."""
    return T(text, "lit", False)

def pn(text):
    return T(text, "pn", True)

def id_f(text):
    """Fixed identifier."""
    return T(text, "id", True)


def make_puzzle(lines_data, goal, share_result, difficulty, seed_id):
    """Build a puzzle dict, compute output, set par."""
    # Extract token lines for interpreter
    code_lines = []
    movable_count = 0
    for line in lines_data:
        tokens = [t["t"] for t in line]
        code_lines.append(tokens)
        for t in line:
            if not t["f"]:
                movable_count += 1

    interp = Interpreter()
    output = interp.run(code_lines)
    if output is None:
        raise ValueError(f"Puzzle {seed_id} produced no output!")

    output_str = str(output).lower() if isinstance(output, bool) else str(output)

    # Par: roughly movable_count // 2 (minimum swaps for a random permutation)
    par = max(3, movable_count // 2)

    puzzle_id = hashlib.md5(seed_id.encode()).hexdigest()[:8]

    return {
        "lines": lines_data,
        "goal": goal,
        "output": output_str,
        "shareResult": share_result,
        "par": par,
        "difficulty": difficulty,
        "id": puzzle_id
    }


def generate_puzzles():
    puzzles = []

    # Helper sets for variable themes
    themes = [
        # 0: Rocket launch
        {
            "vars": {"fuel": 100, "altitude": 0, "thrust": 25},
            "lines": [
                [kw("let"), id_("fuel"), op("="), lit("100")],
                [kw("let"), id_("altitude"), op("="), lit("0")],
                [kw("let"), id_("thrust"), op("="), lit("25")],
                [kw("while"), id_("fuel"), op(">"), lit("0"), pn("{")],
                [id_("altitude"), op("="), id_("altitude"), op_m("+"), id_("thrust")],
                [id_("fuel"), op("="), id_("fuel"), op_m("-"), id_("thrust")],
                [pn("}")],
                [kw("return"), id_("altitude")],
            ],
            "goal": "\U0001F680 Burn thrust from fuel each tick. What altitude do we reach?",
            "share": "\U0001F680 Launch successful!\nAltitude: \u2588\u2588\u2588\u2588\u2588 100m \u2705\nFuel: \u2591\u2591\u2591\u2591\u2591 empty",
            "diff": "medium",
        },
        # 1: Dungeon crawler
        {
            "lines": [
                [kw("let"), id_("hp"), op("="), lit_m("50")],
                [kw("let"), id_("armor"), op("="), lit_m("5")],
                [kw("let"), id_("damage"), op("="), lit_m("12")],
                [kw("let"), id_("rooms"), op("="), lit("0")],
                [kw("while"), id_("hp"), op_m(">"), lit("0"), pn("{")],
                [id_("hp"), op("="), id_("hp"), op_m("-"), id_("damage"), op_m("+"), id_("armor")],
                [id_("rooms"), op("="), id_("rooms"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("rooms")],
            ],
            "goal": "\u2694\uFE0F Each room deals damage, armor blocks some. How many rooms?",
            "share": "\u2694\uFE0F Dungeon cleared!\n8 rooms survived",
            "diff": "hard",
        },
        # 2: Potion brewing
        {
            "lines": [
                [kw("let"), id_("heat"), op("="), lit("0")],
                [kw("let"), id_("stirs"), op("="), lit("0")],
                [kw("let"), id_("potency"), op("="), lit_m("1")],
                [kw("while"), id_("stirs"), op("<"), lit("5"), pn("{")],
                [id_("heat"), op("="), id_("heat"), op_m("+"), lit_m("3")],
                [id_("potency"), op("="), id_("potency"), op_m("*"), lit_m("2")],
                [id_("stirs"), op("="), id_("stirs"), op("+"), lit("1")],
                [pn("}")],
                [kw("if"), id_("heat"), op_m(">"), lit_m("10"), pn("{")],
                [id_("potency"), op("="), id_("potency"), op_m("+"), id_("heat")],
                [pn("}")],
                [kw("return"), id_("potency")],
            ],
            "goal": "\U0001F9EA Stir 5 times (doubles potency), add heat bonus if hot enough",
            "share": "\U0001F9EA Potion brewed!\nPotency: 47 \u2728",
            "diff": "hard",
        },
        # 3: Shield charge (boost decays)
        {
            "lines": [
                [kw("let"), id_("charge"), op("="), lit_m("2")],
                [kw("let"), id_("boost"), op("="), lit_m("3")],
                [kw("let"), id_("rounds"), op("="), lit("0")],
                [kw("while"), id_("rounds"), op("<"), lit("3"), pn("{")],
                [id_("charge"), op("="), id_("charge"), op_m("*"), id_("boost")],
                [id_("boost"), op("="), id_("boost"), op_m("-"), lit("1")],
                [id_("rounds"), op("="), id_("rounds"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("charge")],
            ],
            "goal": "\U0001F6E1\uFE0F Multiply charge by boost each round, but boost decays",
            "share": "\U0001F6E1\uFE0F Shield charged!\n2\u00D73\u00D72\u00D71 = 12\n\u26A1 Power: 12",
            "diff": "medium",
        },
        # 4: Treasure vault
        {
            "lines": [
                [kw("let"), id_("gold"), op("="), lit_m("40")],
                [kw("let"), id_("gems"), op("="), lit_m("7")],
                [kw("let"), id_("bonus"), op("="), id_("gems"), op_m("*"), lit_m("5")],
                [kw("let"), id_f("loot"), op("="), lit("0")],
                [kw("if"), id_("gold"), op_m(">"), lit_m("20"), pn("{")],
                [id_("loot"), op("="), id_("gold"), op_m("+"), id_("bonus")],
                [pn("}"), kw("else"), pn("{")],
                [id_("loot"), op("="), id_("gems"), op_m("*"), lit_m("2")],
                [pn("}")],
                [kw("return"), id_f("loot")],
            ],
            "goal": "\U0001F4B0 Rich vault? Take gold + gem bonus. Poor? Just gems\u00D72",
            "share": "\U0001F4B0 Vault raided!\nGold: 40 + Bonus: 35\nTotal loot: 75!",
            "diff": "hard",
        },
        # 5: Campfire cooking
        {
            "lines": [
                [kw("let"), id_("wood"), op("="), lit_m("10")],
                [kw("let"), id_("food"), op("="), lit_m("6")],
                [kw("let"), id_("cooked"), op("="), lit("0")],
                [kw("while"), id_("wood"), op_m(">"), lit("0"), pn("{")],
                [kw("if"), id_("food"), op_m(">"), lit("0"), pn("{")],
                [id_("cooked"), op("="), id_("cooked"), op("+"), lit("1")],
                [id_("food"), op("="), id_("food"), op("-"), lit("1")],
                [pn("}")],
                [id_("wood"), op("="), id_("wood"), op_m("-"), lit_m("2")],
                [pn("}")],
                [kw("return"), id_("cooked")],
            ],
            "goal": "\U0001F525 Burn 2 wood per tick, cook 1 food if available. How many cooked?",
            "share": "\U0001F525 Campfire done!\n\U0001F356\U0001F356\U0001F356\U0001F356\U0001F356 cooked\n5 meals prepared!",
            "diff": "hard",
        },
        # 6: Dragon taming
        {
            "lines": [
                [kw("let"), id_("trust"), op("="), lit("0")],
                [kw("let"), id_("fear"), op("="), lit_m("10")],
                [kw("let"), id_("days"), op("="), lit("0")],
                [kw("while"), id_("fear"), op_m(">"), id_("trust"), pn("{")],
                [id_("trust"), op("="), id_("trust"), op_m("+"), lit_m("3")],
                [id_("fear"), op("="), id_("fear"), op_m("-"), lit_m("1")],
                [id_("days"), op("="), id_("days"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("days")],
            ],
            "goal": "\U0001F409 Build trust (+3/day), fear fades (-1/day). Days to tame?",
            "share": "\U0001F409 Dragon tamed!\nTrust: 9, Fear: 7\n3 days of patience!",
            "diff": "medium",
        },
        # 7: Space navigation
        {
            "lines": [
                [kw("let"), id_("x"), op("="), lit("0")],
                [kw("let"), id_("y"), op("="), lit("0")],
                [kw("let"), id_("steps"), op("="), lit("0")],
                [kw("while"), id_("steps"), op("<"), lit("4"), pn("{")],
                [id_("x"), op("="), id_("x"), op_m("+"), lit_m("2")],
                [id_("y"), op("="), id_("y"), op_m("+"), lit_m("3")],
                [id_("steps"), op("="), id_("steps"), op("+"), lit("1")],
                [pn("}")],
                [kw("let"), id_f("dist"), op("="), id_("x"), op_m("+"), id_("y")],
                [kw("return"), id_f("dist")],
            ],
            "goal": "\U0001F6F8 Move +2x, +3y for 4 steps. Manhattan distance (x+y)?",
            "share": "\U0001F6F8 Navigation complete!\nPosition: (8, 12)\nDistance: 20 \u2B50",
            "diff": "medium",
        },
        # 8: Encryption
        {
            "lines": [
                [kw("let"), id_("a"), op("="), lit_m("7")],
                [kw("let"), id_("b"), op("="), lit_m("3")],
                [kw("let"), id_("key"), op("="), id_("a"), op_m("+"), id_("b")],
                [kw("let"), id_("temp"), op("="), id_("a"), op_m("*"), id_("b")],
                [id_("a"), op("="), id_("temp"), op_m("-"), id_("key")],
                [id_("b"), op("="), id_("temp"), op_m("+"), id_("key")],
                [kw("return"), id_("a"), op_m("+"), id_("b")],
            ],
            "goal": "\U0001F510 Encrypt: key=a+b, temp=a*b. Transform a and b. What's a+b?",
            "share": "\U0001F510 Encrypted!\na=11, b=31\nCipher: 42",
            "diff": "hard",
        },
        # 9: Boss fight
        {
            "lines": [
                [kw("let"), id_("boss"), op("="), lit_m("30")],
                [kw("let"), id_("hero"), op("="), lit_m("20")],
                [kw("let"), id_("turns"), op("="), lit("0")],
                [kw("while"), id_("boss"), op_m(">"), lit("0"), pn("{")],
                [id_("boss"), op("="), id_("boss"), op_m("-"), id_("hero")],
                [id_("hero"), op("="), id_("hero"), op_m("-"), lit_m("5")],
                [id_("turns"), op("="), id_("turns"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("turns")],
            ],
            "goal": "\U0001F47E Hero attacks boss, but weakens by 5 each turn. How many turns?",
            "share": "\U0001F47E Boss defeated!\nTurn 1: 20 dmg, Turn 2: 15 dmg\nVictory in 2 turns!",
            "diff": "hard",
        },
        # 10: Harvest season
        {
            "lines": [
                [kw("let"), id_("seeds"), op("="), lit_m("8")],
                [kw("let"), id_("water"), op("="), lit_m("12")],
                [kw("let"), id_("crops"), op("="), lit("0")],
                [kw("while"), id_("seeds"), op_m(">"), lit("0"), pn("{")],
                [kw("if"), id_("water"), op_m(">"), lit_m("2"), pn("{")],
                [id_("crops"), op("="), id_("crops"), op("+"), lit("1")],
                [id_("water"), op("="), id_("water"), op_m("-"), lit_m("3")],
                [pn("}")],
                [id_("seeds"), op("="), id_("seeds"), op_m("-"), lit("1")],
                [pn("}")],
                [kw("return"), id_("crops")],
            ],
            "goal": "\U0001F33E Plant seeds (need 3 water each). How many crops grow?",
            "share": "\U0001F33E Harvest complete!\n\U0001F33D\U0001F33D\U0001F33D\U0001F33D crops\nWater used: 12",
            "diff": "hard",
        },
        # 11: Fishing trip
        {
            "lines": [
                [kw("let"), id_("bait"), op("="), lit_m("6")],
                [kw("let"), id_("fish"), op("="), lit("0")],
                [kw("let"), id_("luck"), op("="), lit_m("2")],
                [kw("while"), id_("bait"), op_m(">"), lit("0"), pn("{")],
                [id_("fish"), op("="), id_("fish"), op_m("+"), id_("luck")],
                [id_("bait"), op("="), id_("bait"), op_m("-"), lit("1")],
                [pn("}")],
                [kw("return"), id_("fish")],
            ],
            "goal": "\U0001F3A3 Each bait catches 'luck' fish. How many fish total?",
            "share": "\U0001F3A3 Great catch!\n\U0001F41F \u00D7 12\n6 bait used",
            "diff": "medium",
        },
        # 12: Castle siege
        {
            "lines": [
                [kw("let"), id_("walls"), op("="), lit_m("100")],
                [kw("let"), id_("catapult"), op("="), lit_m("15")],
                [kw("let"), id_("repair"), op("="), lit_m("5")],
                [kw("let"), id_("volleys"), op("="), lit("0")],
                [kw("while"), id_("walls"), op_m(">"), lit("0"), pn("{")],
                [id_("walls"), op("="), id_("walls"), op_m("-"), id_("catapult"), op_m("+"), id_("repair")],
                [id_("volleys"), op("="), id_("volleys"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("volleys")],
            ],
            "goal": "\U0001F3F0 Catapult hits walls, defenders repair. How many volleys to breach?",
            "share": "\U0001F3F0 Castle breached!\nWalls crumbled after 10 volleys",
            "diff": "hard",
        },
        # 13: Alchemy transmute
        {
            "lines": [
                [kw("let"), id_("iron"), op("="), lit_m("16")],
                [kw("let"), id_("magic"), op("="), lit_m("4")],
                [kw("let"), id_("gold"), op("="), lit("0")],
                [kw("while"), id_("magic"), op_m(">"), lit("0"), pn("{")],
                [id_("gold"), op("="), id_("gold"), op_m("+"), id_("iron"), op_m("/"), id_("magic")],
                [id_("magic"), op("="), id_("magic"), op_m("-"), lit("1")],
                [pn("}")],
                [kw("return"), id_("gold")],
            ],
            "goal": "\u2728 Transmute iron/magic each round (magic shrinks). Total gold?",
            "share": "\u2728 Transmutation complete!\n4+5+8+16 = 33 gold \U0001FA99",
            "diff": "hard",
        },
        # 14: Race lap times
        {
            "lines": [
                [kw("let"), id_("speed"), op("="), lit_m("10")],
                [kw("let"), id_("drag"), op("="), lit_m("2")],
                [kw("let"), id_("laps"), op("="), lit("0")],
                [kw("let"), id_("distance"), op("="), lit("0")],
                [kw("while"), id_("speed"), op_m(">"), lit("0"), pn("{")],
                [id_("distance"), op("="), id_("distance"), op_m("+"), id_("speed")],
                [id_("speed"), op("="), id_("speed"), op_m("-"), id_("drag")],
                [id_("laps"), op("="), id_("laps"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("distance")],
            ],
            "goal": "\U0001F3CE\uFE0F Car decelerates by drag each lap. Total distance?",
            "share": "\U0001F3CE\uFE0F Race finished!\n10+8+6+4+2 = 30\nDistance: 30 \U0001F3C1",
            "diff": "medium",
        },
        # 15: Spell combo
        {
            "lines": [
                [kw("let"), id_("power"), op("="), lit_m("1")],
                [kw("let"), id_("mana"), op("="), lit_m("5")],
                [kw("while"), id_("mana"), op_m(">"), lit("0"), pn("{")],
                [id_("power"), op("="), id_("power"), op_m("*"), lit_m("3")],
                [id_("mana"), op("="), id_("mana"), op_m("-"), lit("1")],
                [pn("}")],
                [kw("return"), id_("power")],
            ],
            "goal": "\U0001FA84 Triple spell power for each mana spent. Final power?",
            "share": "\U0001FA84 Spell unleashed!\n1\u21923\u21929\u219227\u219281\u2192243\nPower: 243!",
            "diff": "medium",
        },
        # 16: Tower defense
        {
            "lines": [
                [kw("let"), id_("enemies"), op("="), lit_m("20")],
                [kw("let"), id_("tower"), op("="), lit_m("3")],
                [kw("let"), id_("waves"), op("="), lit("0")],
                [kw("while"), id_("enemies"), op_m(">"), lit("0"), pn("{")],
                [id_("enemies"), op("="), id_("enemies"), op_m("-"), id_("tower")],
                [id_("tower"), op("="), id_("tower"), op_m("+"), lit("1")],
                [id_("waves"), op("="), id_("waves"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("waves")],
            ],
            "goal": "\U0001F3F0 Tower gets stronger each wave (+1). Waves to clear all enemies?",
            "share": "\U0001F3F0 All enemies defeated!\n5 waves survived\nTower power: 8",
            "diff": "medium",
        },
        # 17: Savings account
        {
            "lines": [
                [kw("let"), id_("balance"), op("="), lit_m("100")],
                [kw("let"), id_("interest"), op("="), lit_m("10")],
                [kw("let"), id_("years"), op("="), lit("0")],
                [kw("while"), id_("years"), op("<"), lit_m("3"), pn("{")],
                [id_("balance"), op("="), id_("balance"), op_m("+"), id_("interest")],
                [id_("interest"), op("="), id_("interest"), op_m("+"), lit_m("5")],
                [id_("years"), op("="), id_("years"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("balance")],
            ],
            "goal": "\U0001F4B5 Interest grows by 5 each year. Balance after 3 years?",
            "share": "\U0001F4B5 Investment matured!\n100+10+15+20 = 145\nBalance: 145",
            "diff": "medium",
        },
        # 18: Forge weapon
        {
            "lines": [
                [kw("let"), id_("ore"), op("="), lit_m("50")],
                [kw("let"), id_("heat"), op("="), lit_m("10")],
                [kw("let"), id_("blade"), op("="), lit("0")],
                [kw("while"), id_("ore"), op_m(">"), lit_m("10"), pn("{")],
                [id_("blade"), op("="), id_("blade"), op_m("+"), id_("heat")],
                [id_("ore"), op("="), id_("ore"), op_m("-"), id_("heat")],
                [pn("}")],
                [kw("return"), id_("blade")],
            ],
            "goal": "\u2694\uFE0F Forge blade from ore using heat. Blade quality?",
            "share": "\u2694\uFE0F Blade forged!\nQuality: 40\nOre remaining: 10",
            "diff": "medium",
        },
        # 19: Maze solver
        {
            "lines": [
                [kw("let"), id_("pos"), op("="), lit("0")],
                [kw("let"), id_("goal"), op("="), lit_m("25")],
                [kw("let"), id_("step"), op("="), lit_m("5")],
                [kw("let"), id_("moves"), op("="), lit("0")],
                [kw("while"), id_("pos"), op_m("<"), id_("goal"), pn("{")],
                [id_("pos"), op("="), id_("pos"), op_m("+"), id_("step")],
                [id_("moves"), op("="), id_("moves"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("moves")],
            ],
            "goal": "\U0001F9E9 Step toward the goal. How many moves?",
            "share": "\U0001F9E9 Maze solved!\n5 moves to reach position 25",
            "diff": "medium",
        },
        # 20: Pirate treasure split
        {
            "lines": [
                [kw("let"), id_("total"), op("="), lit_m("120")],
                [kw("let"), id_("pirates"), op("="), lit_m("4")],
                [kw("let"), id_("captain"), op("="), id_("total"), op_m("/"), id_("pirates")],
                [kw("let"), id_("crew"), op("="), id_("total"), op_m("-"), id_("captain")],
                [kw("return"), id_("crew")],
            ],
            "goal": "\U0001F3F4\u200D\u2620\uFE0F Captain takes total/pirates. Crew gets the rest?",
            "share": "\U0001F3F4\u200D\u2620\uFE0F Treasure split!\nCaptain: 30\nCrew: 90",
            "diff": "medium",
        },
        # 21: Zombie horde
        {
            "lines": [
                [kw("let"), id_("zombies"), op("="), lit_m("2")],
                [kw("let"), id_("nights"), op("="), lit("0")],
                [kw("while"), id_("nights"), op("<"), lit_m("5"), pn("{")],
                [id_("zombies"), op("="), id_("zombies"), op_m("*"), lit_m("2")],
                [id_("nights"), op("="), id_("nights"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("zombies")],
            ],
            "goal": "\U0001F9DF Zombies double each night. How many after 5 nights?",
            "share": "\U0001F9DF Zombie apocalypse!\n2\u21924\u21928\u219216\u219232\u219264\nHorde: 64",
            "diff": "easy",
        },
        # 22: Gravity fall
        {
            "lines": [
                [kw("let"), id_("height"), op("="), lit_m("100")],
                [kw("let"), id_("velocity"), op("="), lit("0")],
                [kw("let"), id_("gravity"), op("="), lit_m("10")],
                [kw("let"), id_("ticks"), op("="), lit("0")],
                [kw("while"), id_("height"), op_m(">"), lit("0"), pn("{")],
                [id_("velocity"), op("="), id_("velocity"), op_m("+"), id_("gravity")],
                [id_("height"), op("="), id_("height"), op_m("-"), id_("velocity")],
                [id_("ticks"), op("="), id_("ticks"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("ticks")],
            ],
            "goal": "\U0001FA82 Object falls with accelerating gravity. Ticks to hit ground?",
            "share": "\U0001FA82 Impact!\nFell from 100m\n4 ticks to ground",
            "diff": "hard",
        },
        # 23: Garden gnomes
        {
            "lines": [
                [kw("let"), id_("gnomes"), op("="), lit_m("3")],
                [kw("let"), id_("flowers"), op("="), lit("0")],
                [kw("let"), id_("days"), op("="), lit("0")],
                [kw("while"), id_("days"), op("<"), lit_m("4"), pn("{")],
                [id_("flowers"), op("="), id_("flowers"), op_m("+"), id_("gnomes")],
                [id_("gnomes"), op("="), id_("gnomes"), op_m("+"), lit("1")],
                [id_("days"), op("="), id_("days"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("flowers")],
            ],
            "goal": "\U0001F33B Each gnome plants 1 flower/day, hire 1 new gnome/day. Total flowers?",
            "share": "\U0001F33B Garden blooming!\n3+4+5+6 = 18 flowers\n\U0001F33C\U0001F33C\U0001F33C",
            "diff": "medium",
        },
        # 24: Battery drain
        {
            "lines": [
                [kw("let"), id_("battery"), op("="), lit_m("100")],
                [kw("let"), id_("screen"), op("="), lit_m("8")],
                [kw("let"), id_("radio"), op("="), lit_m("2")],
                [kw("let"), id_("hours"), op("="), lit("0")],
                [kw("while"), id_("battery"), op_m(">"), lit_m("20"), pn("{")],
                [id_("battery"), op("="), id_("battery"), op_m("-"), id_("screen"), op_m("-"), id_("radio")],
                [id_("hours"), op("="), id_("hours"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("hours")],
            ],
            "goal": "\U0001F50B Screen and radio drain battery. Hours until 20% left?",
            "share": "\U0001F50B Battery died!\n8 hours of use\n\U0001FAAB empty",
            "diff": "hard",
        },
        # 25: Cookie clicker
        {
            "lines": [
                [kw("let"), id_("cookies"), op("="), lit("0")],
                [kw("let"), id_("click"), op("="), lit_m("1")],
                [kw("let"), id_("rounds"), op("="), lit("0")],
                [kw("while"), id_("rounds"), op("<"), lit_m("6"), pn("{")],
                [id_("cookies"), op("="), id_("cookies"), op_m("+"), id_("click")],
                [id_("click"), op("="), id_("click"), op_m("+"), lit_m("2")],
                [id_("rounds"), op("="), id_("rounds"), op("+"), lit("1")],
                [pn("}")],
                [kw("return"), id_("cookies")],
            ],
            "goal": "\U0001F36A Click power grows by 2 each round. Total cookies after 6?",
            "share": "\U0001F36A Cookie frenzy!\n1+3+5+7+9+11 = 36\n36 cookies!",
            "diff": "medium",
        },
        # 26: Temperature converter
        {
            "lines": [
                [kw("let"), id_("celsius"), op("="), lit_m("20")],
                [kw("let"), id_("factor"), op("="), lit_m("9")],
                [kw("let"), id_("divisor"), op("="), lit_m("5")],
                [kw("let"), id_("offset"), op("="), lit_m("32")],
                [kw("let"), id_f("fahrenheit"), op("="), id_("celsius"), op_m("*"), id_("factor"), op_m("/"), id_("divisor"), op_m("+"), id_("offset")],
                [kw("return"), id_f("fahrenheit")],
            ],
            "goal": "\U0001F321\uFE0F Convert 20\u00B0C to Fahrenheit: C*9/5+32",
            "share": "\U0001F321\uFE0F Temperature converted!\n20\u00B0C = 68\u00B0F",
            "diff": "hard",
        },
        # 27: Inventory sort
        {
            "lines": [
                [kw("let"), id_("swords"), op("="), lit_m("5")],
                [kw("let"), id_("shields"), op("="), lit_m("3")],
                [kw("let"), id_("potions"), op("="), lit_m("8")],
                [kw("let"), id_f("gear"), op("="), id_("swords"), op_m("+"), id_("shields")],
                [kw("let"), id_f("total"), op("="), id_("gear"), op_m("+"), id_("potions")],
                [kw("if"), id_("total"), op_m(">"), lit_m("10"), pn("{")],
                [kw("return"), id_("total")],
                [pn("}"), kw("else"), pn("{")],
                [kw("return"), id_("gear")],
                [pn("}")],
            ],
            "goal": "\U0001F392 Count gear (swords+shields) and total. Return total if > 10",
            "share": "\U0001F392 Inventory full!\nGear: 8, Potions: 8\nTotal: 16 items",
            "diff": "hard",
        },
        # 28: Pixel art (fill grid)
        {
            "lines": [
                [kw("let"), id_("width"), op("="), lit_m("4")],
                [kw("let"), id_("height"), op("="), lit_m("3")],
                [kw("let"), id_("pixels"), op("="), id_("width"), op_m("*"), id_("height")],
                [kw("let"), id_("colored"), op("="), id_("pixels"), op_m("-"), lit_m("2")],
                [kw("return"), id_("colored")],
            ],
            "goal": "\U0001F3A8 Canvas is width\u00D7height pixels. Color all but 2. How many colored?",
            "share": "\U0001F3A8 Art complete!\n4\u00D73 = 12 pixels\n10 colored \U0001F58C\uFE0F",
            "diff": "medium",
        },
        # 29: Music tempo
        {
            "lines": [
                [kw("let"), id_("bpm"), op("="), lit_m("120")],
                [kw("let"), id_("bars"), op("="), lit_m("8")],
                [kw("let"), id_("beats"), op("="), lit_m("4")],
                [kw("let"), id_f("total_beats"), op("="), id_("bars"), op_m("*"), id_("beats")],
                [kw("let"), id_f("seconds"), op("="), id_("total_beats"), op_m("*"), lit_m("60"), op_m("/"), id_("bpm")],
                [kw("return"), id_f("seconds")],
            ],
            "goal": "\U0001F3B5 How many seconds for 8 bars at 4 beats/bar, 120 bpm?",
            "share": "\U0001F3B5 Track finished!\n32 beats \u00D7 60 / 120\n16 seconds \U0001F3B6",
            "diff": "hard",
        },
    ]

    for i, t in enumerate(themes):
        try:
            p = make_puzzle(t["lines"], t["goal"], t["share"], t["diff"], f"parsed_{i:03d}")
            puzzles.append(p)
            print(f"Puzzle {i}: OK (output={p['output']}, movable={sum(1 for l in p['lines'] for tk in l if not tk['f'])}, par={p['par']})")
        except Exception as e:
            print(f"Puzzle {i}: FAILED - {e}")

    return puzzles


def write_puzzles_js(puzzles, filename="puzzles.js"):
    """Write puzzles to JS file."""
    lines = []
    lines.append("// ============================================")
    lines.append("// Parsed \u2014 Puzzle Data & Daily Selection")
    lines.append(f"// Auto-generated: {len(puzzles)} puzzles")
    lines.append("// ============================================")
    lines.append("")
    lines.append("var PUZZLES = " + json.dumps(puzzles, ensure_ascii=False) + ";")
    lines.append("")
    lines.append("var LAUNCH_EPOCH = new Date('2026-03-18T00:00:00');")
    lines.append("")
    lines.append("""function getDailyPuzzleIndex() {
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
}""")

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"\nWrote {len(puzzles)} puzzles to {filename}")


if __name__ == "__main__":
    puzzles = generate_puzzles()
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    write_puzzles_js(puzzles, os.path.join(script_dir, "puzzles.js"))
