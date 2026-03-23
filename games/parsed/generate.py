"""Generate 365 themed puzzles for Parsed.

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
from itertools import permutations
from collections import Counter

# ============================================
# Interpreter (matches game.js logic exactly)
# ============================================

class Interpreter:
    def __init__(self):
        self.vars = {}
        self.output = None
        self.var_history = {}  # var_name -> [values] for scene config tracing

    def run(self, lines):
        self.vars = {}
        self.output = None
        self.var_history = {}
        self._exec_block(lines, 0, len(lines) - 1)
        return self.output

    def _track_var(self, name, value):
        """Record variable value for scene config min/max computation."""
        if name not in self.var_history:
            self.var_history[name] = []
        self.var_history[name].append(value)

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
                self._track_var(var_name, self.vars[var_name])
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
            elif first == 'for':
                # for i = start to end {
                var_name = line[1]
                start_val = self._resolve(line[3])
                end_val = self._resolve(line[5])
                block_end = self._find_block_end(lines, i)
                for fi in range(start_val, end_val + 1):  # inclusive
                    self.vars[var_name] = fi
                    self._track_var(var_name, fi)
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
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
                    self._track_var(line[0], self.vars[line[0]])
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
        # Standard operator precedence: * / first, then + -
        # Pass 1: resolve * and /
        resolved = [self._resolve(tokens[0])]
        i = 1
        while i < len(tokens) - 1:
            op = tokens[i]
            right = self._resolve(tokens[i + 1])
            if op in ('*', '/'):
                left = resolved[-1]
                if op == '*':
                    resolved[-1] = left * right
                else:
                    resolved[-1] = left // right if right else 0
            else:
                resolved.append(op)
                resolved.append(right)
            i += 2
        # Pass 2: resolve + and -
        result = resolved[0]
        j = 1
        while j < len(resolved) - 1:
            if resolved[j] == '+': result += resolved[j + 1]
            elif resolved[j] == '-': result -= resolved[j + 1]
            j += 2
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

def kw_to():
    """The 'to' keyword for for-loops."""
    return T("to", "kw", True)


# Maximum par by difficulty — puzzles exceeding these will have tokens
# auto-fixed to reduce swap count.  Keeps puzzles achievable while
# still allowing meaningful challenge.
MAX_PAR_MEDIUM = 12
MAX_PAR_HARD   = 15


def _hash_string_js(s):
    """Match game.js hashString."""
    h = 0
    for ch in s:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return h


def _simulate_scramble(solution_order, puzzle_id):
    """Replicate game.js seeded Fisher-Yates shuffle."""
    h = _hash_string_js(puzzle_id or 'puzzle')
    for attempt in range(100):
        seed = (h + attempt * 7919) & 0xFFFFFFFF
        state = [seed]
        def rng():
            state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
            t = state[0] ^ (state[0] >> 15)
            t = (t * (1 | state[0])) & 0xFFFFFFFF
            t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF
            t = (t ^ (t >> 14)) & 0xFFFFFFFF
            return t / 4294967296
        texts = solution_order[:]
        for i in range(len(texts) - 1, 0, -1):
            j = int(rng() * (i + 1))
            texts[i], texts[j] = texts[j], texts[i]
        if texts != solution_order:
            return texts
    return solution_order


def _count_min_swaps(scrambled, target):
    """Minimum swaps from scrambled to target, handling duplicate tokens."""
    n = len(scrambled)
    if n != len(target):
        return n
    used = [False] * n
    perm = [0] * n
    for i in range(n):
        best = -1
        for j in range(n):
            if not used[j] and scrambled[j] == target[i]:
                if j == i:
                    best = j
                    break
                if best == -1:
                    best = j
        if best == -1:
            return n
        used[best] = True
        perm[i] = best
    visited = [False] * n
    cycles = 0
    for i in range(n):
        if visited[i] or perm[i] == i:
            if not visited[i]:
                cycles += 1
                visited[i] = True
            continue
        cycles += 1
        j = i
        while not visited[j]:
            visited[j] = True
            j = perm[j]
    return n - cycles


def make_puzzle(lines_data, goal, share_result, difficulty, seed_id):
    """Build a puzzle dict, compute output, set par from actual scramble."""
    code_lines = []
    solution_order = []
    for line in lines_data:
        tokens = [t["t"] for t in line]
        code_lines.append(tokens)
        for t in line:
            if not t["f"]:
                solution_order.append(t["t"])

    interp = Interpreter()
    output = interp.run(code_lines)
    if output is None:
        raise ValueError(f"Puzzle {seed_id} produced no output!")

    output_str = str(output).lower() if isinstance(output, bool) else str(output)

    # ID is a content hash of the token layout — changes if the puzzle changes
    content_key = json.dumps(lines_data, sort_keys=True)
    puzzle_id = hashlib.md5(content_key.encode()).hexdigest()[:8]

    # Par = min_swaps + 3 so all score labels are reachable:
    # Genius (-3) = perfect solve, Hacker (-2), Optimized (-1), Compiled (par)
    if len(solution_order) >= 2:
        scrambled = _simulate_scramble(solution_order, puzzle_id)
        min_swaps = _count_min_swaps(scrambled, solution_order)
        par = max(3, min_swaps + 3)
    else:
        par = 3

    # --- Cap par by fixing excess movable tokens ---
    max_par = MAX_PAR_HARD if difficulty == "hard" else MAX_PAR_MEDIUM
    if par > max_par:
        # Build flat list of (line_idx, tok_idx) for all movable tokens
        movable = []
        for li, line in enumerate(lines_data):
            for ti, tok in enumerate(line):
                if not tok["f"]:
                    movable.append((li, ti))

        # Prioritise which tokens to fix: duplicates first (least info),
        # then literals, then operators, then identifiers (most info last).
        # Within a category, prefer tokens whose text appears most often.
        from collections import Counter
        text_counts = Counter(lines_data[li][ti]["t"] for li, ti in movable)
        cat_rank = {"lit": 0, "op": 1, "id": 2}

        def fix_priority(idx_pair):
            li, ti = idx_pair
            tok = lines_data[li][ti]
            # Higher = fix later (more interesting to keep movable)
            is_dup = 1 if text_counts[tok["t"]] > 1 else 0
            return (-is_dup, cat_rank.get(tok["y"], 3), -text_counts[tok["t"]])

        fix_order = sorted(movable, key=fix_priority)

        for li, ti in fix_order:
            if par <= max_par:
                break
            lines_data[li][ti]["f"] = 1
            # Recompute solution_order and par
            solution_order = []
            for line in lines_data:
                for t in line:
                    if not t["f"]:
                        solution_order.append(t["t"])
            if len(solution_order) >= 2:
                scrambled = _simulate_scramble(solution_order, puzzle_id)
                min_swaps = _count_min_swaps(scrambled, solution_order)
                par = max(3, min_swaps + 3)
            else:
                par = 3

    # --- Prevent loop-bypass cheats ---
    # If the return var's init is swappable AND the output value appears
    # as a swappable literal elsewhere, fix the return var's init so it
    # can't be set to the answer directly.
    return_var_name = None
    for line in lines_data:
        toks = [t["t"] for t in line]
        if toks and toks[0] == "return":
            for t in line[1:]:
                if t["y"] == "id":
                    return_var_name = t["t"]
                    break
            break
    if return_var_name:
        swappable_lits = [t["t"] for line in lines_data for t in line
                          if not t["f"] and t["y"] == "lit"]
        if output_str in swappable_lits:
            # Fix the return var's init value so it can't be swapped
            for line in lines_data:
                toks = [t["t"] for t in line]
                if (len(toks) >= 4 and toks[0] == "let"
                        and toks[1] == return_var_name and not line[3]["f"]):
                    line[3]["f"] = 1
                    # Recompute par after fixing
                    solution_order = []
                    for ln in lines_data:
                        for t in ln:
                            if not t["f"]:
                                solution_order.append(t["t"])
                    if len(solution_order) >= 2:
                        scrambled = _simulate_scramble(solution_order, puzzle_id)
                        min_swaps = _count_min_swaps(scrambled, solution_order)
                        par = max(3, min_swaps + 3)
                    else:
                        par = 3
                    break

    # Scene config: auto-derive from execution trace
    return_var = None
    for line in lines_data:
        tokens = [t["t"] for t in line]
        if tokens and tokens[0] == "return":
            for t in line[1:]:
                if t["y"] == "id":
                    return_var = t["t"]
                    break
            break

    scene = None
    if return_var and return_var in interp.var_history:
        values = interp.var_history[return_var]
        scene = {
            "emoji": goal.split(" ", 1)[0],
            "driverVar": return_var,
            "min": min(values),
            "max": max(values),
            "label": return_var.capitalize()
        }

    # --- Compute all valid outputs from literal permutations ---
    # Permute swappable numeric literals to find alternative valid
    # arrangements.  Any output from a non-erroring permutation is
    # accepted as correct — this allows multiple narrative
    # interpretations of the same puzzle.
    lit_positions = []
    for li, line in enumerate(lines_data):
        for ti, tok in enumerate(line):
            if not tok["f"] and tok["y"] == "lit":
                lit_positions.append((li, ti))

    valid_outputs = {output_str}
    if lit_positions:
        orig_values = [lines_data[li][ti]["t"] for li, ti in lit_positions]
        seen_perms = set()
        for perm in permutations(orig_values):
            if perm in seen_perms:
                continue
            seen_perms.add(perm)
            # Substitute literals
            for idx, (li, ti) in enumerate(lit_positions):
                lines_data[li][ti]["t"] = perm[idx]
            test_code = [[t["t"] for t in line] for line in lines_data]
            try:
                test_interp = Interpreter()
                result = test_interp.run(test_code)
                if result is not None:
                    # Reject if any variable went negative during execution
                    any_negative = False
                    for vname, history in test_interp.var_history.items():
                        if any(v < 0 for v in history if isinstance(v, (int, float))):
                            any_negative = True
                            break
                    if not any_negative:
                        r_str = str(result).lower() if isinstance(result, bool) else str(result)
                        valid_outputs.add(r_str)
            except Exception:
                pass
            # Restore originals
            for idx, (li, ti) in enumerate(lit_positions):
                lines_data[li][ti]["t"] = orig_values[idx]

    valid_outputs_list = sorted(valid_outputs, key=lambda x: (x != output_str, x))

    # Verify the intended solution has no variable going negative.
    # All puzzles must stay non-negative — no exceptions.
    for vname, history in interp.var_history.items():
        if any(v < 0 for v in history if isinstance(v, (int, float))):
            raise ValueError(f"Puzzle {seed_id}: {vname} goes negative in solution! Fix the values.")

    return {
        "lines": lines_data,
        "goal": goal,
        "output": output_str,
        "validOutputs": valid_outputs_list,
        "shareResult": share_result,
        "par": par,
        "difficulty": difficulty,
        "id": puzzle_id,
        "scene": scene
    }


# ============================================
# Builder functions (cfg dict -> puzzle)
# ============================================

def build_for_accum(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("+"), lit_m(str(cfg["k"]))],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_for_triangular(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("+"), id_f("i")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_for_multiply(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit("1")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("*"), lit_m(str(cfg["k"]))],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_for_if(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [kw("if"), id_f("i"), op_m(">"), lit_m(str(cfg["threshold"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("+"), id_f("i")],
        [pn("}")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_for_custom_start(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit_m(str(cfg["v_start"]))],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m(cfg["k_op"]), lit_m(str(cfg["k_val"]))],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_for_two_var(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["v2_start"]))],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(cfg["n_end"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m(cfg["vr_op"]), id_(cfg["v2"])],
        [id_(cfg["v2"]), op("="), id_(cfg["v2"]), op_m(cfg["v2_op"]), lit_m(str(cfg["v2_step"]))],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_counter(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_f("i"), op("<"), lit_m(str(cfg["limit"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("+"), id_(cfg["v1"])],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_accum(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_f("i"), op("<"), lit_m(str(cfg["limit"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op_m("+"), id_(cfg["v1"])],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m("+"), lit_m(str(cfg["step"]))],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_countdown(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("while"), id_(cfg["v1"]), op_m(">"), lit("0"), pn("{")],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m("-"), lit_m(str(cfg["step"]))],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_mul(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("while"), id_(cfg["vr"]), op("<"), lit_m(str(cfg["limit"])), pn("{")],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m("*"), lit_m(str(cfg["mul"]))],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["v1"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_two_var(cfg):
    cond_val = cfg["cond_val"]
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_(cfg["cond_v"]) if not str(cond_val).lstrip('-').isdigit() else id_f(cfg["cond_v"]),
         op_m(cfg["cond_op"]),
         id_(str(cond_val)) if not str(cond_val).lstrip('-').isdigit() else lit_m(str(cond_val)),
         pn("{")],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m(cfg["op1"]), lit_m(str(cfg["step1"])) if isinstance(cfg["step1"], int) else id_(cfg["step1"])],
        [id_(cfg["v2"]), op("="), id_(cfg["v2"]), op_m(cfg["op2"]), lit_m(str(cfg["step2"])) if isinstance(cfg["step2"], int) else id_(cfg["step2"])],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["ret_v"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_decay(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("while"), id_(cfg["v2"]), op_m(cfg["cond_op"]), lit_m(str(cfg["cond_val"])), pn("{")],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m(cfg["v1_op"]), id_(cfg["v2"])],
        [id_(cfg["v2"]), op("="), id_(cfg["v2"]), op_m(cfg["v2_op"]), lit_m(str(cfg["v2_step"]))],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["v1"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_while_if(cfg):
    """While + if inside.
    loop_cond_val and if_body_op are fixed — the loop stopping condition
    (always 0) and the if-body operator (always -) are not part of the
    puzzle.  This prevents degenerate solutions like 'depth - 0'."""
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("while"), id_(cfg["loop_cond_v"]), op_m(cfg["loop_cond_op"]), lit(str(cfg["loop_cond_val"])), pn("{")],
        [kw("if"), id_(cfg["if_v"]), op_m(cfg["if_op"]), lit_m(str(cfg["if_val"])), pn("{")],
        [id_(cfg["if_body_v"]), op("="), id_(cfg["if_body_v"]), op(cfg["if_body_op"]), lit(str(cfg["if_body_val"]))],
        [pn("}")],
        [id_(cfg["v1"]), op("="), id_(cfg["v1"]), op_m(cfg["v1_op"]), lit_m(str(cfg["v1_step"]))],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "hard"), cfg["seed"])

def build_while_if_else(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["vr"]), op("="), lit("0")],
        [kw("while"), id_(cfg["loop_v"]), op_m(cfg["loop_op"]), lit_m(str(cfg["loop_val"])), pn("{")],
        [kw("if"), id_(cfg["if_v"]), op_m(cfg["if_op"]), lit_m(str(cfg["if_val"])), pn("{")],
        [id_(cfg["true_v"]), op("="), id_(cfg["true_v"]), op_m(cfg["true_op"]), lit_m(str(cfg["true_val"]))],
        [pn("}"), kw("else"), pn("{")],
        [id_(cfg["false_v"]), op("="), id_(cfg["false_v"]), op_m(cfg["false_op"]), lit_m(str(cfg["false_val"]))],
        [pn("}")],
        [id_(cfg["dec_v"]), op("="), id_(cfg["dec_v"]), op_m(cfg["dec_op"]), lit_m(str(cfg["dec_val"]))],
        [id_(cfg["vr"]), op("="), id_(cfg["vr"]), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "hard"), cfg["seed"])

def build_if_else_simple(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_f(cfg["vr"]), op("="), lit("0")],
        [kw("if"), id_(cfg["v1"]), op_m(cfg["cmp_op"]), id_(cfg["v2"]), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["true_v"]), op_m(cfg["true_op"]), lit_m(str(cfg["true_arg"]))],
        [pn("}"), kw("else"), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["false_v"]), op_m(cfg["false_op"]), lit_m(str(cfg["false_arg"]))],
        [pn("}")],
        [kw("return"), id_f(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_if_else_calc(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["vi"]), op("="), id_(cfg["v1"]), op_m("+"), id_(cfg["v2"])],
        [kw("let"), id_f(cfg["vr"]), op("="), lit("0")],
        [kw("if"), id_(cfg["vi"]), op_m(cfg["cmp_op"]), lit_m(str(cfg["cmp_val"])), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vi"]), op_m(cfg["true_op"]), id_(cfg["v1"])],
        [pn("}"), kw("else"), pn("{")],
        [id_(cfg["vr"]), op("="), id_(cfg["vi"]), op_m(cfg["false_op"]), id_(cfg["v2"])],
        [pn("}")],
        [kw("return"), id_f(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_arith_chain3(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["v3"]), op("="), lit_m(str(cfg["n3"]))],
        [kw("let"), id_f(cfg["vr"]), op("="), id_(cfg["v1"]), op_m(cfg["op1"]), id_(cfg["v2"]), op_m(cfg["op2"]), id_(cfg["v3"])],
        [kw("return"), id_f(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])

def build_arith_multi_step(cfg):
    return make_puzzle([
        [kw("let"), id_(cfg["v1"]), op("="), lit_m(str(cfg["n1"]))],
        [kw("let"), id_(cfg["v2"]), op("="), lit_m(str(cfg["n2"]))],
        [kw("let"), id_(cfg["vi"]), op("="), id_(cfg["v1"]), op_m(cfg["op1"]), id_(cfg["v2"])],
        [kw("let"), id_(cfg["v3"]), op("="), lit_m(str(cfg["n3"]))],
        [kw("let"), id_f(cfg["vr"]), op("="), id_(cfg["vi"]), op_m(cfg["op2"]), id_(cfg["v3"])],
        [kw("return"), id_f(cfg["vr"])],
    ], cfg["emoji"] + " " + cfg["goal"], cfg["share"], cfg.get("diff", "medium"), cfg["seed"])


# ============================================
# Builder registry
# ============================================

BUILDERS = {
    "for_accum": build_for_accum,
    "for_triangular": build_for_triangular,
    "for_multiply": build_for_multiply,
    "for_if": build_for_if,
    "for_custom_start": build_for_custom_start,
    "for_two_var": build_for_two_var,
    "while_counter": build_while_counter,
    "while_accum": build_while_accum,
    "while_countdown": build_while_countdown,
    "while_mul": build_while_mul,
    "while_two_var": build_while_two_var,
    "while_decay": build_while_decay,
    "while_if": build_while_if,
    "while_if_else": build_while_if_else,
    "if_else_simple": build_if_else_simple,
    "if_else_calc": build_if_else_calc,
    "arith_chain3": build_arith_chain3,
    "arith_multi_step": build_arith_multi_step,
}


# ============================================
# Theme registry
# ============================================

THEMES = {}

def theme(name):
    def decorator(fn):
        THEMES[name] = fn
        return fn
    return decorator

def P(type_, **kw):
    """Shorthand for puzzle config."""
    kw["type"] = type_
    kw.setdefault("diff", "medium")
    return kw


# ============================================
# Themes (~22 themes, 365 puzzles total)
# ============================================

@theme("cooking")
def theme_cooking():
    return [
        P("for_accum", vr="cookies", n_end=3, k=7, emoji="\U0001F36A",
          goal="A baker makes cookies each batch. Total cookies after all batches?",
          share="\U0001F36A Baked: 21 treats!"),
        P("for_accum", vr="scoops", n_end=3, k=4, emoji="\U0001F366",
          goal="Put scoops on each sundae. Total scoops used?",
          share="\U0001F366 Scoops: 12!"),
        P("arith_multi_step", v1="eggs", n1=6, v2="milk", n2=4, vi="mix", op1="+", v3="butter", n3=3, vr="batter", op2="*", emoji="\U0001F95E",
          goal="Whisk eggs and milk together, then fold in butter. How much batter?",
          share="\U0001F95E Pancakes incoming!\n30 cups of batter ready"),
        P("arith_multi_step", v1="salt", n1=8, v2="pepper", n2=4, vi="spice", op1="*", v3="water", n3=3, vr="broth", op2="+", emoji="\U0001F372",
          goal="Grind salt and pepper into a spice blend, then dissolve in water. How rich is the broth?",
          share="\U0001F372 Broth simmering!\nRichness: 35"),
        P("while_countdown", v1="flour", n1=56, step=8, vr="pies", emoji="\U0001F967",
          goal="Use flour for each pie. How many pies baked?",
          share="\U0001F967 Pies: 7"),
        P("while_countdown", v1="dough", n1=36, step=4, vr="pastries", emoji="\U0001F950",
          goal="Use dough per pastry. Pastries baked?",
          share="\U0001F950 Pastries: 9"),
        P("while_countdown", v1="grain", n1=40, step=8, vr="loaves", emoji="\U0001F35E",
          goal="Use grain per loaf. Loaves baked?",
          share="\U0001F35E Loaves: 5"),
        P("for_triangular", vr="layers", n_end=4, emoji="\U0001F370",
          goal="Stack a layer cake: each layer thicker than the last. Total layers of frosting?",
          share="\U0001F370 Layered: 10!"),
        P("while_accum", v1="recipe", n1=3, vr="dishes", step=2, limit=4, emoji="\U0001F373",
          goal="Learn new recipes each day, getting faster over time. Total dishes after all days?",
          share="\U0001F373 Dishes: 3+5+7+9 = 24"),
        P("if_else_simple", v1="hunger", n1=30, v2="fullness", n2=20, cmp_op=">", vr="eat",
          true_v="hunger", true_op="-", true_arg=10, false_v="hunger", false_op="+", false_arg=5,
          emoji="\U0001F354", goal="Lunchtime! If still hungry, eat a full meal. Otherwise grab a snack. Hunger level?",
          share="\U0001F354 Lunch break!\nHunger: 20"),
        P("if_else_calc", v1="herbs", n1=6, v2="roots", n2=4, cmp_op=">", cmp_val=8, vr="remedy", vi="potion",
          true_op="+", false_op="-", emoji="\U0001F33F",
          goal="The healer brews a remedy. Strong enough ingredients? Add more herbs. Weak batch? Remove some roots. Potency?",
          share="\U0001F33F Remedy brewed!\nPotency measured"),
        P("while_accum", v1="appetite", n1=2, vr="food", step=1, limit=6, emoji="\U0001F354",
          goal="A growing puppy eats more each meal. How much food after all meals?",
          share="\U0001F354 Stuffed!\nFood: 27"),
        P("while_if", v1="wood", n1=10, v2="food", n2=6, vr="cooked",
          loop_cond_v="wood", loop_cond_op=">", loop_cond_val=0,
          if_v="food", if_op=">", if_val=2, if_body_v="food", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=2, emoji="\U0001F525",
          goal="Burn wood to prepare meals if food is available. Total cooked before the wood runs out?",
          share="\U0001F525 Campfire done!\nMeals prepared!", diff="hard"),
        P("for_accum", vr="servings", n_end=5, k=8, emoji="\U0001F957",
          goal="Prepare servings for each table. Total servings made?",
          share="\U0001F957 Served: 40 plates!"),
        P("while_countdown", v1="clay", n1=45, step=9, vr="pots", emoji="\U0001FAD9",
          goal="Use clay per pot. Pots made?",
          share="\U0001FAD9 Pots: 5"),
        P("arith_chain3", v1="flour", n1=3, v2="eggs", n2=2, v3="sugar", n3=4, vr="batter", op1="*", op2="+", emoji="\U0001F370",
          goal="Mix flour and eggs together, then fold in sugar. How much batter?",
          share="\U0001F370 Batter whipped!\nMixed up 10 cups"),
        P("while_if_else", v1="soil", n1=50, v2="rain", n2=12, vr="harvest",
          loop_v="soil", loop_op=">", loop_val=10,
          if_v="rain", if_op=">", if_val=4,
          true_v="harvest", true_op="+", true_val=12,
          false_v="harvest", false_op="+", false_val=2,
          dec_v="soil", dec_op="-", dec_val=8, emoji="\U0001F33E",
          goal="A farm harvests what the rain provides, but rain fades and soil depletes. What's the harvest?",
          share="\U0001F33E Season over!\nTotal harvest gathered", diff="hard"),
    ]

@theme("combat")
def theme_combat():
    return [
        P("arith_chain3", v1="attack", n1=8, v2="rage", n2=3, v3="block", n3=4, vr="damage", op1="+", op2="-", emoji="\u2694\uFE0F",
          goal="A warrior's attack is boosted by rage, but the enemy blocks. How much damage lands?",
          share="\u2694\uFE0F Critical hit!\n8 + 3 rage - 4 blocked = 7 damage"),
        P("arith_multi_step", v1="atk", n1=12, v2="def", n2=4, vi="raw", op1="-", v3="crit", n3=3, vr="damage", op2="*", emoji="\U0001F4A5",
          goal="Attack power minus enemy defense, then land a critical hit. Total damage?",
          share="\U0001F4A5 Critical strike!\n24 damage dealt"),
        P("if_else_simple", v1="strength", n1=15, v2="threshold", n2=10, cmp_op=">", vr="power",
          true_v="strength", true_op="+", true_arg=5, false_v="strength", false_op="-", false_arg=3,
          emoji="\U0001F4AA", goal="A hero lifts a boulder. If strong enough, they power up. Otherwise they strain. What's their power?",
          share="\U0001F4AA Powered up!\nPower: 20"),
        P("if_else_simple", v1="level", n1=10, v2="boss", n2=8, cmp_op=">", vr="outcome",
          true_v="level", true_op="*", true_arg=2, false_v="level", false_op="-", false_arg=3,
          emoji="\U0001F47E", goal="You encounter the boss! If your level is higher, deal double damage. Otherwise take a hit. Outcome?",
          share="\U0001F47E Victory!\nOutcome: 20"),
        P("if_else_simple", v1="armor", n1=35, v2="attack", n2=20, cmp_op=">", vr="block",
          true_v="armor", true_op="-", true_arg=20, false_v="armor", false_op="+", false_arg=10,
          emoji="\U0001F6E1\uFE0F", goal="The knight braces for impact. Armor strong enough to absorb the blow, or reinforce it? Block value?",
          share="\U0001F6E1\uFE0F Blow absorbed!\nArmor: 15"),
        P("while_two_var", v1="muscle", n1=0, v2="protein", n2=40, op1="+", step1=8, op2="-", step2=8,
          cond_v="protein", cond_op=">", cond_val="0", ret_v="muscle",
          emoji="\U0001F4AA", goal="An athlete converts protein into muscle each session. How much muscle when protein runs out?",
          share="\U0001F4AA Gains!\nMuscle: 40"),
        P("while_decay", v1="damage", n1=0, v2="power", n2=8, vr="attacks",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\u2694\uFE0F", goal="A warrior tires with each swing, losing power per attack. Total damage dealt before exhaustion?",
          share="\u2694\uFE0F Battle over!\nDamage: 20"),
        P("while_if", v1="energy", n1=35, v2="shield", n2=20, vr="hits",
          loop_cond_v="energy", loop_cond_op=">", loop_cond_val=0,
          if_v="shield", if_op=">", if_val=5, if_body_v="shield", if_body_op="-", if_body_val=3,
          v1_op="-", v1_step=7, emoji="\u26A1",
          goal="A fighter takes hits that drain energy. While shields hold, they absorb some damage. How many hits before collapse?",
          share="\u26A1 Shields down!\n5 hits taken", diff="hard"),
        P("while_if", v1="ammo", n1=24, v2="targets", n2=10, vr="kills",
          loop_cond_v="ammo", loop_cond_op=">", loop_cond_val=0,
          if_v="targets", if_op=">", if_val=3, if_body_v="targets", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=4, emoji="\U0001F52B",
          goal="A sniper picks off targets, spending ammo per kill. Clustered targets go down faster. How many kills?",
          share="\U0001F52B Mission complete!\n6 targets eliminated", diff="hard"),
        P("while_if", v1="mana", n1=40, v2="barrier", n2=15, vr="casts",
          loop_cond_v="mana", loop_cond_op=">", loop_cond_val=0,
          if_v="barrier", if_op=">", if_val=3, if_body_v="barrier", if_body_op="-", if_body_val=3,
          v1_op="-", v1_step=8, emoji="\U0001FA84",
          goal="A wizard hurls spells, draining mana each cast. While the barrier holds, each spell weakens it. Total casts?",
          share="\U0001FA84 Spellstorm!\n5 spells cast", diff="hard"),
        P("for_accum", vr="arrows", n_end=4, k=9, emoji="\U0001F3F9",
          goal="An archer fires arrows each round. Total arrows shot after all rounds?",
          share="\U0001F3F9 Shot: 36 arrows!"),
        P("while_decay", v1="score", n1=0, v2="combo", n2=9, vr="hits",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F3AE", goal="A combo multiplier drops with each hit. Total score before the combo breaks?",
          share="\U0001F3AE Combo broken!\nScore: 18"),
        P("for_if", vr="loot", n_end=8, threshold=3, emoji="\U0001FA99",
          goal="A dungeon has rooms. Only rooms past a certain point have treasure. Collect room numbers as loot. Total loot?",
          share="\U0001FA99 Loot: 30!"),
        P("if_else_simple", v1="ammo", n1=8, v2="clip", n2=6, cmp_op=">", vr="remaining",
          true_v="ammo", true_op="-", true_arg=3, false_v="ammo", false_op="+", false_arg=4,
          emoji="\U0001F52B", goal="The soldier checks the clip. Full? Fire a burst. Empty? Reload first. Ammo remaining?",
          share="\U0001F52B Shots fired!\nAmmo: 5"),
        P("while_two_var", v1="thrust", n1=0, v2="fuel", n2=50, op1="+", step1=10, op2="-", step2=10,
          cond_v="fuel", cond_op=">", cond_val="0", ret_v="thrust",
          emoji="\U0001F680", goal="A rocket burns fuel to build thrust each tick. How much thrust when the tank is empty?",
          share="\U0001F680 Launched!\nThrust: 50"),
        P("for_two_var", vr="damage", v2="power", v2_start=12, n_end=4, vr_op="+", v2_op="-", v2_step=2, emoji="\u2694\uFE0F",
          goal="A warrior's power weakens with each swing. Total damage after all swings?",
          share="\u2694\uFE0F Damage: 36!"),
    ]

@theme("nature")
def theme_nature():
    return [
        P("for_accum", vr="flowers", n_end=4, k=6, emoji="\U0001F33B",
          goal="Plant flowers in each row. Total flowers in the garden?",
          share="\U0001F33B Garden: 24 flowers!"),
        P("for_triangular", vr="petals", n_end=6, emoji="\U0001F33C",
          goal="A flower grows petals each day, more than the day before. Total petals on the bloom?",
          share="\U0001F33C Bloomed: 21 petals!"),
        P("for_triangular", vr="drops", n_end=10, emoji="\U0001F4A7",
          goal="A leak drips more each hour. Total drops spilled?",
          share="\U0001F4A7 Spilled: 55 drops!"),
        P("while_accum", v1="growth", n1=1, vr="size", step=2, limit=5, emoji="\U0001F331",
          goal="A plant's growth rate increases each week. What size after all weeks?",
          share="\U0001F331 Thriving!\nSize: 25"),
        P("while_accum", v1="seeds", n1=6, vr="planted", step=2, limit=5, emoji="\U0001F33B",
          goal="A gardener plants more seeds each day. How many planted after all days?",
          share="\U0001F33B Garden full!\nPlanted: 50"),
        P("while_decay", v1="harvest", n1=0, v2="yield", n2=15, vr="seasons",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F33E", goal="A farm's yield shrinks each season as soil depletes. Total harvest across all seasons?",
          share="\U0001F33E Soil spent!\nHarvest: 45"),
        P("if_else_simple", v1="rain", n1=20, v2="drought", n2=30, cmp_op="<", vr="crop",
          true_v="rain", true_op="*", true_arg=3, false_v="rain", false_op="-", false_arg=5,
          emoji="\U0001F327\uFE0F", goal="If it's wet enough, crops triple. Otherwise they wither. Harvest?",
          share="\U0001F327\uFE0F Bumper crop!\nHarvest: 60"),
        P("if_else_simple", v1="seeds", n1=15, v2="plots", n2=10, cmp_op=">", vr="crop",
          true_v="seeds", true_op="-", true_arg=10, false_v="seeds", false_op="+", false_arg=5,
          emoji="\U0001F331", goal="Enough garden plots? Plant the seeds. Too few? Save them for later. Crop yield?",
          share="\U0001F331 Planted!\nCrop: 5"),
        P("if_else_calc", v1="wolves", n1=5, v2="sheep", n2=15, cmp_op=">", cmp_val=15, vr="herd", vi="pack",
          true_op="+", false_op="-", emoji="\U0001F43A",
          goal="The wolf pack eyes the flock. Big enough pack? They hunt. Too small? Sheep scatter. What happens to the herd?",
          share="\U0001F43A Nature's balance!\nHerd changed"),
        P("for_multiply", vr="size", n_end=4, k=2, emoji="\U0001F9A0",
          goal="A cell divides: it doubles in size each cycle. Final size?",
          share="\U0001F9A0 Grown: 16!"),
        P("while_accum", v1="rainfall", n1=5, vr="water", step=2, limit=6, emoji="\U0001F327\uFE0F",
          goal="Monsoon season! Rainfall increases each day. How much water fills the cistern?",
          share="\U0001F327\uFE0F Cistern full!\nWater: 60"),
        P("for_accum", vr="seeds", n_end=7, k=4, emoji="\U0001F331",
          goal="Plant seeds in each pot. How many seeds total?",
          share="\U0001F331 Planted: 28 seeds!"),
        P("while_if", v1="water", n1=45, v2="crops", n2=8, vr="harvests",
          loop_cond_v="water", loop_cond_op=">", loop_cond_val=0,
          if_v="crops", if_op=">", if_val=2, if_body_v="crops", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=9, emoji="\U0001F4A7",
          goal="A farmer waters crops each harvest, but some crops wilt over time. How many harvests until the well runs dry?",
          share="\U0001F4A7 Well dry!\n5 harvests gathered", diff="hard"),
        P("while_if", v1="seeds", n1=30, v2="pests", n2=8, vr="plantings",
          loop_cond_v="seeds", loop_cond_op=">", loop_cond_val=0,
          if_v="pests", if_op=">", if_val=3, if_body_v="pests", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=6, emoji="\U0001F331",
          goal="A gardener uses seeds each planting. Pest control slowly eliminates the bugs. Total plantings?",
          share="\U0001F331 Garden blooming!\n5 plantings", diff="hard"),
        P("while_decay", v1="erosion", n1=0, v2="rain", n2=11, vr="storms",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=1,
          emoji="\U0001F327\uFE0F", goal="Each storm erodes the cliffside, but storms weaken over time. Total erosion before they pass?",
          share="\U0001F327\uFE0F Storms passed!\nErosion: 40", diff="hard"),
        P("for_two_var", vr="harvest", v2="yield", v2_start=10, n_end=3, vr_op="+", v2_op="-", v2_step=2, emoji="\U0001F33E",
          goal="Each season the yield drops. Total harvest over all seasons?",
          share="\U0001F33E Harvested: 24!"),
        P("if_else_calc", v1="nectar", n1=7, v2="pollen", n2=5, cmp_op=">", cmp_val=10, vr="honey", vi="flowers",
          true_op="+", false_op="-", emoji="\U0001F41D",
          goal="The bees return to the hive. Good harvest? Add more nectar. Poor day? Lose some pollen. Honey made?",
          share="\U0001F41D Honey harvest!\nSweet results"),
    ]

@theme("space")
def theme_space():
    return [
        P("arith_chain3", v1="speed", n1=12, v2="time", n2=3, v3="wind", n3=6, vr="flight", op1="*", op2="+", emoji="\U0001F6EB",
          goal="A plane flies at speed for some time, then gets a tailwind boost. Total flight distance?",
          share="\U0001F6EB Landed safely!\n42 miles traveled"),
        P("for_accum", vr="stars", n_end=8, k=6, emoji="\u2B50",
          goal="An astronomer maps stars each hour. Total stars mapped after all hours?",
          share="\u2B50 Mapped: 48 stars!"),
        P("for_triangular", vr="xp", n_end=9, emoji="\u2B50",
          goal="Earn increasing XP for each quest completed. Total XP earned?",
          share="\u2B50 XP: 45!"),
        P("for_custom_start", vr="altitude", v_start=200, n_end=5, k_op="-", k_val=15, emoji="\U0001F6AC",
          goal="A hot air balloon descends steadily each minute. Altitude after all minutes?",
          share="\U0001F6AC Altitude: 125 feet!"),
        P("for_two_var", vr="altitude", v2="thrust", v2_start=20, n_end=3, vr_op="+", v2_op="-", v2_step=5, emoji="\U0001F680",
          goal="A rocket's thrust drops with each burn. Total altitude gained after all burns?",
          share="\U0001F680 Altitude: 45!"),
        P("if_else_simple", v1="oxygen", n1=80, v2="threshold", n2=60, cmp_op=">", vr="supply",
          true_v="oxygen", true_op="-", true_arg=25, false_v="oxygen", false_op="+", false_arg=15,
          emoji="\U0001F4A8", goal="The astronaut checks O2 levels. Enough to sprint to the airlock, or rest and conserve? Oxygen supply?",
          share="\U0001F4A8 Made it!\nOxygen: 55"),
        P("while_accum", v1="orbit", n1=10, vr="distance", step=4, limit=4, emoji="\U0001F6F0\uFE0F",
          goal="Thrust increases with each burn. Total distance traveled?",
          share="\U0001F6F0\uFE0F Orbit: distance reached"),
        P("while_mul", v1="ripple", n1=1, mul=2, limit=7, vr="seconds", emoji="\U0001F30A",
          goal="A ripple doubles in radius each second. Final radius?",
          share="\U0001F30A Ripple: 128!"),
        P("while_counter", v1="xp", n1=15, vr="total", limit=4, emoji="\u2B50",
          goal="Earn XP per quest, complete several quests. What's the total?",
          share="\u2B50 XP: 60"),
        P("for_multiply", vr="power", n_end=5, k=2, emoji="\u26A1",
          goal="A reactor doubles its output each stage. Final power?",
          share="\u26A1 Power: 32!"),
        P("while_if", v1="air", n1=36, v2="depth", n2=8, vr="breaths",
          loop_cond_v="air", loop_cond_op=">", loop_cond_val=0,
          if_v="depth", if_op=">", if_val=2, if_body_v="depth", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=6, emoji="\U0001F93F",
          goal="A diver uses air each breath. As the dive goes on, they slowly surface. How many breaths until air runs out?",
          share="\U0001F93F Surfaced!\n6 breaths taken", diff="hard"),
        P("while_if", v1="battery", n1=40, v2="signal", n2=12, vr="calls",
          loop_cond_v="battery", loop_cond_op=">", loop_cond_val=0,
          if_v="signal", if_op=">", if_val=4, if_body_v="signal", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F4F1",
          goal="A phone drains battery each call. Strong signal weakens as you move away. How many calls?",
          share="\U0001F4F1 Battery dead!\n5 calls made", diff="hard"),
        P("for_accum", vr="photos", n_end=4, k=9, emoji="\U0001F4F8",
          goal="Take photos at each landmark. Total photos?",
          share="\U0001F4F8 Taken: 36 photos!"),
        P("while_countdown", v1="oxygen", n1=48, step=8, vr="dives", emoji="\U0001F93F",
          goal="Use oxygen per dive. Total dives?",
          share="\U0001F93F Dives: 6"),
        P("if_else_calc", v1="fuel", n1=25, v2="air", n2=15, cmp_op=">", cmp_val=35, vr="thrust", vi="mix",
          true_op="+", false_op="-", emoji="\U0001F680",
          goal="The engineer checks the fuel-air mixture. Rich enough? Add fuel for thrust. Lean? Reduce airflow. Thrust level?",
          share="\U0001F680 Engine tuned!\nThrust calculated"),
        P("while_accum", v1="gravity", n1=3, vr="depth", step=2, limit=4, emoji="\U0001F30D",
          goal="A rock falls faster each second as gravity pulls harder. What depth after all seconds?",
          share="\U0001F30D Splash!\nDepth: 24"),
    ]

@theme("finance")
def theme_finance():
    return [
        P("arith_chain3", v1="base", n1=10, v2="bonus", n2=5, v3="tax", n3=3, vr="pay", op1="+", op2="-", emoji="\U0001F4B5",
          goal="You earned a base wage plus a bonus, but tax takes a cut. What's your paycheck?",
          share="\U0001F4B5 Payday!\nBase + bonus - tax = $12"),
        P("for_custom_start", vr="balance", v_start=50, n_end=6, k_op="+", k_val=10, emoji="\U0001F4B5",
          goal="Start with savings. Deposit money each month. Balance after all months?",
          share="\U0001F4B5 Saved: $110!"),
        P("for_custom_start", vr="score", v_start=90, n_end=4, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with points. Earn bonus points each round. Final score?",
          share="\U0001F3AE Score: 110!"),
        P("while_counter", v1="deposit", n1=25, vr="savings", limit=6, emoji="\U0001F4B5",
          goal="Deposit money each month for several months. Total savings?",
          share="\U0001F4B5 Saved: $150"),
        P("while_accum", v1="wage", n1=10, vr="earned", step=5, limit=4, emoji="\U0001F4B0",
          goal="A worker's wage increases each pay period. Total earned after all periods?",
          share="\U0001F4B0 Payday!\nEarned: $70"),
        P("while_decay", v1="savings", n1=0, v2="income", n2=10, vr="months",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F4B0", goal="A freelancer's income drops each month as contracts dry up. Total saved before it hits zero?",
          share="\U0001F4B0 Saved up!\nSavings: 30"),
        P("if_else_simple", v1="gold", n1=90, v2="price", n2=80, cmp_op=">", vr="remaining",
          true_v="gold", true_op="-", true_arg=80, false_v="gold", false_op="+", false_arg=10,
          emoji="\U0001F4B0", goal="You spot a legendary sword in the shop. Can you afford it, or do you save up? Gold remaining?",
          share="\U0001F4B0 Sword purchased!\nGold: 10"),
        P("if_else_simple", v1="stocks", n1=120, v2="target", n2=100, cmp_op=">", vr="portfolio",
          true_v="stocks", true_op="-", true_arg=50, false_v="stocks", false_op="+", false_arg=30,
          emoji="\U0001F4C8", goal="The stock hits its target price! Time to sell for profit? Or hold and accumulate? Portfolio value?",
          share="\U0001F4C8 Sold high!\nPortfolio: 70"),
        P("while_two_var", v1="gold", n1=0, v2="ore", n2=36, op1="+", step1=6, op2="-", step2=6,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="gold",
          emoji="\u26CF\uFE0F", goal="Miners haul ore each shift and smelt it into gold. How much gold when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nGold: 36"),
        P("for_two_var", vr="gold", v2="wage", v2_start=5, n_end=4, vr_op="+", v2_op="+", v2_step=3, emoji="\U0001F4B0",
          goal="A worker's wage rises each day. Total gold earned?",
          share="\U0001F4B0 Earned: 38!"),
        P("for_two_var", vr="savings", v2="income", v2_start=15, n_end=3, vr_op="+", v2_op="+", v2_step=5, emoji="\U0001F4B8",
          goal="Income grows each month. Total saved?",
          share="\U0001F4B8 Saved: 55!"),
        P("while_if", v1="budget", n1=50, v2="staff", n2=10, vr="months",
          loop_cond_v="budget", loop_cond_op=">", loop_cond_val=0,
          if_v="staff", if_op=">", if_val=4, if_body_v="staff", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=10, emoji="\U0001F4B8",
          goal="A startup burns budget monthly. While overstaffed, they downsize. How many months does the money last?",
          share="\U0001F4B8 Runway gone!\n5 months survived", diff="hard"),
        P("while_if", v1="credits", n1=25, v2="loans", n2=10, vr="payments",
          loop_cond_v="credits", loop_cond_op=">", loop_cond_val=0,
          if_v="loans", if_op=">", if_val=4, if_body_v="loans", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001F3E6",
          goal="A student makes monthly loan payments. Multiple loans get consolidated over time. Months to pay off?",
          share="\U0001F3E6 Debt free!\n5 payments made", diff="hard"),
        P("if_else_calc", v1="gold", n1=30, v2="silver", n2=20, cmp_op="<", cmp_val=40, vr="vault", vi="treasure",
          true_op="+", false_op="-", emoji="\U0001FA99",
          goal="A dragon counts its hoard. Rich enough? Add more gold. Poor haul? Toss some silver out. Vault total?",
          share="\U0001FA99 Hoard counted!\nVault updated"),
        P("for_accum", vr="tickets", n_end=6, k=5, emoji="\U0001F3AB",
          goal="Sell tickets each hour. Total tickets sold?",
          share="\U0001F3AB Sold: 30 tickets!"),
        P("while_countdown", v1="tape", n1=18, step=3, vr="boxes", emoji="\U0001F4E6",
          goal="Use tape per box. Boxes sealed?",
          share="\U0001F4E6 Boxes: 6"),
    ]

@theme("music")
def theme_music():
    return [
        P("arith_multi_step", v1="notes", n1=8, v2="rests", n2=2, vi="bars", op1="*", v3="tempo", n3=5, vr="rhythm", op2="+", emoji="\U0001F3B6",
          goal="Arrange notes with rests into bars, then add the tempo. What's the rhythm score?",
          share="\U0001F3B6 Music flows!\nRhythm score: 21"),
        P("for_accum", vr="notes", n_end=6, k=5, emoji="\U0001F3B5",
          goal="Play notes each measure. Total notes played?",
          share="\U0001F3B5 Music: 30 notes!"),
        P("for_triangular", vr="bows", n_end=5, emoji="\U0001F3BB",
          goal="A violinist takes bows after each piece. Total bows?",
          share="\U0001F3BB Encore: 15 bows!"),
        P("while_accum", v1="tempo", n1=60, vr="beats", step=10, limit=3, emoji="\U0001F3B6",
          goal="A DJ speeds up the tempo each verse. Total beats?",
          share="\U0001F3B6 Drop!\nBeats: 210"),
        P("while_counter", v1="notes", n1=4, vr="total", limit=8, emoji="\U0001F3B5",
          goal="Play notes per measure, several measures. How many total?",
          share="\U0001F3B5 Notes: 32"),
        P("while_decay", v1="melody", n1=0, v2="volume", n2=14, vr="notes",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F3B5", goal="A music box winds down, each note quieter. Total melody played before silence?",
          share="\U0001F3B5 Song ended!\nMelody: 63", diff="hard"),
        P("if_else_calc", v1="bass", n1=10, v2="treble", n2=8, cmp_op=">", cmp_val=15, vr="mix", vi="audio",
          true_op="+", false_op="-", emoji="\U0001F3B5",
          goal="The DJ checks the audio levels. Loud enough? Pump up the bass. Quiet? Dial back the treble. Final mix?",
          share="\U0001F3B5 Track mixed!\nPerfect balance"),
        P("if_else_calc", v1="strings", n1=6, v2="frets", n2=12, cmp_op="<", cmp_val=15, vr="tune", vi="chord",
          true_op="+", false_op="-", emoji="\U0001F3B8",
          goal="The guitarist tunes up. Sounds good? Add more strings. Off-key? Cut some frets. Chord quality?",
          share="\U0001F3B8 In tune!\nChord perfected"),
        P("for_two_var", vr="melody", v2="volume", v2_start=6, n_end=5, vr_op="+", v2_op="+", v2_step=1, emoji="\U0001F3B5",
          goal="A crescendo starts at a set volume and grows each beat. Total melody power?",
          share="\U0001F3B5 Melody: 40!"),
        P("for_if", vr="notes", n_end=8, threshold=5, emoji="\U0001F3B5",
          goal="An 8-bar solo. Only the last bars hit the high notes. Sum of those bar numbers?",
          share="\U0001F3B5 Solo: 21!"),
        P("for_accum", vr="frames", n_end=5, k=6, emoji="\U0001F3AC",
          goal="Render frames each second. Total frames?",
          share="\U0001F3AC Rendered: 30 frames!"),
        P("while_accum", v1="talent", n1=3, vr="fame", step=2, limit=4, emoji="\U0001F31F",
          goal="An entertainer's talent grows with each show. How famous after all shows?",
          share="\U0001F31F Star born!\nFame: 24"),
        P("for_accum", vr="notes", n_end=4, k=8, emoji="\U0001F3B5",
          goal="Practice notes per session. How many notes total?",
          share="\U0001F3B5 Learned: 32 notes!"),
        P("while_countdown", v1="film", n1=36, step=6, vr="scenes", emoji="\U0001F3AC",
          goal="Use minutes per scene. Scenes filmed?",
          share="\U0001F3AC Scenes: 6"),
        P("for_custom_start", vr="morale", v_start=60, n_end=5, k_op="+", k_val=7, emoji="\U0001F389",
          goal="Team morale starts and each win adds motivation. Final morale?",
          share="\U0001F389 Pumped: 95!"),
        P("while_if", v1="ink", n1=32, v2="color", n2=8, vr="pages",
          loop_cond_v="ink", loop_cond_op=">", loop_cond_val=0,
          if_v="color", if_op=">", if_val=2, if_body_v="color", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=4, emoji="\U0001F5A8\uFE0F",
          goal="A printer uses ink each page. Color intensity fades with each print. How many pages before ink runs out?",
          share="\U0001F5A8\uFE0F Ink empty!\n8 pages printed", diff="hard"),
    ]

@theme("sports")
def theme_sports():
    return [
        P("for_accum", vr="points", n_end=4, k=10, emoji="\U0001F3AF",
          goal="Score points each round. Total points after all rounds?",
          share="\U0001F3AF Score: 40 points!"),
        P("for_accum", vr="reps", n_end=5, k=10, emoji="\U0001F4AA",
          goal="Do pushups each set. Total reps after all sets?",
          share="\U0001F4AA Workout: 50 reps!"),
        P("for_accum", vr="laps", n_end=5, k=4, emoji="\U0001F3CA",
          goal="Swim laps each session. Total laps after all sessions?",
          share="\U0001F3CA Swam: 20 laps!"),
        P("for_triangular", vr="pushups", n_end=7, emoji="\U0001F4AA",
          goal="Increasing pushups each day. Total pushups this week?",
          share="\U0001F4AA Gains: 28 pushups!"),
        P("while_counter", v1="push", n1=10, vr="total", limit=4, emoji="\U0001F4AA",
          goal="Do pushups per set, several sets. Total?",
          share="\U0001F4AA Workout: 40 pushups"),
        P("while_counter", v1="throws", n1=9, vr="total", limit=3, emoji="\u26BE",
          goal="Throw pitches per inning. How many total?",
          share="\u26BE Pitches: 27"),
        P("while_countdown", v1="stamina", n1=36, step=9, vr="rounds", emoji="\U0001F94A",
          goal="Lose stamina per round. Rounds to exhaust?",
          share="\U0001F94A Rounds: 4"),
        P("while_decay", v1="distance", n1=0, v2="speed", n2=20, vr="laps",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A runner slows each lap from fatigue. Total distance before they stop?",
          share="\U0001F3C3 Race done!\nDistance: 60"),
        P("if_else_simple", v1="skill", n1=8, v2="quest", n2=5, cmp_op=">", vr="reward",
          true_v="skill", true_op="*", true_arg=3, false_v="skill", false_op="+", false_arg=2,
          emoji="\U0001F3AF", goal="A skilled archer enters a tournament. Win big or get a consolation prize. What's the reward?",
          share="\U0001F3AF Bullseye!\nReward: 24"),
        P("for_if", vr="score", n_end=10, threshold=6, emoji="\U0001F3AF",
          goal="Play several rounds. The first ones are warm-up, but each one after scores big. Total score?",
          share="\U0001F3AF Bonus: 34!"),
        P("for_if", vr="points", n_end=10, threshold=7, emoji="\U0001F3C6",
          goal="A tournament has rounds. The first ones are qualifiers, but each final awards points equal to its number. Total points?",
          share="\U0001F3C6 Points: 27!"),
        P("for_two_var", vr="score", v2="combo", v2_start=8, n_end=4, vr_op="+", v2_op="-", v2_step=1, emoji="\U0001F3AE",
          goal="A combo multiplier fades each hit. Total score after all hits?",
          share="\U0001F3AE Score: 26!"),
        P("while_decay", v1="points", n1=0, v2="streak", n2=8, vr="games",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F3C0", goal="A winning streak earns points but fades each game. Total points before the streak breaks?",
          share="\U0001F3C0 Streak ended!\nPoints: 20"),
        P("for_accum", vr="laps", n_end=8, k=3, emoji="\U0001F3CA",
          goal="Swim laps each set. Total laps?",
          share="\U0001F3CA Swam: 24 laps!"),
        P("for_triangular", vr="reps", n_end=6, emoji="\U0001F3CB\uFE0F",
          goal="Increasing reps each set. Total reps?",
          share="\U0001F3CB\uFE0F Reps: 21!"),
        P("for_if", vr="points", n_end=10, threshold=5, emoji="\U0001F3C5",
          goal="A judge scores rounds. The first ones don't count, but each one after earns points equal to its number. Total points?",
          share="\U0001F3C5 Points: 40!"),
        P("while_if", v1="stamina", n1=40, v2="form", n2=10, vr="sprints",
          loop_cond_v="stamina", loop_cond_op=">", loop_cond_val=0,
          if_v="form", if_op=">", if_val=4, if_body_v="form", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F3C3",
          goal="A sprinter burns stamina each sprint. Good form degrades over time. How many sprints before exhaustion?",
          share="\U0001F3C3 Exhausted!\nN sprints completed", diff="hard"),
        P("while_if_else", v1="morale", n1=10, v2="endurance", n2=80, vr="rounds",
          loop_v="endurance", loop_op=">", loop_val=10,
          if_v="morale", if_op=">", if_val=5,
          true_v="endurance", true_op="-", true_val=10,
          false_v="endurance", false_op="-", false_val=20,
          dec_v="morale", dec_op="-", dec_val=2, emoji="\U0001F94A",
          goal="A boxer fights rounds. High morale means less damage taken, but morale drops each round. Rounds before the bell?",
          share="\U0001F94A Knockout!\nN rounds fought", diff="hard"),
    ]

@theme("science")
def theme_science():
    return [
        P("for_multiply", vr="rumor", n_end=3, k=3, emoji="\U0001F5E3\uFE0F",
          goal="A rumor triples each day. How far has it spread?",
          share="\U0001F5E3\uFE0F Spread: 27!"),
        P("for_multiply", vr="echo", n_end=4, k=3, emoji="\U0001F50A",
          goal="An echo triples in volume with each bounce. Final volume?",
          share="\U0001F50A Echo: 81!"),
        P("while_mul", v1="bacteria", n1=2, mul=2, limit=6, vr="generations", emoji="\U0001F9A0",
          goal="Bacteria double each generation. Final population?",
          share="\U0001F9A0 Bacteria: 128"),
        P("while_mul", v1="virus", n1=1, mul=4, limit=4, vr="hours", emoji="\U0001F9A0",
          goal="Virus quadruples every hour. Final count?",
          share="\U0001F9A0 Virus: 256"),
        P("while_mul", v1="echo", n1=2, mul=3, limit=4, vr="bounces", emoji="\U0001F50A",
          goal="Echo triples with each bounce. Final volume?",
          share="\U0001F50A Echo: 162"),
        P("if_else_calc", v1="atoms", n1=15, v2="bonds", n2=9, cmp_op=">", cmp_val=20, vr="molecule", vi="matter",
          true_op="+", false_op="-", emoji="\u269B\uFE0F",
          goal="The chemist checks the compound. Stable enough? Add more atoms. Unstable? Break some bonds. Molecule size?",
          share="\u269B\uFE0F Reaction complete!\nMolecule formed"),
        P("while_counter", v1="samples", n1=3, vr="total", limit=7, emoji="\U0001F52C",
          goal="Analyze samples per test, several tests. How many total?",
          share="\U0001F52C Samples: 21"),
        P("while_accum", v1="voltage", n1=4, vr="charge", step=3, limit=3, emoji="\u26A1",
          goal="A capacitor builds voltage faster each pulse. How much charge after all pulses?",
          share="\u26A1 Charged!\nVoltage: 21"),
        P("while_accum", v1="heat", n1=10, vr="energy", step=5, limit=3, emoji="\u2622\uFE0F",
          goal="A reactor's heat output increases each cycle. Total energy?",
          share="\u2622\uFE0F Reactor hot!\nEnergy: 45"),
        P("for_multiply", vr="cells", n_end=5, k=2, emoji="\U0001F9EC",
          goal="Cells divide: they double each generation. Final count?",
          share="\U0001F9EC Cells: 32!"),
        P("for_multiply", vr="crystal", n_end=3, k=5, emoji="\U0001F48E",
          goal="A crystal grows several times per layer. Final size?",
          share="\U0001F48E Crystal: 125!"),
        P("while_countdown", v1="ice", n1=50, step=10, vr="minutes", emoji="\U0001F9CA",
          goal="Ice melts per minute. Minutes to melt?",
          share="\U0001F9CA Minutes: 5"),
        P("while_mul", v1="algae", n1=3, mul=2, limit=4, vr="blooms", emoji="\U0001F33F",
          goal="Algae doubles each bloom. Final coverage?",
          share="\U0001F33F Algae: 48"),
        P("if_else_simple", v1="temp", n1=30, v2="limit", n2=25, cmp_op=">", vr="reading",
          true_v="temp", true_op="-", true_arg=5, false_v="temp", false_op="+", false_arg=10,
          emoji="\U0001F321\uFE0F", goal="The lab is overheating! If it's too hot, cool it down. Otherwise, warm it up. Final reading?",
          share="\U0001F321\uFE0F Lab stabilized!\nTemp: 25 degrees"),
        P("while_decay", v1="pressure", n1=0, v2="force", n2=18, vr="cycles",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F4A5", goal="A hydraulic press loses force each cycle. Total pressure applied before it gives out?",
          share="\U0001F4A5 Press spent!\nPressure: 63"),
        P("for_accum", vr="sparks", n_end=5, k=8, emoji="\u2728",
          goal="A firework launches sparks each second. Total sparks?",
          share="\u2728 Show: 40 sparks!"),
        P("while_if", v1="fuel", n1=36, v2="heat", n2=10, vr="reactions",
          loop_cond_v="fuel", loop_cond_op=">", loop_cond_val=0,
          if_v="heat", if_op=">", if_val=4, if_body_v="heat", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\u269B\uFE0F",
          goal="A reactor uses fuel each cycle. Heat dissipates over time. How many reaction cycles before fuel is spent?",
          share="\u269B\uFE0F Reactor shutdown!\nN cycles", diff="hard"),
        P("while_if_else", v1="precision", n1=10, v2="sample", n2=60, vr="tests",
          loop_v="sample", loop_op=">", loop_val=10,
          if_v="precision", if_op=">", if_val=4,
          true_v="sample", true_op="-", true_val=8,
          false_v="sample", false_op="-", false_val=16,
          dec_v="precision", dec_op="-", dec_val=2, emoji="\U0001F52C",
          goal="Lab tests consume samples. High precision means less waste, but precision degrades. How many tests?",
          share="\U0001F52C Lab done!\nN tests completed", diff="hard"),
    ]

@theme("construction")
def theme_construction():
    return [
        P("for_accum", vr="bricks", n_end=6, k=4, emoji="\U0001F9F1",
          goal="A mason lays bricks each hour. Total bricks after all hours?",
          share="\U0001F9F1 Wall: 24 bricks!"),
        P("for_accum", vr="blocks", n_end=4, k=7, emoji="\U0001F3D7\uFE0F",
          goal="Stack blocks each layer. Total blocks?",
          share="\U0001F3D7\uFE0F Built: 28 blocks!"),
        P("arith_multi_step", v1="planks", n1=10, v2="nails", n2=5, vi="frame", op1="+", v3="paint", n3=2, vr="cabin", op2="*", emoji="\U0001F3E0",
          goal="Nail planks into a frame, then apply coats of paint. How sturdy is the cabin?",
          share="\U0001F3E0 Cabin built!\nSturdiness: 30"),
        P("arith_multi_step", v1="logs", n1=24, v2="splits", n2=4, vi="boards", op1="/", v3="nails", n3=3, vr="shelves", op2="+", emoji="\U0001FA9A",
          goal="Split the logs into boards, then nail on some extras. How many shelves?",
          share="\U0001FA9A Workshop done!\n9 shelves built"),
        P("while_counter", v1="bricks", n1=12, vr="total", limit=5, emoji="\U0001F9F1",
          goal="Lay bricks per row, several rows. How many total?",
          share="\U0001F9F1 Bricks: 60"),
        P("while_counter", v1="blocks", n1=6, vr="total", limit=4, emoji="\U0001F3D7\uFE0F",
          goal="Stack blocks per tower, several towers. How many total?",
          share="\U0001F3D7\uFE0F Blocks: 24"),
        P("while_countdown", v1="sand", n1=50, step=10, vr="castles", emoji="\U0001F3F0",
          goal="Use sand buckets per castle. Castles built?",
          share="\U0001F3F0 Castles: 5"),
        P("while_countdown", v1="marble", n1=32, step=8, vr="statues", emoji="\U0001F3DB\uFE0F",
          goal="Use marble blocks per statue. Statues carved?",
          share="\U0001F3DB\uFE0F Statues: 4"),
        P("if_else_simple", v1="wood", n1=30, v2="need", n2=25, cmp_op=">", vr="build",
          true_v="wood", true_op="-", true_arg=25, false_v="wood", false_op="+", false_arg=10,
          emoji="\U0001FA9A", goal="Enough wood? Build the shelter. Otherwise, gather more. Wood left?",
          share="\U0001FA9A Shelter built!\nWood: 5"),
        P("if_else_calc", v1="wood", n1=15, v2="stone", n2=10, cmp_op=">", cmp_val=20, vr="fort", vi="materials",
          true_op="+", false_op="-", emoji="\U0001F3F0",
          goal="Enough materials? Add more wood. Running low? Cut back the stone. Fort strength?",
          share="\U0001F3F0 Fort built!\nStrength measured"),
        P("if_else_calc", v1="bricks", n1=20, v2="mortar", n2=8, cmp_op=">", cmp_val=22, vr="wall", vi="build",
          true_op="+", false_op="-", emoji="\U0001F9F1",
          goal="The mason checks supplies. Enough to build? Stack more bricks. Running low? Use less mortar. Wall strength?",
          share="\U0001F9F1 Wall raised!\nStrength measured"),
        P("for_accum", vr="planks", n_end=7, k=3, emoji="\U0001FA9A",
          goal="Cut planks from each log. Total planks?",
          share="\U0001FA9A Cut: 21 planks!"),
        P("for_triangular", vr="tiles", n_end=5, emoji="\U0001F9E9",
          goal="Each row gets more tiles than the last. Total tiles placed?",
          share="\U0001F9E9 Tiled: 15!"),
        P("while_if", v1="wood", n1=35, v2="rain", n2=12, vr="builds",
          loop_cond_v="wood", loop_cond_op=">", loop_cond_val=0,
          if_v="rain", if_op=">", if_val=4, if_body_v="rain", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001FA9A",
          goal="A carpenter uses wood each build. Rainy days slow progress but gradually clear up. Builds completed?",
          share="\U0001FA9A Workshop busy!\n7 builds done", diff="hard"),
        P("while_if", v1="stone", n1=32, v2="cracks", n2=8, vr="blocks",
          loop_cond_v="stone", loop_cond_op=">", loop_cond_val=0,
          if_v="cracks", if_op=">", if_val=2, if_body_v="cracks", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001FAA8",
          goal="A sculptor carves stone blocks. Cracks in the stone smooth out over time. How many blocks carved?",
          share="\U0001FAA8 Masterpiece!\n4 blocks carved", diff="hard"),
        P("for_custom_start", vr="inventory", v_start=30, n_end=4, k_op="+", k_val=8, emoji="\U0001F4E6",
          goal="A warehouse starts with items and receives shipments. Total inventory?",
          share="\U0001F4E6 Inventory: 62!"),
        P("while_counter", v1="paint", n1=3, vr="coats", limit=8, emoji="\U0001F3A8",
          goal="Apply coats per layer, several layers. How many coats?",
          share="\U0001F3A8 Coverage: 24"),
    ]

@theme("ocean")
def theme_ocean():
    return [
        P("for_accum", vr="fish", n_end=6, k=3, emoji="\U0001F41F",
          goal="A fisherman catches fish each hour. Total fish after all hours?",
          share="\U0001F41F Catch: 18 fish!"),
        P("for_accum", vr="shells", n_end=5, k=4, emoji="\U0001F41A",
          goal="Collect shells from each beach. How many shells?",
          share="\U0001F41A Collected: 20 shells!"),
        P("if_else_simple", v1="wind", n1=25, v2="calm", n2=15, cmp_op=">", vr="sail",
          true_v="wind", true_op="*", true_arg=2, false_v="wind", false_op="+", false_arg=5,
          emoji="\u26F5", goal="A sailor checks the wind. Strong breeze? Full sails ahead! Calm? Paddle slowly. Speed?",
          share="\u26F5 Full sails!\nSpeed: 50 knots"),
        P("if_else_simple", v1="depth", n1=50, v2="limit", n2=40, cmp_op=">", vr="dive",
          true_v="depth", true_op="-", true_arg=10, false_v="depth", false_op="+", false_arg=20,
          emoji="\U0001F30A", goal="A diver checks the depth gauge. Too deep? Time to surface. Safe? Keep exploring. Final depth?",
          share="\U0001F30A Surfaced!\nDepth: 40m"),
        P("while_accum", v1="waves", n1=4, vr="erosion", step=3, limit=4, emoji="\U0001F30A",
          goal="Each tide's waves grow stronger. Total erosion?",
          share="\U0001F30A Shore changed!\nErosion: 34"),
        P("while_countdown", v1="rope", n1=30, step=5, vr="knots", emoji="\U0001FA62",
          goal="Tie rope per knot. Total knots?",
          share="\U0001FA62 Knots: 6"),
        P("while_mul", v1="ripple", n1=2, mul=2, limit=7, vr="seconds", emoji="\U0001F30A",
          goal="A ripple doubles each second. Final radius?",
          share="\U0001F30A Ripple: 256"),
        P("if_else_calc", v1="sails", n1=8, v2="oars", n2=6, cmp_op=">", cmp_val=10, vr="speed", vi="ship",
          true_op="+", false_op="-", emoji="\u26F5",
          goal="The captain reads the wind. Strong enough? Raise more sails. Calm seas? Stow the oars. Ship speed?",
          share="\u26F5 Anchors aweigh!\nSpeed calculated"),
        P("if_else_calc", v1="fish", n1=8, v2="bait", n2=12, cmp_op="<", cmp_val=15, vr="catch", vi="tackle",
          true_op="+", false_op="-", emoji="\U0001F3A3",
          goal="The fisher checks tackle quality. Good gear? Catch more fish. Bad day? Lose some bait. Total catch?",
          share="\U0001F3A3 Day on the lake!\nCatch counted"),
        P("while_if", v1="rope", n1=28, v2="knots", n2=8, vr="climbs",
          loop_cond_v="rope", loop_cond_op=">", loop_cond_val=0,
          if_v="knots", if_op=">", if_val=2, if_body_v="knots", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FA62",
          goal="A climber uses rope each ascent. While it's knotted, they untie sections. How many climbs?",
          share="\U0001FA62 Summit reached!\n4 climbs", diff="hard"),
        P("while_two_var", v1="harvest", n1=0, v2="seeds", n2=28, op1="+", step1=7, op2="-", step2=7,
          cond_v="seeds", cond_op=">", cond_val="0", ret_v="harvest",
          emoji="\U0001F33D", goal="A farmer plants seeds row by row until the bag is empty. What's the harvest?",
          share="\U0001F33D All planted!\nHarvest: 28"),
        P("while_two_var", v1="signal", n1=0, v2="power", n2=35, op1="+", step1=7, op2="-", step2=7,
          cond_v="power", cond_op=">", cond_val="0", ret_v="signal",
          emoji="\U0001F4E1", goal="A radio tower spends power to broadcast signal each tick. Total signal when the power dies?",
          share="\U0001F4E1 Broadcast over!\nSignal: 35"),
        P("for_multiply", vr="fire", n_end=6, k=2, emoji="\U0001F525",
          goal="A wildfire doubles each hour. Final area burned?",
          share="\U0001F525 Fire: 64!"),
        P("while_countdown", v1="wax", n1=33, step=11, vr="candles", emoji="\U0001F56F\uFE0F",
          goal="Melt wax per candle. Candles made?",
          share="\U0001F56F\uFE0F Candles: 3"),
        P("for_accum", vr="arrows", n_end=6, k=3, emoji="\U0001F3F9",
          goal="Fire arrows each round. Total arrows shot?",
          share="\U0001F3F9 Fired: 18 arrows!"),
        P("while_decay", v1="heat", n1=0, v2="flame", n2=16, vr="burns",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F525", goal="A campfire's flame weakens each round. Total heat generated before it dies out?",
          share="\U0001F525 Fire out!\nHeat: 40", diff="hard"),
    ]

@theme("magic")
def theme_magic():
    return [
        P("if_else_simple", v1="mana", n1=60, v2="cost", n2=40, cmp_op=">", vr="cast",
          true_v="mana", true_op="-", true_arg=40, false_v="mana", false_op="+", false_arg=20,
          emoji="\U0001FA84", goal="The wizard eyes a powerful spell. Enough mana to cast it, or meditate to recharge? Mana left?",
          share="\U0001FA84 Spell cast!\nMana: 20"),
        P("for_accum", vr="potions", n_end=3, k=5, emoji="\U0001F9EA",
          goal="Brew potions each day. Total potions after all days?",
          share="\U0001F9EA Brewed: 15 potions!"),
        P("while_two_var", v1="potion", n1=0, v2="herbs", n2=20, op1="+", step1=4, op2="-", step2=4,
          cond_v="herbs", cond_op=">", cond_val="0", ret_v="potion",
          emoji="\U0001F33F", goal="An alchemist brews potions from herbs until the supply is exhausted. How many potions brewed?",
          share="\U0001F33F All brewed!\nPotions: 20"),
        P("while_mul", v1="crystal", n1=1, mul=5, limit=3, vr="layers", emoji="\U0001F48E",
          goal="Crystal grows several times per layer. Final size?",
          share="\U0001F48E Crystal: 125"),
        P("for_multiply", vr="swarm", n_end=3, k=4, emoji="\U0001F41D",
          goal="A bee colony multiplies each month. Final swarm size?",
          share="\U0001F41D Swarm: 64!"),
        P("if_else_simple", v1="luck", n1=7, v2="odds", n2=5, cmp_op=">", vr="prize",
          true_v="luck", true_op="*", true_arg=3, false_v="luck", false_op="+", false_arg=2,
          emoji="\U0001F340", goal="Feeling lucky? Go for the jackpot! Otherwise, play it safe. Prize?",
          share="\U0001F340 Jackpot!\nPrize: 21"),
        P("if_else_simple", v1="crystal", n1=30, v2="threshold", n2=25, cmp_op=">", vr="strength",
          true_v="crystal", true_op="+", true_arg=15, false_v="crystal", false_op="-", false_arg=10,
          emoji="\U0001F48E", goal="A mage examines a crystal. Pure enough? Amplify its power. Flawed? It shatters a bit. Crystal strength?",
          share="\U0001F48E Crystal amplified!\nStrength: 45"),
        P("while_decay", v1="wisdom", n1=0, v2="study", n2=12, vr="years",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F9D9", goal="A sage's study intensity fades each year. Total wisdom gained?",
          share="\U0001F9D9 Enlightened!\nWisdom: 42", diff="hard"),
        P("while_accum", v1="exp", n1=10, vr="xp", step=5, limit=4, emoji="\U0001F3AF",
          goal="An adventurer earns increasing XP per quest. Total XP from all quests?",
          share="\U0001F3AF Leveled up!\nSkill: 70"),
        P("for_triangular", vr="sparks", n_end=7, emoji="\U0001F525",
          goal="A forge heats up: more sparks each minute. Total sparks?",
          share="\U0001F525 Forged: 28 sparks!"),
        P("while_if", v1="clay", n1=35, v2="kiln", n2=10, vr="firings",
          loop_cond_v="clay", loop_cond_op=">", loop_cond_val=0,
          if_v="kiln", if_op=">", if_val=4, if_body_v="kiln", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FAD9",
          goal="A potter uses clay each firing. The kiln cools between batches. How many firings?",
          share="\U0001FAD9 Kiln cooled!\n5 firings done", diff="hard"),
        P("for_custom_start", vr="fame", v_start=10, n_end=3, k_op="*", k_val=2, emoji="\u2B50",
          goal="Start with fame. Double your fame with each viral post. Total fame?",
          share="\u2B50 Famous: 80!"),
        P("while_decay", v1="morale", n1=0, v2="speech", n2=6, vr="rallies",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F4E3", goal="A leader's speeches inspire less each rally. Total morale raised?",
          share="\U0001F4E3 Rally over!\nMorale: 21"),
        P("for_two_var", vr="depth", v2="drill", v2_start=7, n_end=5, vr_op="+", v2_op="+", v2_step=1, emoji="\u26CF\uFE0F",
          goal="Drill speed increases each stage. Total depth?",
          share="\u26CF\uFE0F Drilled: 45!"),
        P("while_two_var", v1="xp", n1=0, v2="quests", n2=45, op1="+", step1=9, op2="-", step2=9,
          cond_v="quests", cond_op=">", cond_val="0", ret_v="xp",
          emoji="\u2B50", goal="An adventurer completes quests, earning XP for each one. Total XP when the quest board is empty?",
          share="\u2B50 Quest log clear!\nXP: 45"),
        P("if_else_simple", v1="karma", n1=40, v2="threshold", n2=35, cmp_op=">", vr="boost",
          true_v="karma", true_op="+", true_arg=15, false_v="karma", false_op="-", false_arg=5,
          emoji="\u2696\uFE0F", goal="The monk meditates. Is karma high enough for enlightenment? What boost to karma?",
          share="\u2696\uFE0F Enlightened!\nBoost: 55"),
    ]

@theme("technology")
def theme_technology():
    return [
        P("arith_chain3", v1="width", n1=5, v2="height", n2=3, v3="border", n3=4, vr="canvas", op1="+", op2="*", emoji="\U0001F5BC\uFE0F",
          goal="Combine width and height, then stretch by the border size. How big is the canvas?",
          share="\U0001F5BC\uFE0F Canvas stretched!\n32 pixels wide"),
        P("if_else_simple", v1="energy", n1=40, v2="cost", n2=50, cmp_op="<", vr="charge",
          true_v="energy", true_op="*", true_arg=2, false_v="energy", false_op="+", false_arg=10,
          emoji="\u26A1", goal="The robot checks its battery. Enough juice? Overcharge! Otherwise, trickle charge. Final charge?",
          share="\u26A1 Overcharged!\nEnergy: 80"),
        P("if_else_simple", v1="signal", n1=8, v2="noise", n2=5, cmp_op=">", vr="clarity",
          true_v="signal", true_op="*", true_arg=2, false_v="signal", false_op="-", false_arg=3,
          emoji="\U0001F4E1", goal="Clear signal? Amplify it! Static? Lose some clarity. Reception?",
          share="\U0001F4E1 Signal boosted!\nClarity: 16"),
        P("if_else_simple", v1="voltage", n1=60, v2="limit", n2=50, cmp_op=">", vr="circuit",
          true_v="voltage", true_op="-", true_arg=20, false_v="voltage", false_op="+", false_arg=15,
          emoji="\u26A1", goal="The circuit hits a voltage spike! Over the limit? Blow a fuse. Under? Boost the signal. Circuit voltage?",
          share="\u26A1 Circuit adjusted!\nVoltage: 40"),
        P("if_else_simple", v1="ink", n1=12, v2="paper", n2=20, cmp_op="<", vr="print",
          true_v="ink", true_op="*", true_arg=3, false_v="ink", false_op="+", false_arg=5,
          emoji="\U0001F5A8\uFE0F", goal="The printer checks ink levels. Plenty left? Print away! Low? Just a test page. Output?",
          share="\U0001F5A8\uFE0F Printed!\nOutput: 36 pages"),
        P("for_custom_start", vr="charge", v_start=20, n_end=4, k_op="+", k_val=12, emoji="\U0001F50B",
          goal="A battery starts low and charges each plug-in. After all plug-ins, what's the charge?",
          share="\U0001F50B Charged: 68%!"),
        P("while_accum", v1="clicks", n1=2, vr="views", step=3, limit=5, emoji="\U0001F4F1",
          goal="A viral post gains more clicks each day. Total views?",
          share="\U0001F4F1 Trending!\nViews: 40"),
        P("while_mul", v1="followers", n1=4, mul=2, limit=3, vr="posts", emoji="\U0001F4F1",
          goal="Followers double per post. Final count?",
          share="\U0001F4F1 Followers: 32"),
        P("while_countdown", v1="pixels", n1=60, step=12, vr="sprites", emoji="\U0001F3AE",
          goal="Use pixels per sprite. Sprites drawn?",
          share="\U0001F3AE Sprites: 5"),
        P("if_else_calc", v1="code", n1=20, v2="tests", n2=12, cmp_op=">", cmp_val=25, vr="quality", vi="suite",
          true_op="+", false_op="-", emoji="\U0001F4BB",
          goal="Code review time! Well-tested codebase? Ship more features. Undertested? Cut failing tests. Quality score?",
          share="\U0001F4BB Code reviewed!\nQuality measured"),
        P("if_else_calc", v1="pixels", n1=20, v2="frames", n2=10, cmp_op=">", cmp_val=25, vr="render", vi="scene",
          true_op="+", false_op="-", emoji="\U0001F3AC",
          goal="Rendering a scene! High resolution? Add more pixels. Low? Drop some frames. Render quality?",
          share="\U0001F3AC Scene rendered!\nQuality scored"),
        P("while_decay", v1="clicks", n1=0, v2="interest", n2=7, vr="days",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F5B1\uFE0F", goal="A viral post loses interest each day. Total clicks before nobody cares?",
          share="\U0001F5B1\uFE0F Trend over!\nClicks: 28", diff="hard"),
        P("while_accum", v1="stars", n1=1, vr="rating", step=1, limit=5, emoji="\u2B50",
          goal="A restaurant gains extra stars each review as word spreads. Total rating?",
          share="\u2B50 Five-star!\nRating: 15"),
        P("while_countdown", v1="wire", n1=48, step=8, vr="circuits", emoji="\U0001F50C",
          goal="Use wire per circuit. Circuits built?",
          share="\U0001F50C Circuits: 6"),
        P("while_accum", v1="likes", n1=7, vr="followers", step=4, limit=4, emoji="\U0001F44D",
          goal="Each post earns more likes as the account grows. Followers gained?",
          share="\U0001F44D Going viral!\nFollowers: 46"),
        P("while_mul", v1="virus", n1=3, mul=3, limit=3, vr="days", emoji="\U0001F9A0",
          goal="A computer virus triples each hour. Infected machines?",
          share="\U0001F9A0 Infected: 81"),
        P("while_if", v1="bandwidth", n1=36, v2="load", n2=10, vr="requests",
          loop_cond_v="bandwidth", loop_cond_op=">", loop_cond_val=0,
          if_v="load", if_op=">", if_val=4, if_body_v="load", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F4BB",
          goal="A server handles requests, consuming bandwidth. Load balancing improves over time. Requests before bandwidth runs out?",
          share="\U0001F4BB Server down!\nN requests served", diff="hard"),
        P("while_if_else", v1="cache", n1=12, v2="memory", n2=70, vr="cycles",
          loop_v="memory", loop_op=">", loop_val=10,
          if_v="cache", if_op=">", if_val=4,
          true_v="memory", true_op="-", true_val=8,
          false_v="memory", false_op="-", false_val=18,
          dec_v="cache", dec_op="-", dec_val=2, emoji="\U0001F4BB",
          goal="A program runs cycles using memory. Good cache means less memory used, but cache degrades. How many cycles?",
          share="\U0001F4BB Out of memory!\n6 cycles completed", diff="hard"),
    ]

@theme("mining")
def theme_mining():
    return [
        P("for_accum", vr="gems", n_end=7, k=2, emoji="\U0001F48E",
          goal="Mine gems each day. Total gems after all days?",
          share="\U0001F48E Mined: 14 gems!"),
        P("for_if", vr="gems", n_end=7, threshold=4, emoji="\U0001F48E",
          goal="Explore caves. Only deep caves contain gems equal to the cave number. Total gems?",
          share="\U0001F48E Gems: 18!"),
        P("while_two_var", v1="gold", n1=0, v2="ore", n2=42, op1="+", step1=7, op2="-", step2=7,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="gold",
          emoji="\u26CF\uFE0F", goal="Miners haul ore and smelt it into gold. How much gold when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nGold: 42"),
        P("while_decay", v1="mined", n1=0, v2="vein", n2=10, vr="digs",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\u26CF\uFE0F", goal="A gold vein thins with each dig. How much is mined before the vein runs out?",
          share="\u26CF\uFE0F Vein tapped!\nMined: 30", diff="hard"),
        P("for_accum", vr="coins", n_end=4, k=3, emoji="\U0001FA99",
          goal="A pirate finds gold coins each day. How many coins total?",
          share="\U0001FA99 Treasure: 12 coins!"),
        P("while_counter", v1="coins", n1=11, vr="total", limit=4, emoji="\U0001FA99",
          goal="Find coins per chest, several chests. How many total?",
          share="\U0001FA99 Coins: 44"),
        P("while_mul", v1="yeast", n1=5, mul=2, limit=3, vr="rises", emoji="\U0001F35E",
          goal="Yeast doubles each rise. Final volume?",
          share="\U0001F35E Yeast: 40"),
        P("for_two_var", vr="distance", v2="speed", v2_start=4, n_end=5, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F697",
          goal="A cart accelerates each tick. Total distance traveled?",
          share="\U0001F697 Driven: 40!"),
        P("while_countdown", v1="chalk", n1=20, step=4, vr="lessons", emoji="\U0001F4DA",
          goal="Use chalk per lesson. Total lessons?",
          share="\U0001F4DA Lessons: 5"),
        P("while_countdown", v1="ink", n1=42, step=7, vr="pages", emoji="\U0001F5A8\uFE0F",
          goal="Ink fades per page. Pages printable?",
          share="\U0001F5A8\uFE0F Pages: 6"),
        P("for_triangular", vr="coins", n_end=7, emoji="\U0001FA99",
          goal="A piggy bank grows each day with increasing deposits. Total coins?",
          share="\U0001FA99 Saved: 28 coins!"),
        P("if_else_simple", v1="pollen", n1=25, v2="threshold", n2=20, cmp_op=">", vr="harvest",
          true_v="pollen", true_op="*", true_arg=2, false_v="pollen", false_op="+", false_arg=5,
          emoji="\U0001F41D", goal="Bees return heavy with pollen. Enough? Double the honey yield! Small haul? Add a little extra. Harvest?",
          share="\U0001F41D Honey season!\nHarvest: 50"),
        P("for_accum", vr="apples", n_end=6, k=5, emoji="\U0001F34E",
          goal="Pick apples from each tree. Total apples?",
          share="\U0001F34E Picked: 30 apples!"),
        P("while_accum", v1="power", n1=8, vr="charged", step=4, limit=3, emoji="\U0001F50B",
          goal="A battery charges faster each cycle. Total charge?",
          share="\U0001F50B Full charge!\nPower: 36"),
        P("while_if", v1="stamina", n1=40, v2="terrain", n2=8, vr="miles",
          loop_cond_v="stamina", loop_cond_op=">", loop_cond_val=0,
          if_v="terrain", if_op=">", if_val=2, if_body_v="terrain", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001F3DE\uFE0F",
          goal="A hiker loses stamina each mile. Rough terrain gradually smooths out. Miles hiked?",
          share="\U0001F3DE\uFE0F Trail complete!\n5 miles hiked", diff="hard"),
        P("for_if", vr="profit", n_end=8, threshold=4, emoji="\U0001F4B0",
          goal="Run a shop for several days. The first few are slow, but each busy one after that earns profit equal to its number. Total profit?",
          share="\U0001F4B0 Profit: 26!"),
    ]

@theme("weather")
def theme_weather():
    return [
        P("for_custom_start", vr="health", v_start=75, n_end=3, k_op="-", k_val=5, emoji="\u2764\uFE0F",
          goal="Lose health with each poison tick. Health remaining?",
          share="\u2764\uFE0F HP: 60!"),
        P("for_custom_start", vr="temp", v_start=40, n_end=4, k_op="-", k_val=6, emoji="\u2744\uFE0F",
          goal="Temperature drops each hour. What's the temperature?",
          share="\u2744\uFE0F Chilly: 16 degrees!"),
        P("while_countdown", v1="fuel", n1=30, step=5, vr="burns", emoji="\U0001F680",
          goal="Burn fuel each tick. How many burns?",
          share="\U0001F680 Burns: 6"),
        P("while_countdown", v1="candle", n1=32, step=8, vr="hours", emoji="\U0001F56F\uFE0F",
          goal="Candle melts per hour. Hours to melt?",
          share="\U0001F56F\uFE0F Hours: 4"),
        P("while_countdown", v1="ribbon", n1=48, step=6, vr="bows", emoji="\U0001F380",
          goal="Use ribbon per bow. Bows tied?",
          share="\U0001F380 Bows: 8"),
        P("while_countdown", v1="seeds", n1=44, step=11, vr="rows", emoji="\U0001F33F",
          goal="Plant seeds per row. Rows planted?",
          share="\U0001F33F Rows: 4"),
        P("while_accum", v1="rate", n1=3, vr="output", step=1, limit=7, emoji="\U0001F3ED",
          goal="A factory improves its production rate each shift. Total output?",
          share="\U0001F3ED Shift over!\nOutput: 42"),
        P("while_accum", v1="dose", n1=6, vr="absorbed", step=3, limit=4, emoji="\U0001F489",
          goal="Each round of treatment increases the dose. Total absorbed?",
          share="\U0001F489 Treatment done!\nAbsorbed: 42"),
        P("if_else_calc", v1="rain", n1=20, v2="sun", n2=10, cmp_op="<", cmp_val=25, vr="crop", vi="sky",
          true_op="+", false_op="-", emoji="\U0001F327\uFE0F",
          goal="Check the forecast. Wet season? Rain helps the crops. Dry? Sun scorches them. Harvest?",
          share="\U0001F327\uFE0F Season's harvest!\nCrops gathered"),
        P("if_else_calc", v1="thunder", n1=10, v2="lightning", n2=15, cmp_op="<", cmp_val=20, vr="storm", vi="weather",
          true_op="+", false_op="-", emoji="\u26C8\uFE0F",
          goal="Storm brewing! Intense enough? Thunder amplifies it. Mild? Lightning dissipates. Storm power?",
          share="\u26C8\uFE0F Storm passed!\nPower measured"),
        P("while_if_else", v1="ice", n1=36, v2="sun", n2=12, vr="days",
          loop_v="ice", loop_op=">", loop_val=0,
          if_v="sun", if_op=">", if_val=6,
          true_v="ice", true_op="-", true_val=10,
          false_v="ice", false_op="-", false_val=3,
          dec_v="sun", dec_op="-", dec_val=2, emoji="\u2744\uFE0F",
          goal="A glacier melts in the sun. Intense sun melts it fast, but the sun fades each day. How many days until it's gone?",
          share="\u2744\uFE0F Glacier gone!\nMelted in 5 days", diff="hard"),
        P("for_accum", vr="candles", n_end=7, k=3, emoji="\U0001F56F\uFE0F",
          goal="Light candles each night. Total candles lit?",
          share="\U0001F56F\uFE0F Lit: 21 candles!"),
        P("while_counter", v1="petals", n1=6, vr="total", limit=5, emoji="\U0001F33A",
          goal="Pick petals per flower. How many total?",
          share="\U0001F33A Petals: 30"),
        P("while_mul", v1="snowball", n1=1, mul=3, limit=4, vr="rolls", emoji="\u26C4",
          goal="Snowball triples each roll. Final size?",
          share="\u26C4 Snowball: 81"),
        P("while_mul", v1="mold", n1=3, mul=3, limit=3, vr="days", emoji="\U0001F344",
          goal="Mold triples each day. Final amount?",
          share="\U0001F344 Mold: 81"),
        P("for_custom_start", vr="supplies", v_start=100, n_end=6, k_op="-", k_val=12, emoji="\U0001F3D5\uFE0F",
          goal="Start a camping trip with supplies and use some per outing. How many supplies remain?",
          share="\U0001F3D5\uFE0F Supplies: 28!"),
    ]

@theme("art")
def theme_art():
    return [
        P("arith_multi_step", v1="red", n1=10, v2="green", n2=6, vi="yellow", op1="+", v3="blue", n3=2, vr="paint", op2="*", emoji="\U0001F3A8",
          goal="Blend red and green to make yellow, then mix with blue. How much paint?",
          share="\U0001F3A8 Colors mixed!\n32 units of paint"),
        P("if_else_calc", v1="red", n1=10, v2="blue", n2=15, cmp_op="<", cmp_val=20, vr="shade", vi="palette",
          true_op="+", false_op="-", emoji="\U0001F3A8",
          goal="An artist blends colors. Cool palette? Add warm red. Too warm? Cut back the blue. Final shade?",
          share="\U0001F3A8 Color mixed!\nShade created"),
        P("while_decay", v1="paint", n1=0, v2="brush", n2=13, vr="strokes",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=1,
          emoji="\U0001F58C\uFE0F", goal="An artist's brush thins with each stroke. Total paint applied before it's too thin?",
          share="\U0001F58C\uFE0F Canvas done!\nPaint: 40", diff="hard"),
        P("for_two_var", vr="paint", v2="strokes", v2_start=4, n_end=6, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F58C\uFE0F",
          goal="An artist's brush strokes widen each pass. Total paint applied?",
          share="\U0001F58C\uFE0F Painted: 54!"),
        P("while_counter", v1="paint", n1=4, vr="coats", limit=8, emoji="\U0001F3A8",
          goal="Apply coats per layer. How many coats total?",
          share="\U0001F3A8 Coverage: 32"),
        P("while_countdown", v1="paint", n1=27, step=9, vr="rooms", emoji="\U0001F58C\uFE0F",
          goal="Use paint per room. Rooms painted?",
          share="\U0001F58C\uFE0F Rooms: 3"),
        P("for_accum", vr="stitches", n_end=6, k=8, emoji="\U0001F9F5",
          goal="Sew stitches per panel. Total stitches?",
          share="\U0001F9F5 Sewn: 48 stitches!"),
        P("while_counter", v1="stitches", n1=15, vr="total", limit=3, emoji="\U0001F9F5",
          goal="Sew stitches per patch. How many total?",
          share="\U0001F9F5 Stitches: 45"),
        P("while_countdown", v1="thread", n1=28, step=4, vr="seams", emoji="\U0001FAA1",
          goal="Use thread per seam. Seams sewn?",
          share="\U0001FAA1 Seams: 7"),
        P("while_countdown", v1="wool", n1=21, step=3, vr="scarves", emoji="\U0001F9E3",
          goal="Use wool per scarf. Scarves knitted?",
          share="\U0001F9E3 Scarves: 7"),
        P("for_triangular", vr="claps", n_end=4, emoji="\U0001F44F",
          goal="Audience claps more after each song. Total claps?",
          share="\U0001F44F Applause: 10 claps!"),
        P("for_accum", vr="pages", n_end=5, k=12, emoji="\U0001F4D6",
          goal="Read pages each night. Total pages read?",
          share="\U0001F4D6 Read: 60 pages!"),
        P("if_else_simple", v1="morale", n1=70, v2="threshold", n2=50, cmp_op=">", vr="bonus",
          true_v="morale", true_op="+", true_arg=20, false_v="morale", false_op="-", false_arg=10,
          emoji="\U0001F389", goal="Spirits high? Throw a party! Low? Tough week ahead. Final bonus?",
          share="\U0001F389 Party time!\nMorale: 90"),
        P("while_counter", v1="lines", n1=8, vr="total", limit=6, emoji="\U0001F4DD",
          goal="Write lines per page. How many total?",
          share="\U0001F4DD Lines: 48"),
        P("for_triangular", vr="likes", n_end=8, emoji="\u2764\uFE0F",
          goal="Get increasing likes each hour. Total likes?",
          share="\u2764\uFE0F Likes: 36!"),
        P("while_if", v1="ink", n1=32, v2="color", n2=8, vr="pages",
          loop_cond_v="ink", loop_cond_op=">", loop_cond_val=0,
          if_v="color", if_op=">", if_val=2, if_body_v="color", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001F58C\uFE0F",
          goal="An artist uses ink each page. Color depth fades with each pass. How many pages before ink runs out?",
          share="\U0001F58C\uFE0F Masterpiece!\nPages completed", diff="hard"),
        P("while_if_else", v1="talent", n1=10, v2="audience", n2=50, vr="shows",
          loop_v="audience", loop_op=">", loop_val=10,
          if_v="talent", if_op=">", if_val=5,
          true_v="audience", true_op="-", true_val=5,
          false_v="audience", false_op="-", false_val=15,
          dec_v="talent", dec_op="-", dec_val=2, emoji="\U0001F3AD",
          goal="A performer gives shows. High talent means the audience leaves slowly, but talent fades each show. How many shows?",
          share="\U0001F3AD Final curtain!\nN shows performed", diff="hard"),
    ]

@theme("gaming")
def theme_gaming():
    return [
        P("for_if", vr="xp", n_end=6, threshold=2, emoji="\U0001F47E",
          goal="Fight monsters. Only the tough ones award XP equal to their level. Total XP?",
          share="\U0001F47E XP: 18!"),
        P("for_if", vr="power", n_end=9, threshold=5, emoji="\u26A1",
          goal="A machine runs cycles. The first ones are warm-up, but each one after generates power equal to its number. Total power?",
          share="\u26A1 Power: 30!"),
        P("for_accum", vr="xp", n_end=4, k=15, emoji="\U0001F47E",
          goal="Defeat monsters worth XP each. Total XP?",
          share="\U0001F47E XP: 60!"),
        P("for_custom_start", vr="score", v_start=100, n_end=3, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with points. Earn bonus points each round. Final score?",
          share="\U0001F3AE Score: 115!"),
        P("while_counter", v1="step", n1=8, vr="distance", limit=5, emoji="\U0001F6B6",
          goal="Walk a set number of units per step. Distance traveled?",
          share="\U0001F6B6 Walked: 40 units"),
        P("while_counter", v1="scoops", n1=2, vr="total", limit=6, emoji="\U0001F366",
          goal="Scoops per cone, several cones. How many total?",
          share="\U0001F366 Scoops: 12"),
        P("while_counter", v1="sparks", n1=5, vr="total", limit=6, emoji="\U0001F386",
          goal="Each firework has sparks. How many total?",
          share="\U0001F386 Sparks: 30"),
        P("for_triangular", vr="gifts", n_end=5, emoji="\U0001F381",
          goal="Each day of a holiday you give that day's number in gifts. Total gifts?",
          share="\U0001F381 Gifted: 15 presents!"),
        P("if_else_simple", v1="score", n1=80, v2="passing", n2=70, cmp_op=">", vr="grade",
          true_v="score", true_op="+", true_arg=10, false_v="score", false_op="-", false_arg=20,
          emoji="\U0001F4AF", goal="Final exam day! Pass and get bonus points. Fail and lose points. What's the grade?",
          share="\U0001F4AF Passed!\nGrade: 90"),
        P("for_if", vr="saves", n_end=5, threshold=3, emoji="\U0001F3AE",
          goal="A goalkeeper faces shots: hard ones are tougher. Saves after all rounds?",
          share="\U0001F3AE Saved!"),
        P("for_if", vr="snacks", n_end=6, threshold=3, emoji="\U0001F36C",
          goal="Hand out snacks: big kids get extra, little ones get some. Total snacks?",
          share="\U0001F36C Shared!"),
        P("for_triangular", vr="stacks", n_end=8, emoji="\U0001F4DA",
          goal="Stack books: increasing amounts on each shelf. Total stacks?",
          share="\U0001F4DA Stacked: 36!"),
        P("for_triangular", vr="stars", n_end=6, emoji="\u2B50",
          goal="Earn increasing stars each level. Total stars?",
          share="\u2B50 Stars: 21!"),
        P("for_if", vr="grade", n_end=8, threshold=5, emoji="\U0001F393",
          goal="Grade homework: only problems above a threshold earn full marks. Total grade?",
          share="\U0001F393 Graded!"),
        P("for_if", vr="letters", n_end=7, threshold=3, emoji="\u2709\uFE0F",
          goal="Write letters. Only long ones count, adding the letter number. Total letters counted?",
          share="\u2709\uFE0F Letters: 22!"),
        P("while_accum", v1="output", n1=5, vr="total", step=4, limit=3, emoji="\U0001F3ED",
          goal="A factory's output increases as machines warm up. What's the total?",
          share="\U0001F3ED All shipped!\nTotal: 27"),
        P("while_if", v1="health", n1=42, v2="venom", n2=10, vr="bites",
          loop_cond_v="health", loop_cond_op=">", loop_cond_val=0,
          if_v="venom", if_op=">", if_val=4, if_body_v="venom", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F47E",
          goal="A game character takes poison bites. Antidote weakens the poison over time. How many bites before defeat?",
          share="\U0001F47E Game over!\nN ticks survived", diff="hard"),
        P("while_if_else", v1="luck", n1=12, v2="coins", n2=60, vr="flips",
          loop_v="coins", loop_op=">", loop_val=10,
          if_v="luck", if_op=">", if_val=4,
          true_v="coins", true_op="-", true_val=5,
          false_v="coins", false_op="-", false_val=15,
          dec_v="luck", dec_op="-", dec_val=2, emoji="\U0001F3B0",
          goal="A gambler flips coins. High luck means small losses, but luck fades each flip. How many flips until broke?",
          share="\U0001F3B0 Bust!\n6 flips played", diff="hard"),
    ]

@theme("animals")
def theme_animals():
    return [
        P("for_multiply", vr="swarm", n_end=3, k=5, emoji="\U0001F41D",
          goal="A bee colony multiplies each month. Final swarm size?",
          share="\U0001F41D Swarm: 125!"),
        P("while_mul", v1="rumor", n1=3, mul=3, limit=3, vr="days", emoji="\U0001F5E3\uFE0F",
          goal="Rumor triples each day. How far has it spread?",
          share="\U0001F5E3\uFE0F Rumor: 81"),
        P("while_mul", v1="fission", n1=4, mul=2, limit=3, vr="splits", emoji="\u2622\uFE0F",
          goal="Atoms undergo fission, doubling each split. Result?",
          share="\u2622\uFE0F Particles: 32"),
        P("while_if", v1="health", n1=49, v2="venom", n2=10, vr="bites",
          loop_cond_v="health", loop_cond_op=">", loop_cond_val=0,
          if_v="venom", if_op=">", if_val=4, if_body_v="venom", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F40D",
          goal="A snake bites the explorer! Each bite drains health, but antivenom weakens the poison. Bites survived?",
          share="\U0001F40D Survived!\n7 bites endured", diff="hard"),
        P("while_if", v1="sanity", n1=30, v2="horror", n2=10, vr="rooms",
          loop_cond_v="sanity", loop_cond_op=">", loop_cond_val=0,
          if_v="horror", if_op=">", if_val=4, if_body_v="horror", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F47B",
          goal="Exploring a haunted mansion! Each room drains sanity. The horror lessens deeper in. Rooms explored?",
          share="\U0001F47B Escaped!\n5 rooms survived", diff="hard"),
        P("while_two_var", v1="brew", n1=0, v2="hops", n2=24, op1="+", step1=4, op2="-", step2=4,
          cond_v="hops", cond_op=">", cond_val="0", ret_v="brew",
          emoji="\U0001F37A", goal="A brewer uses hops each batch. How much brew when the hops are gone?",
          share="\U0001F37A Cheers!\nBrew: 24"),
        P("while_two_var", v1="output", n1=0, v2="input", n2=48, op1="+", step1=12, op2="-", step2=12,
          cond_v="input", cond_op=">", cond_val="0", ret_v="output",
          emoji="\U0001F3ED", goal="A factory processes raw input into finished output. Total output when input runs out?",
          share="\U0001F3ED Production done!\nOutput: 48"),
        P("for_triangular", vr="steps", n_end=6, emoji="\U0001F3E2",
          goal="You climb a staircase. Each floor needs one more step than the last. Total steps?",
          share="\U0001F3E2 Climbed: 21 steps!"),
        P("while_accum", v1="speed", n1=5, vr="distance", step=3, limit=5, emoji="\U0001F697",
          goal="A car accelerates each tick. Total distance traveled?",
          share="\U0001F697 Road trip!\nDistance: 55"),
        P("while_mul", v1="chain", n1=2, mul=2, limit=4, vr="links", emoji="\U0001F517",
          goal="Chain doubles each link. Final length?",
          share="\U0001F517 Chain: 32"),
        P("while_mul", v1="plague", n1=5, mul=2, limit=3, vr="waves", emoji="\U0001F480",
          goal="Plague doubles each wave. Infected count?",
          share="\U0001F480 Infected: 40"),
        P("for_multiply", vr="zombies", n_end=4, k=3, emoji="\U0001F9DF",
          goal="Zombies triple each night. Final horde?",
          share="\U0001F9DF Horde: 81!"),
        P("for_multiply", vr="rumor", n_end=3, k=6, emoji="\U0001F5E3\uFE0F",
          goal="A rumor spreads fast. How big is the rumor?",
          share="\U0001F5E3\uFE0F Rumor: 216 people!"),
        P("for_multiply", vr="cells", n_end=2, k=5, emoji="\U0001F9EC",
          goal="A cell multiplies several times. How many cells?",
          share="\U0001F9EC Cells: 25!"),
        P("while_mul", v1="fire", n1=2, mul=2, limit=6, vr="minutes", emoji="\U0001F525",
          goal="Fire doubles every minute. Final size?",
          share="\U0001F525 Fire: 128"),
        P("while_two_var", v1="knowledge", n1=0, v2="books", n2=30, op1="+", step1=6, op2="-", step2=6,
          cond_v="books", cond_op=">", cond_val="0", ret_v="knowledge",
          emoji="\U0001F4DA", goal="A scholar reads through the library. Total knowledge gained?",
          share="\U0001F4DA Library finished!\nKnowledge: 30"),
    ]

@theme("medicine")
def theme_medicine():
    return [
        P("arith_multi_step", v1="health", n1=100, v2="poison", n2=25, vi="current", op1="-", v3="potion", n3=10, vr="final", op2="+", emoji="\U0001F48A",
          goal="A hero takes poison damage but drinks a healing potion. What's the final HP?",
          share="\U0001F48A Potion worked!\nFinal HP: 85"),
        P("while_counter", v1="dose", n1=5, vr="medicine", limit=3, emoji="\U0001F48A",
          goal="Take doses several times. Total medicine?",
          share="\U0001F48A Treatment: 15mg"),
        P("if_else_calc", v1="calcium", n1=10, v2="iron", n2=8, cmp_op=">", cmp_val=15, vr="vitamin", vi="mineral",
          true_op="+", false_op="-", emoji="\U0001F48A",
          goal="The doctor checks mineral levels. Balanced diet? Add calcium boost. Deficient? Reduce iron dose. Vitamin level?",
          share="\U0001F48A Health check!\nVitamins balanced"),
        P("while_accum", v1="dose", n1=4, vr="absorbed", step=3, limit=4, emoji="\U0001F489",
          goal="Each round of treatment increases the dose. Total absorbed?",
          share="\U0001F489 Treatment done!\nAbsorbed: 34"),
        P("if_else_simple", v1="focus", n1=45, v2="distraction", n2=30, cmp_op=">", vr="output",
          true_v="focus", true_op="+", true_arg=10, false_v="focus", false_op="-", false_arg=15,
          emoji="\U0001F9E0", goal="Can you stay focused, or do distractions win? Final output?",
          share="\U0001F9E0 In the zone!\nOutput: 55"),
        P("while_countdown", v1="candle", n1=28, step=4, vr="hours", emoji="\U0001F56F\uFE0F",
          goal="Candle melts per hour. Hours to melt?",
          share="\U0001F56F\uFE0F Hours: 7"),
        P("for_accum", vr="steps", n_end=8, k=5, emoji="\U0001F6B6",
          goal="Walk steps each minute. Total steps?",
          share="\U0001F6B6 Walked: 40 steps!"),
        P("if_else_simple", v1="xp", n1=100, v2="levelUp", n2=80, cmp_op=">", vr="tier",
          true_v="xp", true_op="+", true_arg=50, false_v="xp", false_op="-", false_arg=30,
          emoji="\u2B06\uFE0F", goal="Enough XP to level up? Massive bonus! Short? Setback. New tier?",
          share="\u2B06\uFE0F Level up!\nTier: 150"),
        P("if_else_simple", v1="rep", n1=25, v2="fame", n2=30, cmp_op="<", vr="status",
          true_v="rep", true_op="*", true_arg=2, false_v="rep", false_op="+", false_arg=5,
          emoji="\u2B50", goal="An actor auditions. Famous enough? Star power doubles! Otherwise, slow build. Status?",
          share="\u2B50 Stardom!\nStatus: 50"),
        P("if_else_simple", v1="fuel", n1=45, v2="reserve", n2=30, cmp_op=">", vr="range",
          true_v="fuel", true_op="*", true_arg=2, false_v="fuel", false_op="+", false_arg=15,
          emoji="\u26FD", goal="Road trip! Full tank means double the range. Low tank? Short drive. How far?",
          share="\u26FD Road trip!\nRange: 90 miles"),
        P("if_else_simple", v1="power", n1=90, v2="load", n2=80, cmp_op=">", vr="output",
          true_v="power", true_op="-", true_arg=30, false_v="power", false_op="+", false_arg=10,
          emoji="\U0001F50C", goal="The generator is straining! Overloaded? Shed some load. Under capacity? Boost output. Power?",
          share="\U0001F50C Load balanced!\nOutput: 60"),
        P("while_accum", v1="height", n1=2, vr="climbed", step=3, limit=4, emoji="\U0001F9D7",
          goal="A rock climber finds better grips each attempt. How high after all attempts?",
          share="\U0001F9D7 Top reached!\nClimbed: 26"),
        P("while_decay", v1="tokens", n1=0, v2="energy", n2=9, vr="laps",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A runner collects energy tokens each lap, but tires out. Total tokens before exhaustion?",
          share="\U0001F3C3 Finish line!\nTokens: 45"),
        P("for_if", vr="tips", n_end=8, threshold=3, emoji="\U0001F4B0",
          goal="Serve tables. Only big parties tip their table number. Total tips?",
          share="\U0001F4B0 Tips: 30!"),
        P("for_if", vr="stars", n_end=6, threshold=3, emoji="\u2B50",
          goal="A telescope scans sectors. Only bright sectors reveal stars equal to the sector number. Total stars?",
          share="\u2B50 Stars: 15!"),
        P("while_if", v1="dosage", n1=36, v2="toxin", n2=10, vr="rounds",
          loop_cond_v="dosage", loop_cond_op=">", loop_cond_val=0,
          if_v="toxin", if_op=">", if_val=4, if_body_v="toxin", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F489",
          goal="A patient receives treatment each round. Toxin levels drop as the body fights. Rounds until treatment complete?",
          share="\U0001F489 Treatment complete!\nN rounds", diff="hard"),
        P("while_if_else", v1="stamina", n1=10, v2="health", n2=80, vr="days",
          loop_v="health", loop_op=">", loop_val=20,
          if_v="stamina", if_op=">", if_val=4,
          true_v="health", true_op="-", true_val=8,
          false_v="health", false_op="-", false_val=18,
          dec_v="stamina", dec_op="-", dec_val=2, emoji="\U0001F48A",
          goal="A patient recovers. High stamina means slower decline, but stamina fades. Days until discharge?",
          share="\U0001F48A Discharged!\nN days in care", diff="hard"),
    ]

@theme("exploration")
def theme_exploration():
    return [
        P("while_if", v1="patience", n1=35, v2="noise", n2=12, vr="days",
          loop_cond_v="patience", loop_cond_op=">", loop_cond_val=0,
          if_v="noise", if_op=">", if_val=6, if_body_v="noise", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F624",
          goal="A writer's patience drains daily from noise. Neighbors gradually quiet down. How many days until they snap?",
          share="\U0001F624 Snapped!\n5 days of noise", diff="hard"),
        P("while_if", v1="fuel", n1=36, v2="speed", n2=12, vr="trips",
          loop_cond_v="fuel", loop_cond_op=">", loop_cond_val=0,
          if_v="speed", if_op=">", if_val=6, if_body_v="speed", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\u26FD",
          goal="A truck burns fuel each trip. At high speed, the driver gradually slows down. Total trips?",
          share="\u26FD All delivered!\n6 trips", diff="hard"),
        P("while_if", v1="stock", n1=40, v2="demand", n2=10, vr="sales",
          loop_cond_v="stock", loop_cond_op=">", loop_cond_val=0,
          if_v="demand", if_op=">", if_val=4, if_body_v="demand", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F6D2",
          goal="A shop sells inventory each cycle. High demand fades as the trend passes. Total sales cycles?",
          share="\U0001F6D2 Sold out!\n5 sales cycles", diff="hard"),
        P("for_accum", vr="sparks", n_end=5, k=9, emoji="\u2728",
          goal="A firework launches sparks each second. Total sparks?",
          share="\u2728 Show: 45 sparks!"),
        P("while_counter", v1="harvest", n1=8, vr="bushels", limit=7, emoji="\U0001F33E",
          goal="Harvest units per field. Total bushels?",
          share="\U0001F33E Harvested: 56"),
        P("while_counter", v1="laps", n1=5, vr="total", limit=4, emoji="\U0001F3CA",
          goal="Swim laps per session. How many total?",
          share="\U0001F3CA Laps: 20"),
        P("for_custom_start", vr="health", v_start=80, n_end=3, k_op="-", k_val=5, emoji="\u2764\uFE0F",
          goal="Lose health with each poison tick. Health remaining?",
          share="\u2764\uFE0F HP: 65!"),
        P("while_accum", v1="rent", n1=100, vr="spent", step=20, limit=3, emoji="\U0001F3E0",
          goal="Rent goes up each year. Total spent on housing?",
          share="\U0001F3E0 Lease up!\nHousing: $360"),
        P("if_else_simple", v1="trust", n1=20, v2="suspicion", n2=15, cmp_op=">", vr="alliance",
          true_v="trust", true_op="+", true_arg=10, false_v="trust", false_op="-", false_arg=5,
          emoji="\U0001F91D", goal="Enough trust for an alliance, or does suspicion win? Alliance strength?",
          share="\U0001F91D Alliance formed!\nTrust: 30"),
        P("while_two_var", v1="knowledge", n1=0, v2="books", n2=25, op1="+", step1=5, op2="-", step2=5,
          cond_v="books", cond_op=">", cond_val="0", ret_v="knowledge",
          emoji="\U0001F4DA", goal="A scholar reads through the library. Total knowledge gained?",
          share="\U0001F4DA Library finished!\nKnowledge: 25"),
        P("if_else_calc", v1="math", n1=9, v2="science", n2=7, cmp_op=">", cmp_val=12, vr="gpa", vi="grades",
          true_op="+", false_op="-", emoji="\U0001F393",
          goal="Report card day! Making the honor roll? Boost math score. Falling short? Science takes a hit. GPA?",
          share="\U0001F393 Report card!\nGPA calculated"),
        P("while_if_else", v1="ship", n1=80, v2="cargo", n2=18, vr="trips",
          loop_v="ship", loop_op=">", loop_val=10,
          if_v="cargo", if_op=">", if_val=5,
          true_v="ship", true_op="-", true_val=15,
          false_v="ship", false_op="-", false_val=5,
          dec_v="cargo", dec_op="-", dec_val=3, emoji="\U0001F6A2",
          goal="A cargo ship unloads each trip. Heavy cargo shrinks as it's delivered. Total trips?",
          share="\U0001F6A2 All delivered!\n5 trips completed", diff="hard"),
        P("while_decay", v1="total", n1=0, v2="boost", n2=10, vr="rounds",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F4A8", goal="A turbo boost fades each round. What's the total?",
          share="\U0001F4A8 Boost spent!\nTotal: 30"),
        P("while_decay", v1="height", n1=0, v2="jump", n2=12, vr="bounces",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F3C0", goal="A basketball bounces lower each time. Total height traveled?",
          share="\U0001F3C0 Ball stopped!\nTotal height: 30"),
        P("for_if", vr="harvest", n_end=7, threshold=3, emoji="\U0001F33E",
          goal="Harvest fields. Only mature ones produce yield equal to their number. Total harvest?",
          share="\U0001F33E Harvest: 22!"),
        P("for_if", vr="tips", n_end=7, threshold=4, emoji="\U0001F4B5",
          goal="Wait tables: big parties tip more. Total tips?",
          share="\U0001F4B5 Tips collected!"),
    ]

@theme("medieval")
def theme_medieval():
    return [
        P("arith_multi_step", v1="iron", n1=15, v2="coal", n2=5, vi="ingot", op1="+", v3="hammers", n3=2, vr="blade", op2="*", emoji="\u2694\uFE0F",
          goal="Smelt iron with coal into an ingot, then hammer it into shape. Blade quality?",
          share="\u2694\uFE0F Blade forged!\nQuality: 40"),
        P("arith_multi_step", v1="wheat", n1=20, v2="chaff", n2=8, vi="grain", op1="-", v3="mills", n3=3, vr="flour", op2="*", emoji="\U0001F33E",
          goal="Separate wheat from chaff, then grind it through the mills. How much flour?",
          share="\U0001F33E Mills grinding!\n36 bags of flour"),
        P("if_else_calc", v1="iron", n1=12, v2="coal", n2=6, cmp_op=">", cmp_val=15, vr="alloy", vi="raw",
          true_op="+", false_op="-", emoji="\u2699\uFE0F",
          goal="The blacksmith checks raw materials. Hot enough forge? Add more iron. Cold? Lose some coal. Alloy quality?",
          share="\u2699\uFE0F Alloy forged!\nQuality result"),
        P("if_else_calc", v1="knights", n1=12, v2="squires", n2=8, cmp_op=">", cmp_val=15, vr="force", vi="army",
          true_op="+", false_op="-", emoji="\U0001F3F0",
          goal="Large enough army? Recruit more knights. Small force? Send squires home. Army size?",
          share="\U0001F3F0 Army rallied!\nForce counted"),
        P("while_countdown", v1="candle", n1=20, step=5, vr="hours", emoji="\U0001F56F\uFE0F",
          goal="Candle melts per hour. Hours to melt?",
          share="\U0001F56F\uFE0F Hours: 4"),
        P("for_accum", vr="coins", n_end=5, k=4, emoji="\U0001FA99",
          goal="A pirate finds gold coins each day. How many coins total?",
          share="\U0001FA99 Treasure: 20 coins!"),
        P("while_if", v1="wood", n1=42, v2="rain", n2=14, vr="builds",
          loop_cond_v="wood", loop_cond_op=">", loop_cond_val=0,
          if_v="rain", if_op=">", if_val=4, if_body_v="rain", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FA9A",
          goal="A carpenter uses wood each build. Rainy days gradually clear up. Builds completed?",
          share="\U0001FA9A Workshop busy!\n6 builds done", diff="hard"),
        P("while_if_else", v1="morale", n1=12, v2="troops", n2=100, vr="battles",
          loop_v="troops", loop_op=">", loop_val=20,
          if_v="morale", if_op=">", if_val=5,
          true_v="troops", true_op="-", true_val=10,
          false_v="troops", false_op="-", false_val=20,
          dec_v="morale", dec_op="-", dec_val=2, emoji="\u2694\uFE0F",
          goal="An army fights battles. High morale means fewer losses, but morale drops each fight. How many battles?",
          share="\u2694\uFE0F Campaign over!\n6 battles fought", diff="hard"),
        P("for_two_var", vr="distance", v2="speed", v2_start=3, n_end=5, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F697",
          goal="A cart accelerates each tick. Total distance?",
          share="\U0001F697 Driven: 35!"),
        P("while_decay", v1="distance", n1=0, v2="speed", n2=24, vr="laps",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A runner slows each lap. Total distance?",
          share="\U0001F3C3 Race done!\nDistance: 84"),
        P("while_two_var", v1="harvest", n1=0, v2="seeds", n2=35, op1="+", step1=5, op2="-", step2=5,
          cond_v="seeds", cond_op=">", cond_val="0", ret_v="harvest",
          emoji="\U0001F33D", goal="A farmer plants seeds until the bag is empty. What's the harvest?",
          share="\U0001F33D All planted!\nHarvest: 35"),
        P("if_else_simple", v1="trust", n1=25, v2="suspicion", n2=15, cmp_op=">", vr="alliance",
          true_v="trust", true_op="+", true_arg=10, false_v="trust", false_op="-", false_arg=5,
          emoji="\U0001F91D", goal="Two kingdoms negotiate. Enough trust, or does suspicion win? Alliance strength?",
          share="\U0001F91D Alliance formed!\nTrust: 35"),
        P("for_if", vr="loot", n_end=9, threshold=4, emoji="\U0001FA99",
          goal="A dungeon has rooms. Only rooms past a certain point have treasure. Total loot?",
          share="\U0001FA99 Loot: 35!"),
        P("while_counter", v1="dose", n1=4, vr="medicine", limit=4, emoji="\U0001F48A",
          goal="Take doses several times. Total medicine?",
          share="\U0001F48A Treatment: 16mg"),
        P("if_else_calc", v1="solar", n1=18, v2="wind", n2=12, cmp_op=">", cmp_val=25, vr="watts", vi="power",
          true_op="+", false_op="-", emoji="\u2600\uFE0F",
          goal="Generating enough power? Add more solar panels. Low? Shut down some turbines. Watts?",
          share="\u2600\uFE0F Grid balanced!\nPower output"),
        P("if_else_calc", v1="coffee", n1=6, v2="tea", n2=4, cmp_op=">", cmp_val=8, vr="energy", vi="cups",
          true_op="+", false_op="-", emoji="\u2615",
          goal="Had enough cups? Pour more coffee. Not? Skip the tea. Energy level?",
          share="\u2615 Caffeinated!\nEnergy updated"),
    ]

@theme("electronics")
def theme_electronics():
    return [
        P("while_accum", v1="voltage", n1=5, vr="charge", step=3, limit=3, emoji="\u26A1",
          goal="A capacitor builds voltage faster each pulse. How much charge?",
          share="\u26A1 Charged!\nVoltage: 24"),
        P("while_mul", v1="bacteria", n1=3, mul=2, limit=5, vr="generations", emoji="\U0001F9A0",
          goal="Bacteria double each generation. Population?",
          share="\U0001F9A0 Bacteria: 96"),
        P("while_countdown", v1="wire", n1=48, step=6, vr="circuits", emoji="\U0001F50C",
          goal="Use wire per circuit. Circuits built?",
          share="\U0001F50C Circuits: 8"),
        P("for_multiply", vr="chain", n_end=4, k=2, emoji="\U0001F517",
          goal="A chain reaction doubles each step. Final reaction size?",
          share="\U0001F517 Reaction: 16!"),
        P("for_multiply", vr="ripple", n_end=5, k=2, emoji="\U0001F30A",
          goal="A ripple doubles in radius each second. Final radius?",
          share="\U0001F30A Ripple: 32!"),
        P("if_else_simple", v1="signal", n1=9, v2="noise", n2=5, cmp_op=">", vr="clarity",
          true_v="signal", true_op="*", true_arg=2, false_v="signal", false_op="-", false_arg=3,
          emoji="\U0001F4E1", goal="Clear signal? Amplify it! Static? Lose some clarity. Reception?",
          share="\U0001F4E1 Signal boosted!\nClarity: 18"),
        P("while_accum", v1="heat", n1=12, vr="energy", step=5, limit=3, emoji="\u2622\uFE0F",
          goal="A reactor's heat output increases each cycle. Total energy?",
          share="\u2622\uFE0F Reactor hot!\nEnergy: 51"),
        P("while_counter", v1="samples", n1=4, vr="total", limit=7, emoji="\U0001F52C",
          goal="Analyze samples per test. How many total?",
          share="\U0001F52C Samples: 28"),
        P("while_countdown", v1="candle", n1=24, step=4, vr="hours", emoji="\U0001F56F\uFE0F",
          goal="Candle melts per hour. Hours to melt?",
          share="\U0001F56F\uFE0F Hours: 6"),
        P("for_custom_start", vr="charge", v_start=25, n_end=5, k_op="+", k_val=12, emoji="\U0001F50B",
          goal="A battery charges each plug-in. After all plug-ins, what's the charge?",
          share="\U0001F50B Charged: 85%!"),
        P("while_decay", v1="pressure", n1=0, v2="force", n2=15, vr="cycles",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F4A5", goal="A hydraulic press loses force each cycle. Total pressure before it gives out?",
          share="\U0001F4A5 Press spent!\nPressure: 40", diff="hard"),
        P("while_if", v1="battery", n1=48, v2="signal", n2=12, vr="calls",
          loop_cond_v="battery", loop_cond_op=">", loop_cond_val=0,
          if_v="signal", if_op=">", if_val=4, if_body_v="signal", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F4F1",
          goal="A phone drains battery each call. Signal weakens as you move away. How many calls?",
          share="\U0001F4F1 Battery dead!\n8 calls made", diff="hard"),
        P("for_accum", vr="sparks", n_end=5, k=7, emoji="\u2728",
          goal="A firework launches sparks each second. Total sparks?",
          share="\u2728 Show: 35 sparks!"),
        P("if_else_calc", v1="code", n1=18, v2="tests", n2=10, cmp_op=">", cmp_val=25, vr="quality", vi="suite",
          true_op="+", false_op="-", emoji="\U0001F4BB",
          goal="Well-tested codebase? Ship features. Undertested? Cut failing tests. Quality score?",
          share="\U0001F4BB Code reviewed!\nQuality measured"),
        P("while_accum", v1="clicks", n1=3, vr="views", step=3, limit=5, emoji="\U0001F4F1",
          goal="A viral post gains more clicks each day. Total views?",
          share="\U0001F4F1 Trending!\nViews: 45"),
        P("while_mul", v1="followers", n1=5, mul=3, limit=3, vr="posts", emoji="\U0001F4F1",
          goal="Followers triple per post. Count?",
          share="\U0001F4F1 Followers: 135"),
    ]

@theme("pirates")
def theme_pirates():
    return [
        P("for_accum", vr="coins", n_end=5, k=6, emoji="\U0001FA99",
          goal="A pirate finds gold coins each day. How many coins total?",
          share="\U0001FA99 Treasure: 30 coins!"),
        P("for_triangular", vr="coins", n_end=8, emoji="\U0001FA99",
          goal="A treasure chest grows each day with increasing amounts. Total coins?",
          share="\U0001FA99 Saved: 36 coins!"),
        P("while_counter", v1="coins", n1=13, vr="total", limit=4, emoji="\U0001FA99",
          goal="Find coins per chest. How many total?",
          share="\U0001FA99 Coins: 52"),
        P("while_countdown", v1="rope", n1=40, step=8, vr="knots", emoji="\U0001FA62",
          goal="Tie rope per knot. Total knots?",
          share="\U0001FA62 Knots: 5"),
        P("while_if", v1="rope", n1=35, v2="knots", n2=8, vr="climbs",
          loop_cond_v="rope", loop_cond_op=">", loop_cond_val=0,
          if_v="knots", if_op=">", if_val=2, if_body_v="knots", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001FA62",
          goal="A climber uses rope each ascent. While knotted, they untie sections. How many climbs?",
          share="\U0001FA62 Summit reached!\n7 climbs", diff="hard"),
        P("while_two_var", v1="brew", n1=0, v2="hops", n2=30, op1="+", step1=5, op2="-", step2=5,
          cond_v="hops", cond_op=">", cond_val="0", ret_v="brew",
          emoji="\U0001F37A", goal="A brewer uses hops each batch. How much brew when hops are gone?",
          share="\U0001F37A Cheers!\nBrew: 30"),
        P("if_else_simple", v1="gold", n1=95, v2="price", n2=80, cmp_op=">", vr="remaining",
          true_v="gold", true_op="-", true_arg=80, false_v="gold", false_op="+", false_arg=10,
          emoji="\U0001F4B0", goal="Spot a legendary sword in the shop. Can you afford it? Gold remaining?",
          share="\U0001F4B0 Sword purchased!\nGold: 15"),
        P("while_countdown", v1="sand", n1=60, step=10, vr="castles", emoji="\U0001F3F0",
          goal="Use sand per castle. Castles built?",
          share="\U0001F3F0 Castles: 6"),
        P("for_if", vr="loot", n_end=7, threshold=4, emoji="\U0001FA99",
          goal="A dungeon has rooms. Only rooms past a certain point have treasure. Total loot?",
          share="\U0001FA99 Loot: 18!"),
        P("while_two_var", v1="gold", n1=0, v2="ore", n2=45, op1="+", step1=9, op2="-", step2=9,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="gold",
          emoji="\u26CF\uFE0F", goal="Miners smelt ore into gold each shift. How much gold when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nGold: 45"),
        P("if_else_calc", v1="gold", n1=30, v2="silver", n2=15, cmp_op="<", cmp_val=40, vr="vault", vi="treasure",
          true_op="+", false_op="-", emoji="\U0001FA99",
          goal="A dragon counts its hoard. Rich enough? Toss some silver out. Vault total?",
          share="\U0001FA99 Hoard counted!\nVault updated"),
        P("while_decay", v1="morale", n1=0, v2="speech", n2=8, vr="rallies",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F4E3", goal="A captain's speeches inspire less each rally. Total morale raised?",
          share="\U0001F4E3 Rally over!\nMorale: 36"),
        P("for_accum", vr="arrows", n_end=5, k=9, emoji="\U0001F3F9",
          goal="An archer fires arrows each round. Total arrows shot?",
          share="\U0001F3F9 Shot: 45 arrows!"),
        P("while_counter", v1="step", n1=7, vr="distance", limit=6, emoji="\U0001F6B6",
          goal="Walk a set number of units per step. Distance traveled?",
          share="\U0001F6B6 Walked: 42 units"),
        P("for_custom_start", vr="score", v_start=95, n_end=4, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with a score. Earn bonus each round. Final score?",
          share="\U0001F3AE Score: 115!"),
        P("while_if_else", v1="crew", n1=12, v2="rations", n2=54, vr="days",
          loop_v="rations", loop_op=">", loop_val=0,
          if_v="crew", if_op=">", if_val=6,
          true_v="crew", true_op="-", true_val=2,
          false_v="rations", false_op="-", false_val=6,
          dec_v="rations", dec_op="-", dec_val=6, emoji="\U0001F3F4\u200D\u2620\uFE0F",
          goal="A pirate crew eats rations daily. While overstaffed, some abandon ship. How many days do rations last?",
          share="\U0001F3F4\u200D\u2620\uFE0F Land ho!\nSurvived 6 days at sea", diff="hard"),
    ]


# ============================================
# Puzzle generation
# ============================================

def generate_puzzles():
    puzzles = []
    idx = 0

    def add(p):
        nonlocal idx
        puzzles.append(p)
        print(f"Puzzle {idx}: OK (output={p['output']}, movable={sum(1 for l in p['lines'] for tk in l if not tk['f'])}, par={p['par']})")
        idx += 1

    for theme_name in sorted(THEMES.keys()):
        theme_fn = THEMES[theme_name]
        configs = theme_fn()
        for cfg in configs:
            cfg["seed"] = f"parsed_{idx:03d}"
            builder = BUILDERS[cfg["type"]]
            p = builder(cfg)
            p["theme"] = theme_name
            add(p)

    # Check total count
    print(f"\nTotal puzzles generated: {len(puzzles)}")

    # Check for duplicate content hashes — every puzzle must be unique
    seen_ids = {}
    for i, p in enumerate(puzzles):
        if p["id"] in seen_ids:
            raise ValueError(
                f"Duplicate puzzle ID {p['id']}! "
                f"Puzzle {i} ({p['goal'][:50]}) has same code as "
                f"puzzle {seen_ids[p['id']]} — change variable names or values."
            )
        seen_ids[p["id"]] = i

    # Shuffle with fixed seed for even difficulty distribution
    rng = random.Random(42)
    rng.shuffle(puzzles)

    # Pin legacy puzzles (already played, days 1-5) with exact data.
    # These must be preserved byte-for-byte because players have saved
    # board states referencing these specific token layouts.
    LEGACY_PUZZLES = [
        {"lines":[[{"t":"let","y":"kw","f":1},{"t":"photos","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"0","y":"lit","f":1}],[{"t":"for","y":"kw","f":1},{"t":"i","y":"id","f":1},{"t":"=","y":"op","f":1},{"t":"1","y":"lit","f":1},{"t":"to","y":"kw","f":1},{"t":"4","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"photos","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"photos","y":"id","f":0},{"t":"+","y":"op","f":0},{"t":"9","y":"lit","f":0}],[{"t":"}","y":"pn","f":1}],[{"t":"return","y":"kw","f":1},{"t":"photos","y":"id","f":0}]],"goal":"\U0001F4F8 Take 9 photos at each of 4 landmarks. Total photos?","output":"36","validOutputs":["36"],"shareResult":"\U0001F4F8 Taken: 36 photos!","par":6,"difficulty":"medium","id":"6b16bbe0","scene":{"emoji":"\U0001F4F8","driverVar":"photos","min":0,"max":36,"label":"Photos"},"noNeg":1},
        {"lines":[[{"t":"let","y":"kw","f":1},{"t":"points","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"0","y":"lit","f":1}],[{"t":"for","y":"kw","f":1},{"t":"i","y":"id","f":1},{"t":"=","y":"op","f":1},{"t":"1","y":"lit","f":1},{"t":"to","y":"kw","f":1},{"t":"10","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"if","y":"kw","f":1},{"t":"i","y":"id","f":1},{"t":">","y":"op","f":0},{"t":"5","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"points","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"points","y":"id","f":0},{"t":"+","y":"op","f":0},{"t":"i","y":"id","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"return","y":"kw","f":1},{"t":"points","y":"id","f":0}]],"goal":"\U0001F3C5 A judge scores 10 rounds. The first 5 don't count, but each one after earns points equal to its number. Total points?","output":"40","validOutputs":["40","0"],"shareResult":"\U0001F3C5 Points: 40!","par":9,"difficulty":"medium","id":"13742abb","scene":{"emoji":"\U0001F3C5","driverVar":"points","min":0,"max":40,"label":"Points"},"noNeg":1},
        {"lines":[[{"t":"let","y":"kw","f":1},{"t":"tips","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"0","y":"lit","f":1}],[{"t":"for","y":"kw","f":1},{"t":"i","y":"id","f":1},{"t":"=","y":"op","f":1},{"t":"1","y":"lit","f":1},{"t":"to","y":"kw","f":1},{"t":"8","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"if","y":"kw","f":1},{"t":"i","y":"id","f":1},{"t":">","y":"op","f":0},{"t":"3","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"tips","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"tips","y":"id","f":0},{"t":"+","y":"op","f":0},{"t":"i","y":"id","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"return","y":"kw","f":1},{"t":"tips","y":"id","f":0}]],"goal":"\U0001F4B0 Serve 8 tables. Only big parties (table number above 3) tip their table number. Total tips?","output":"30","validOutputs":["30","0"],"shareResult":"\U0001F4B0 Tips: 30!","par":5,"difficulty":"medium","id":"2285009f","scene":{"emoji":"\U0001F4B0","driverVar":"tips","min":0,"max":30,"label":"Tips"},"noNeg":1},
        {"lines":[[{"t":"let","y":"kw","f":1},{"t":"air","y":"id","f":1},{"t":"=","y":"op","f":1},{"t":"36","y":"lit","f":0}],[{"t":"let","y":"kw","f":1},{"t":"depth","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"8","y":"lit","f":0}],[{"t":"let","y":"kw","f":1},{"t":"breaths","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"0","y":"lit","f":1}],[{"t":"while","y":"kw","f":1},{"t":"air","y":"id","f":0},{"t":">","y":"op","f":1},{"t":"0","y":"lit","f":1},{"t":"{","y":"pn","f":1}],[{"t":"if","y":"kw","f":1},{"t":"depth","y":"id","f":0},{"t":">","y":"op","f":1},{"t":"2","y":"lit","f":0},{"t":"{","y":"pn","f":1}],[{"t":"depth","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"depth","y":"id","f":0},{"t":"-","y":"op","f":1},{"t":"1","y":"lit","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"air","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"air","y":"id","f":0},{"t":"-","y":"op","f":0},{"t":"6","y":"lit","f":0}],[{"t":"breaths","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"breaths","y":"id","f":0},{"t":"+","y":"op","f":1},{"t":"1","y":"lit","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"return","y":"kw","f":1},{"t":"breaths","y":"id","f":0}]],"goal":"\U0001F93F A scuba diver uses air each breath. As the dive goes on, they slowly rise to the surface. How many breaths until air runs out?","output":"6","validOutputs":["6","18","3","4"],"shareResult":"\U0001F93F Surfaced!\n6 breaths taken","par":15,"difficulty":"hard","id":"8b795b27","scene":{"emoji":"\U0001F93F","driverVar":"breaths","min":0,"max":6,"label":"Breaths"},"noNeg":1},
        {"lines":[[{"t":"let","y":"kw","f":1},{"t":"timer","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"21","y":"lit","f":0}],[{"t":"let","y":"kw","f":1},{"t":"tick","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"3","y":"lit","f":0}],[{"t":"let","y":"kw","f":1},{"t":"alerts","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"0","y":"lit","f":1}],[{"t":"while","y":"kw","f":1},{"t":"timer","y":"id","f":0},{"t":">","y":"op","f":0},{"t":"0","y":"lit","f":1},{"t":"{","y":"pn","f":1}],[{"t":"timer","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"timer","y":"id","f":0},{"t":"-","y":"op","f":0},{"t":"tick","y":"id","f":0}],[{"t":"alerts","y":"id","f":0},{"t":"=","y":"op","f":1},{"t":"alerts","y":"id","f":0},{"t":"+","y":"op","f":1},{"t":"1","y":"lit","f":1}],[{"t":"}","y":"pn","f":1}],[{"t":"return","y":"kw","f":1},{"t":"alerts","y":"id","f":0}]],"goal":"\u23F0 Timer counts down by tick. How many alerts?","output":"7","validOutputs":["7"],"shareResult":"\u23F0 Timer done! 7 alerts","par":12,"difficulty":"medium","id":"2edd3cd4","scene":{"emoji":"\u23F0","driverVar":"alerts","min":0,"max":7,"label":"Alerts"}},
    ]
    for i, legacy in enumerate(LEGACY_PUZZLES):
        puzzles[i] = legacy

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
    lines.append("var LAUNCH_EPOCH = new Date('2026-03-19T00:00:00');")
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
