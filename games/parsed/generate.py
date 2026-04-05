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
        P("while_accum", v1="recipe", n1=3, vr="meals", step=2, limit=4, emoji="\U0001F373",
          goal="Learn new recipes each day, getting faster over time. Total meals after all days?",
          share="\U0001F373 Meals: 3+5+7+9 = 24"),
        P("if_else_simple", v1="hunger", n1=30, v2="satiety", n2=20, cmp_op=">", vr="plate",
          true_v="hunger", true_op="-", true_arg=10, false_v="hunger", false_op="+", false_arg=5,
          emoji="\U0001F354", goal="Lunchtime! If still hungry, eat a full meal. Otherwise grab a snack. What's on the plate?",
          share="\U0001F354 Lunch break!\nPlate: 20"),
        P("if_else_calc", v1="herbs", n1=6, v2="roots", n2=4, cmp_op=">", cmp_val=8, vr="remedy", vi="stew",
          true_op="+", false_op="-", emoji="\U0001F33F",
          goal="The healer brews a remedy. Strong enough ingredients? Add more herbs. Weak batch? Remove some roots. Potency?",
          share="\U0001F33F Remedy brewed!\nPotency measured"),
        P("while_accum", v1="craving", n1=2, vr="feast", step=1, limit=6, emoji="\U0001F354",
          goal="A growing puppy eats more each meal. How much feast after all meals?",
          share="\U0001F354 Stuffed!\nFeast: 27"),
        P("while_if", v1="kindle", n1=10, v2="pantry", n2=6, vr="plated",
          loop_cond_v="kindle", loop_cond_op=">", loop_cond_val=0,
          if_v="pantry", if_op=">", if_val=2, if_body_v="pantry", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=2, emoji="\U0001F525",
          goal="Burn kindle to prepare meals if pantry has food. Total plated before the kindle runs out?",
          share="\U0001F525 Campfire done!\nMeals plated!", diff="hard"),
        P("for_accum", vr="servings", n_end=5, k=8, emoji="\U0001F957",
          goal="Prepare servings for each table. Total servings made?",
          share="\U0001F957 Served: 40 plates!"),
        P("while_countdown", v1="clay", n1=45, step=9, vr="pots", emoji="\U0001FAD9",
          goal="Use clay per pot. Pots made?",
          share="\U0001FAD9 Pots: 5"),
        P("arith_chain3", v1="flour", n1=3, v2="eggs", n2=2, v3="sugar", n3=4, vr="batter", op1="*", op2="+", emoji="\U0001F370",
          goal="Mix flour and eggs together, then fold in sugar. How much batter?",
          share="\U0001F370 Batter whipped!\nMixed up 10 cups"),
        P("while_if_else", v1="soil", n1=50, v2="rain", n2=12, vr="crop",
          loop_v="soil", loop_op=">", loop_val=10,
          if_v="rain", if_op=">", if_val=4,
          true_v="crop", true_op="+", true_val=12,
          false_v="crop", false_op="+", false_val=2,
          dec_v="soil", dec_op="-", dec_val=8, emoji="\U0001F33E",
          goal="A farm harvests what the rain provides, but rain fades and soil depletes. What's the crop?",
          share="\U0001F33E Season over!\nTotal crop gathered", diff="hard"),
    ]

@theme("combat")
def theme_combat():
    return [
        P("arith_chain3", v1="strike", n1=8, v2="rage", n2=3, v3="block", n3=4, vr="wounds", op1="+", op2="-", emoji="\u2694\uFE0F",
          goal="A warrior's strike is boosted by rage, but the enemy blocks. How many wounds land?",
          share="\u2694\uFE0F Critical hit!\n8 + 3 rage - 4 blocked = 7 wounds"),
        P("arith_multi_step", v1="atk", n1=12, v2="armor", n2=4, vi="raw", op1="-", v3="crit", n3=3, vr="fury", op2="*", emoji="\U0001F4A5",
          goal="Attack power minus enemy armor, then land a critical hit. Total fury?",
          share="\U0001F4A5 Critical strike!\n24 fury dealt"),
        P("if_else_simple", v1="vigor", n1=15, v2="limit", n2=10, cmp_op=">", vr="might",
          true_v="vigor", true_op="+", true_arg=5, false_v="vigor", false_op="-", false_arg=3,
          emoji="\U0001F4AA", goal="A hero lifts a boulder. If vigorous enough, they gain might. Otherwise they strain. What's their might?",
          share="\U0001F4AA Powered up!\nMight: 20"),
        P("if_else_simple", v1="level", n1=10, v2="boss", n2=8, cmp_op=">", vr="slain",
          true_v="level", true_op="*", true_arg=2, false_v="level", false_op="-", false_arg=3,
          emoji="\U0001F47E", goal="You encounter the boss! If your level is higher, deal double damage. Otherwise take a hit. Slain?",
          share="\U0001F47E Victory!\nSlain: 20"),
        P("if_else_simple", v1="armor", n1=35, v2="strike", n2=20, cmp_op=">", vr="parry",
          true_v="armor", true_op="-", true_arg=20, false_v="armor", false_op="+", false_arg=10,
          emoji="\U0001F6E1\uFE0F", goal="The knight braces for impact. Armor strong enough to absorb the blow, or reinforce it? Parry value?",
          share="\U0001F6E1\uFE0F Blow absorbed!\nArmor: 15"),
        P("while_two_var", v1="muscle", n1=0, v2="protein", n2=40, op1="+", step1=8, op2="-", step2=8,
          cond_v="protein", cond_op=">", cond_val="0", ret_v="muscle",
          emoji="\U0001F4AA", goal="An athlete converts protein into muscle each session. How much muscle when protein runs out?",
          share="\U0001F4AA Gains!\nMuscle: 40"),
        P("while_decay", v1="wounds", n1=0, v2="fury", n2=8, vr="swings",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\u2694\uFE0F", goal="A warrior tires with each swing, losing fury per attack. Total wounds dealt before exhaustion?",
          share="\u2694\uFE0F Battle over!\nWounds: 20"),
        P("while_if", v1="stamina", n1=35, v2="shield", n2=20, vr="hits",
          loop_cond_v="stamina", loop_cond_op=">", loop_cond_val=0,
          if_v="shield", if_op=">", if_val=5, if_body_v="shield", if_body_op="-", if_body_val=3,
          v1_op="-", v1_step=7, emoji="\u26A1",
          goal="A fighter takes hits that drain stamina. While shields hold, they absorb some damage. How many hits before collapse?",
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
        P("for_accum", vr="volleys", n_end=4, k=9, emoji="\U0001F3F9",
          goal="An archer fires volleys each round. Total volleys shot after all rounds?",
          share="\U0001F3F9 Shot: 36 volleys!"),
        P("while_decay", v1="carnage", n1=0, v2="combo", n2=9, vr="hits",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F3AE", goal="A combo multiplier drops with each hit. Total carnage before the combo breaks?",
          share="\U0001F3AE Combo broken!\nCarnage: 18"),
        P("for_if", vr="spoils", n_end=8, threshold=3, emoji="\U0001FA99",
          goal="A dungeon has rooms. Only rooms past a certain point have treasure. Collect room numbers as spoils. Total spoils?",
          share="\U0001FA99 Spoils: 30!"),
        P("if_else_simple", v1="ammo", n1=8, v2="clip", n2=6, cmp_op=">", vr="rounds",
          true_v="ammo", true_op="-", true_arg=3, false_v="ammo", false_op="+", false_arg=4,
          emoji="\U0001F52B", goal="The soldier checks the clip. Full? Fire a burst. Empty? Reload first. Rounds remaining?",
          share="\U0001F52B Shots fired!\nRounds: 5"),
        P("while_two_var", v1="thrust", n1=0, v2="fuel", n2=50, op1="+", step1=10, op2="-", step2=10,
          cond_v="fuel", cond_op=">", cond_val="0", ret_v="thrust",
          emoji="\U0001F680", goal="A rocket burns fuel to build thrust each tick. How much thrust when the tank is empty?",
          share="\U0001F680 Launched!\nThrust: 50"),
        P("for_two_var", vr="carnage", v2="fury", v2_start=12, n_end=4, vr_op="+", v2_op="-", v2_step=2, emoji="\u2694\uFE0F",
          goal="A warrior's fury weakens with each swing. Total carnage after all swings?",
          share="\u2694\uFE0F Carnage: 36!"),
    ]

@theme("nature")
def theme_nature():
    return [
        P("for_accum", vr="blooms", n_end=4, k=6, emoji="\U0001F33B",
          goal="Plant blooms in each row. Total blooms in the garden?",
          share="\U0001F33B Garden: 24 blooms!"),
        P("for_triangular", vr="petals", n_end=6, emoji="\U0001F33C",
          goal="A flower grows petals each day, more than the day before. Total petals on the bloom?",
          share="\U0001F33C Bloomed: 21 petals!"),
        P("for_triangular", vr="drops", n_end=10, emoji="\U0001F4A7",
          goal="A leak drips more each hour. Total drops spilled?",
          share="\U0001F4A7 Spilled: 55 drops!"),
        P("while_accum", v1="growth", n1=1, vr="roots", step=2, limit=5, emoji="\U0001F331",
          goal="A plant's growth rate increases each week. What roots after all weeks?",
          share="\U0001F331 Thriving!\nRoots: 25"),
        P("while_accum", v1="seeds", n1=6, vr="sown", step=2, limit=5, emoji="\U0001F33B",
          goal="A gardener plants more seeds each day. How many sown after all days?",
          share="\U0001F33B Garden full!\nSown: 50"),
        P("while_decay", v1="nectar", n1=0, v2="sap", n2=15, vr="seasons",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F33E", goal="A tree's sap shrinks each season as soil depletes. Total nectar across all seasons?",
          share="\U0001F33E Soil spent!\nNectar: 45"),
        P("if_else_simple", v1="rain", n1=20, v2="drought", n2=30, cmp_op="<", vr="sprout",
          true_v="rain", true_op="*", true_arg=3, false_v="rain", false_op="-", false_arg=5,
          emoji="\U0001F327\uFE0F", goal="If it's wet enough, sprouts triple. Otherwise they wither. Sprout count?",
          share="\U0001F327\uFE0F Bumper crop!\nSprouts: 60"),
        P("if_else_simple", v1="seeds", n1=15, v2="plots", n2=10, cmp_op=">", vr="pollen",
          true_v="seeds", true_op="-", true_arg=10, false_v="seeds", false_op="+", false_arg=5,
          emoji="\U0001F331", goal="Enough garden plots? Plant the seeds. Too few? Save them for later. Pollen yield?",
          share="\U0001F331 Planted!\nPollen: 5"),
        P("if_else_calc", v1="wolves", n1=5, v2="sheep", n2=15, cmp_op=">", cmp_val=15, vr="herd", vi="pack",
          true_op="+", false_op="-", emoji="\U0001F43A",
          goal="The wolf pack eyes the flock. Big enough pack? They hunt. Too small? Sheep scatter. What happens to the herd?",
          share="\U0001F43A Nature's balance!\nHerd changed"),
        P("for_multiply", vr="spores", n_end=4, k=2, emoji="\U0001F9A0",
          goal="A cell divides: its spores double each cycle. Final spores?",
          share="\U0001F9A0 Grown: 16!"),
        P("while_accum", v1="dew", n1=5, vr="basin", step=2, limit=6, emoji="\U0001F327\uFE0F",
          goal="Monsoon season! Dew increases each day. How much basin water fills up?",
          share="\U0001F327\uFE0F Cistern full!\nBasin: 60"),
        P("for_accum", vr="seeds", n_end=7, k=4, emoji="\U0001F331",
          goal="Plant seeds in each pot. How many seeds total?",
          share="\U0001F331 Planted: 28 seeds!"),
        P("while_if", v1="water", n1=45, v2="vines", n2=8, vr="reaps",
          loop_cond_v="water", loop_cond_op=">", loop_cond_val=0,
          if_v="vines", if_op=">", if_val=2, if_body_v="vines", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=9, emoji="\U0001F4A7",
          goal="A farmer waters vines each reap, but some wilt over time. How many reaps until the well runs dry?",
          share="\U0001F4A7 Well dry!\n5 reaps gathered", diff="hard"),
        P("while_if", v1="seeds", n1=30, v2="pests", n2=8, vr="beds",
          loop_cond_v="seeds", loop_cond_op=">", loop_cond_val=0,
          if_v="pests", if_op=">", if_val=3, if_body_v="pests", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=6, emoji="\U0001F331",
          goal="A gardener uses seeds each bed. Pest control slowly eliminates the bugs. Total beds planted?",
          share="\U0001F331 Garden blooming!\n5 beds", diff="hard"),
        P("while_decay", v1="erosion", n1=0, v2="gale", n2=11, vr="storms",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=1,
          emoji="\U0001F327\uFE0F", goal="Each storm erodes the cliffside, but gales weaken over time. Total erosion before they pass?",
          share="\U0001F327\uFE0F Storms passed!\nErosion: 40", diff="hard"),
        P("for_two_var", vr="forage", v2="bloom", v2_start=10, n_end=3, vr_op="+", v2_op="-", v2_step=2, emoji="\U0001F33E",
          goal="Each season the bloom drops. Total forage over all seasons?",
          share="\U0001F33E Foraged: 24!"),
        P("if_else_calc", v1="nectar", n1=7, v2="pollen", n2=5, cmp_op=">", cmp_val=10, vr="honey", vi="hive",
          true_op="+", false_op="-", emoji="\U0001F41D",
          goal="The bees return to the hive. Good day? Add more nectar. Poor day? Lose some pollen. Honey made?",
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
        P("for_triangular", vr="data", n_end=9, emoji="\u2B50",
          goal="Earn increasing data for each scan completed. Total data collected?",
          share="\u2B50 Data: 45!"),
        P("for_custom_start", vr="orbit", v_start=200, n_end=5, k_op="-", k_val=15, emoji="\U0001F6AC",
          goal="A hot air balloon descends steadily each minute. Orbit altitude after all minutes?",
          share="\U0001F6AC Orbit: 125 feet!"),
        P("for_two_var", vr="orbit", v2="thrust", v2_start=20, n_end=3, vr_op="+", v2_op="-", v2_step=5, emoji="\U0001F680",
          goal="A rocket's thrust drops with each burn. Total orbit gained after all burns?",
          share="\U0001F680 Orbit: 45!"),
        P("if_else_simple", v1="oxygen", n1=80, v2="limit", n2=60, cmp_op=">", vr="payload",
          true_v="oxygen", true_op="-", true_arg=25, false_v="oxygen", false_op="+", false_arg=15,
          emoji="\U0001F4A8", goal="The astronaut checks O2 levels. Enough to sprint to the airlock, or rest and conserve? Payload supply?",
          share="\U0001F4A8 Made it!\nPayload: 55"),
        P("while_accum", v1="burn", n1=10, vr="range", step=4, limit=4, emoji="\U0001F6F0\uFE0F",
          goal="Thrust increases with each burn. Total range traveled?",
          share="\U0001F6F0\uFE0F Orbit: range reached"),
        P("while_mul", v1="pulse", n1=1, mul=2, limit=7, vr="ticks", emoji="\U0001F30A",
          goal="A pulse doubles in radius each tick. Final radius?",
          share="\U0001F30A Pulse: 128!"),
        P("while_counter", v1="probe", n1=15, vr="scans", limit=4, emoji="\u2B50",
          goal="A probe scans per orbit, several orbits. What's the scans total?",
          share="\u2B50 Scans: 60"),
        P("for_multiply", vr="reactor", n_end=5, k=2, emoji="\u26A1",
          goal="A reactor doubles its output each stage. Final reactor output?",
          share="\u26A1 Reactor: 32!"),
        P("while_if", v1="air", n1=36, v2="depth", n2=8, vr="breaths",
          loop_cond_v="air", loop_cond_op=">", loop_cond_val=0,
          if_v="depth", if_op=">", if_val=2, if_body_v="depth", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=6, emoji="\U0001F93F",
          goal="A diver uses air each breath. As the dive goes on, they slowly surface. How many breaths until air runs out?",
          share="\U0001F93F Surfaced!\n6 breaths taken", diff="hard"),
        P("while_if", v1="cell", n1=40, v2="signal", n2=12, vr="pings",
          loop_cond_v="cell", loop_cond_op=">", loop_cond_val=0,
          if_v="signal", if_op=">", if_val=4, if_body_v="signal", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F4F1",
          goal="A satellite drains its cell each ping. Strong signal weakens over distance. How many pings?",
          share="\U0001F4F1 Cell dead!\n5 pings sent", diff="hard"),
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
        P("while_accum", v1="gravity", n1=3, vr="plunge", step=2, limit=4, emoji="\U0001F30D",
          goal="A rock falls faster each second as gravity pulls harder. What plunge depth after all seconds?",
          share="\U0001F30D Splash!\nPlunge: 24"),
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
        P("for_custom_start", vr="ledger", v_start=90, n_end=4, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with points on the ledger. Earn bonus each round. Final ledger?",
          share="\U0001F3AE Ledger: 110!"),
        P("while_counter", v1="deposit", n1=25, vr="savings", limit=6, emoji="\U0001F4B5",
          goal="Deposit money each month for several months. Total savings?",
          share="\U0001F4B5 Saved: $150"),
        P("while_accum", v1="wage", n1=10, vr="earned", step=5, limit=4, emoji="\U0001F4B0",
          goal="A worker's wage increases each pay period. Total earned after all periods?",
          share="\U0001F4B0 Payday!\nEarned: $70"),
        P("while_decay", v1="fund", n1=0, v2="income", n2=10, vr="terms",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F4B0", goal="A freelancer's income drops each term as contracts dry up. Total fund before it hits zero?",
          share="\U0001F4B0 Saved up!\nFund: 30"),
        P("if_else_simple", v1="coins", n1=90, v2="price", n2=80, cmp_op=">", vr="debt",
          true_v="coins", true_op="-", true_arg=80, false_v="coins", false_op="+", false_arg=10,
          emoji="\U0001F4B0", goal="You spot a legendary sword in the shop. Can you afford it, or do you save up? Debt status?",
          share="\U0001F4B0 Sword purchased!\nDebt: 10"),
        P("if_else_simple", v1="stocks", n1=120, v2="target", n2=100, cmp_op=">", vr="equity",
          true_v="stocks", true_op="-", true_arg=50, false_v="stocks", false_op="+", false_arg=30,
          emoji="\U0001F4C8", goal="The stock hits its target price! Time to sell for profit? Or hold? Equity value?",
          share="\U0001F4C8 Sold high!\nEquity: 70"),
        P("while_two_var", v1="profit", n1=0, v2="ore", n2=36, op1="+", step1=6, op2="-", step2=6,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="profit",
          emoji="\u26CF\uFE0F", goal="Miners haul ore each shift and smelt it into profit. How much profit when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nProfit: 36"),
        P("for_two_var", vr="profit", v2="wage", v2_start=5, n_end=4, vr_op="+", v2_op="+", v2_step=3, emoji="\U0001F4B0",
          goal="A worker's wage rises each day. Total profit earned?",
          share="\U0001F4B0 Earned: 38!"),
        P("for_two_var", vr="savings", v2="income", v2_start=15, n_end=3, vr_op="+", v2_op="+", v2_step=5, emoji="\U0001F4B8",
          goal="Income grows each month. Total saved?",
          share="\U0001F4B8 Saved: 55!"),
        P("while_if", v1="budget", n1=50, v2="staff", n2=10, vr="terms",
          loop_cond_v="budget", loop_cond_op=">", loop_cond_val=0,
          if_v="staff", if_op=">", if_val=4, if_body_v="staff", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=10, emoji="\U0001F4B8",
          goal="A startup burns budget monthly. While overstaffed, they downsize. How many terms does the money last?",
          share="\U0001F4B8 Runway gone!\n5 terms survived", diff="hard"),
        P("while_if", v1="credits", n1=25, v2="loans", n2=10, vr="dues",
          loop_cond_v="credits", loop_cond_op=">", loop_cond_val=0,
          if_v="loans", if_op=">", if_val=4, if_body_v="loans", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001F3E6",
          goal="A student makes monthly loan dues. Multiple loans get consolidated over time. Dues to pay off?",
          share="\U0001F3E6 Debt free!\n5 dues paid", diff="hard"),
        P("if_else_calc", v1="gold", n1=30, v2="silver", n2=20, cmp_op="<", cmp_val=40, vr="vault", vi="hoard",
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
          goal="Arrange notes with rests into bars, then add the tempo. What's the rhythm value?",
          share="\U0001F3B6 Music flows!\nRhythm value: 21"),
        P("for_accum", vr="chords", n_end=6, k=5, emoji="\U0001F3B5",
          goal="Play chords each measure. Total chords played?",
          share="\U0001F3B5 Music: 30 chords!"),
        P("for_triangular", vr="bows", n_end=5, emoji="\U0001F3BB",
          goal="A violinist takes bows after each piece. Total bows?",
          share="\U0001F3BB Encore: 15 bows!"),
        P("while_accum", v1="tempo", n1=60, vr="beats", step=10, limit=3, emoji="\U0001F3B6",
          goal="A DJ speeds up the tempo each verse. Total beats?",
          share="\U0001F3B6 Drop!\nBeats: 210"),
        P("while_counter", v1="notes", n1=4, vr="melody", limit=8, emoji="\U0001F3B5",
          goal="Play notes per measure, several measures. How much melody?",
          share="\U0001F3B5 Melody: 32"),
        P("while_decay", v1="tune", n1=0, v2="volume", n2=14, vr="bars",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F3B5", goal="A music box winds down, each bar quieter. Total tune played before silence?",
          share="\U0001F3B5 Song ended!\nTune: 63", diff="hard"),
        P("if_else_calc", v1="bass", n1=10, v2="treble", n2=8, cmp_op=">", cmp_val=15, vr="track", vi="audio",
          true_op="+", false_op="-", emoji="\U0001F3B5",
          goal="The DJ checks the audio levels. Loud enough? Pump up the bass. Quiet? Dial back the treble. Final track?",
          share="\U0001F3B5 Track mixed!\nPerfect balance"),
        P("if_else_calc", v1="strings", n1=6, v2="frets", n2=12, cmp_op="<", cmp_val=15, vr="pitch", vi="chord",
          true_op="+", false_op="-", emoji="\U0001F3B8",
          goal="The guitarist tunes up. Sounds good? Add more strings. Off-key? Cut some frets. Pitch quality?",
          share="\U0001F3B8 In tune!\nPitch perfected"),
        P("for_two_var", vr="melody", v2="volume", v2_start=6, n_end=5, vr_op="+", v2_op="+", v2_step=1, emoji="\U0001F3B5",
          goal="A crescendo starts at a set volume and grows each beat. Total melody power?",
          share="\U0001F3B5 Melody: 40!"),
        P("for_if", vr="riffs", n_end=8, threshold=5, emoji="\U0001F3B5",
          goal="An 8-bar solo. Only the last bars hit the high riffs. Sum of those bar numbers?",
          share="\U0001F3B5 Solo: 21!"),
        P("for_accum", vr="frames", n_end=5, k=6, emoji="\U0001F3AC",
          goal="Render frames each second. Total frames?",
          share="\U0001F3AC Rendered: 30 frames!"),
        P("while_accum", v1="talent", n1=3, vr="encore", step=2, limit=4, emoji="\U0001F31F",
          goal="An entertainer's talent grows with each show. How many encores after all shows?",
          share="\U0001F31F Star born!\nEncore: 24"),
        P("for_accum", vr="scales", n_end=4, k=8, emoji="\U0001F3B5",
          goal="Practice scales per session. How many scales total?",
          share="\U0001F3B5 Learned: 32 scales!"),
        P("while_countdown", v1="film", n1=36, step=6, vr="scenes", emoji="\U0001F3AC",
          goal="Use minutes per scene. Scenes filmed?",
          share="\U0001F3AC Scenes: 6"),
        P("for_custom_start", vr="groove", v_start=60, n_end=5, k_op="+", k_val=7, emoji="\U0001F389",
          goal="Team groove starts and each win adds motivation. Final groove?",
          share="\U0001F389 Pumped: 95!"),
        P("while_if", v1="ink", n1=32, v2="toner", n2=8, vr="sheets",
          loop_cond_v="ink", loop_cond_op=">", loop_cond_val=0,
          if_v="toner", if_op=">", if_val=2, if_body_v="toner", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=4, emoji="\U0001F5A8\uFE0F",
          goal="A printer uses ink each sheet. Toner fades with each print. How many sheets before ink runs out?",
          share="\U0001F5A8\uFE0F Ink empty!\n8 sheets printed", diff="hard"),
    ]

@theme("sports")
def theme_sports():
    return [
        P("for_accum", vr="goals", n_end=4, k=10, emoji="\U0001F3AF",
          goal="Score goals each round. Total goals after all rounds?",
          share="\U0001F3AF Score: 40 goals!"),
        P("for_accum", vr="reps", n_end=5, k=10, emoji="\U0001F4AA",
          goal="Do pushups each set. Total reps after all sets?",
          share="\U0001F4AA Workout: 50 reps!"),
        P("for_accum", vr="laps", n_end=5, k=4, emoji="\U0001F3CA",
          goal="Swim laps each session. Total laps after all sessions?",
          share="\U0001F3CA Swam: 20 laps!"),
        P("for_triangular", vr="pushups", n_end=7, emoji="\U0001F4AA",
          goal="Increasing pushups each day. Total pushups this week?",
          share="\U0001F4AA Gains: 28 pushups!"),
        P("while_counter", v1="push", n1=10, vr="sets", limit=4, emoji="\U0001F4AA",
          goal="Do pushups per set. Total sets completed?",
          share="\U0001F4AA Workout: 40 pushups"),
        P("while_counter", v1="throws", n1=9, vr="pitched", limit=3, emoji="\u26BE",
          goal="Throw pitches per inning. How many pitched total?",
          share="\u26BE Pitched: 27"),
        P("while_countdown", v1="grit", n1=36, step=9, vr="bouts", emoji="\U0001F94A",
          goal="Lose grit per bout. Bouts to exhaust?",
          share="\U0001F94A Bouts: 4"),
        P("while_decay", v1="yards", n1=0, v2="pace", n2=20, vr="splits",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A runner's pace slows each split from fatigue. Total yards before they stop?",
          share="\U0001F3C3 Race done!\nYards: 60"),
        P("if_else_simple", v1="skill", n1=8, v2="quest", n2=5, cmp_op=">", vr="medal",
          true_v="skill", true_op="*", true_arg=3, false_v="skill", false_op="+", false_arg=2,
          emoji="\U0001F3AF", goal="A skilled archer enters a tournament. Win big or get a consolation prize. What's the medal?",
          share="\U0001F3AF Bullseye!\nMedal: 24"),
        P("for_if", vr="rally", n_end=10, threshold=6, emoji="\U0001F3AF",
          goal="Play several rounds. The first ones are warm-up, but each one after rallies big. Total rally?",
          share="\U0001F3AF Bonus: 34!"),
        P("for_if", vr="goals", n_end=10, threshold=7, emoji="\U0001F3C6",
          goal="A tournament has rounds. The first ones are qualifiers, but each final awards goals equal to its number. Total goals?",
          share="\U0001F3C6 Goals: 27!"),
        P("for_two_var", vr="tally", v2="streak", v2_start=8, n_end=4, vr_op="+", v2_op="-", v2_step=1, emoji="\U0001F3AE",
          goal="A combo streak fades each hit. Total tally after all hits?",
          share="\U0001F3AE Tally: 26!"),
        P("while_decay", v1="sprint", n1=0, v2="streak", n2=8, vr="heats",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F3C0", goal="A winning streak earns sprint bonus but fades each heat. Total sprint before the streak breaks?",
          share="\U0001F3C0 Streak ended!\nSprint: 20"),
        P("for_accum", vr="laps", n_end=8, k=3, emoji="\U0001F3CA",
          goal="Swim laps each set. Total laps?",
          share="\U0001F3CA Swam: 24 laps!"),
        P("for_triangular", vr="reps", n_end=6, emoji="\U0001F3CB\uFE0F",
          goal="Increasing reps each set. Total reps?",
          share="\U0001F3CB\uFE0F Reps: 21!"),
        P("for_if", vr="goals", n_end=10, threshold=5, emoji="\U0001F3C5",
          goal="A judge scores rounds. The first ones don't count, but each one after earns goals equal to its number. Total goals?",
          share="\U0001F3C5 Goals: 40!"),
        P("while_if", v1="grit", n1=40, v2="form", n2=10, vr="sprints",
          loop_cond_v="grit", loop_cond_op=">", loop_cond_val=0,
          if_v="form", if_op=">", if_val=4, if_body_v="form", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F3C3",
          goal="A sprinter burns grit each sprint. Good form degrades over time. How many sprints before exhaustion?",
          share="\U0001F3C3 Exhausted!\nN sprints completed", diff="hard"),
        P("while_if_else", v1="drive", n1=10, v2="stamina", n2=80, vr="bouts",
          loop_v="stamina", loop_op=">", loop_val=10,
          if_v="drive", if_op=">", if_val=5,
          true_v="stamina", true_op="-", true_val=10,
          false_v="stamina", false_op="-", false_val=20,
          dec_v="drive", dec_op="-", dec_val=2, emoji="\U0001F94A",
          goal="A boxer fights bouts. High drive means less damage taken, but drive drops each bout. Bouts before the bell?",
          share="\U0001F94A Knockout!\nN bouts fought", diff="hard"),
    ]

@theme("science")
def theme_science():
    return [
        P("for_multiply", vr="spread", n_end=3, k=3, emoji="\U0001F5E3\uFE0F",
          goal="A rumor triples each day. How far has it spread?",
          share="\U0001F5E3\uFE0F Spread: 27!"),
        P("for_multiply", vr="echo", n_end=4, k=3, emoji="\U0001F50A",
          goal="An echo triples in volume with each bounce. Final volume?",
          share="\U0001F50A Echo: 81!"),
        P("while_mul", v1="microbe", n1=2, mul=2, limit=6, vr="gens", emoji="\U0001F9A0",
          goal="Microbes double each generation. Final population?",
          share="\U0001F9A0 Microbes: 128"),
        P("while_mul", v1="virus", n1=1, mul=4, limit=4, vr="epochs", emoji="\U0001F9A0",
          goal="Virus quadruples every epoch. Final count?",
          share="\U0001F9A0 Virus: 256"),
        P("while_mul", v1="echo", n1=2, mul=3, limit=4, vr="bounces", emoji="\U0001F50A",
          goal="Echo triples with each bounce. Final volume?",
          share="\U0001F50A Echo: 162"),
        P("if_else_calc", v1="atoms", n1=15, v2="bonds", n2=9, cmp_op=">", cmp_val=20, vr="plasma", vi="matter",
          true_op="+", false_op="-", emoji="\u269B\uFE0F",
          goal="The chemist checks the compound. Stable enough? Add more atoms. Unstable? Break some bonds. Plasma level?",
          share="\u269B\uFE0F Reaction complete!\nPlasma formed"),
        P("while_counter", v1="samples", n1=3, vr="assays", limit=7, emoji="\U0001F52C",
          goal="Analyze samples per test, several tests. How many assays?",
          share="\U0001F52C Assays: 21"),
        P("while_accum", v1="volts", n1=4, vr="flux", step=3, limit=3, emoji="\u26A1",
          goal="A capacitor builds volts faster each pulse. How much flux after all pulses?",
          share="\u26A1 Charged!\nFlux: 21"),
        P("while_accum", v1="mass", n1=10, vr="joules", step=5, limit=3, emoji="\u2622\uFE0F",
          goal="A reactor's mass output increases each cycle. Total joules?",
          share="\u2622\uFE0F Reactor hot!\nJoules: 45"),
        P("for_multiply", vr="cells", n_end=5, k=2, emoji="\U0001F9EC",
          goal="Cells divide: they double each generation. Final count?",
          share="\U0001F9EC Cells: 32!"),
        P("for_multiply", vr="lattice", n_end=3, k=5, emoji="\U0001F48E",
          goal="A crystal lattice grows several times per layer. Final size?",
          share="\U0001F48E Lattice: 125!"),
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
        P("while_decay", v1="density", n1=0, v2="force", n2=18, vr="trials",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F4A5", goal="A hydraulic press loses force each trial. Total density applied before it gives out?",
          share="\U0001F4A5 Press spent!\nDensity: 63"),
        P("for_accum", vr="sparks", n_end=5, k=8, emoji="\u2728",
          goal="A firework launches sparks each second. Total sparks?",
          share="\u2728 Show: 40 sparks!"),
        P("while_if", v1="fuel", n1=36, v2="plasma", n2=10, vr="fusions",
          loop_cond_v="fuel", loop_cond_op=">", loop_cond_val=0,
          if_v="plasma", if_op=">", if_val=4, if_body_v="plasma", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\u269B\uFE0F",
          goal="A reactor uses fuel each cycle. Plasma dissipates over time. How many fusion cycles before fuel is spent?",
          share="\u269B\uFE0F Reactor shutdown!\nN fusions", diff="hard"),
        P("while_if_else", v1="focus", n1=10, v2="sample", n2=60, vr="tests",
          loop_v="sample", loop_op=">", loop_val=10,
          if_v="focus", if_op=">", if_val=4,
          true_v="sample", true_op="-", true_val=8,
          false_v="sample", false_op="-", false_val=16,
          dec_v="focus", dec_op="-", dec_val=2, emoji="\U0001F52C",
          goal="Lab tests consume samples. High focus means less waste, but focus degrades. How many tests?",
          share="\U0001F52C Lab done!\nN tests completed", diff="hard"),
    ]

@theme("construction")
def theme_construction():
    return [
        P("for_accum", vr="bricks", n_end=6, k=4, emoji="\U0001F9F1",
          goal="A mason lays bricks each hour. Total bricks after all hours?",
          share="\U0001F9F1 Wall: 24 bricks!"),
        P("for_accum", vr="beams", n_end=4, k=7, emoji="\U0001F3D7\uFE0F",
          goal="Stack beams each layer. Total beams?",
          share="\U0001F3D7\uFE0F Built: 28 beams!"),
        P("arith_multi_step", v1="planks", n1=10, v2="bolts", n2=5, vi="frame", op1="+", v3="coat", n3=2, vr="cabin", op2="*", emoji="\U0001F3E0",
          goal="Bolt planks into a frame, then apply coats. How sturdy is the cabin?",
          share="\U0001F3E0 Cabin built!\nSturdiness: 30"),
        P("arith_multi_step", v1="logs", n1=24, v2="splits", n2=4, vi="lumber", op1="/", v3="rebar", n3=3, vr="decks", op2="+", emoji="\U0001FA9A",
          goal="Split the logs into lumber, then add rebar. How many decks?",
          share="\U0001FA9A Workshop done!\n9 decks built"),
        P("while_counter", v1="bricks", n1=12, vr="rows", limit=5, emoji="\U0001F9F1",
          goal="Lay bricks per row. How many rows?",
          share="\U0001F9F1 Rows: 60"),
        P("while_counter", v1="beams", n1=6, vr="tiers", limit=4, emoji="\U0001F3D7\uFE0F",
          goal="Stack beams per tier, several tiers. How many tiers?",
          share="\U0001F3D7\uFE0F Tiers: 24"),
        P("while_countdown", v1="sand", n1=50, step=10, vr="molds", emoji="\U0001F3F0",
          goal="Use sand buckets per mold. Molds cast?",
          share="\U0001F3F0 Molds: 5"),
        P("while_countdown", v1="marble", n1=32, step=8, vr="statues", emoji="\U0001F3DB\uFE0F",
          goal="Use marble blocks per statue. Statues carved?",
          share="\U0001F3DB\uFE0F Statues: 4"),
        P("if_else_simple", v1="lumber", n1=30, v2="need", n2=25, cmp_op=">", vr="shed",
          true_v="lumber", true_op="-", true_arg=25, false_v="lumber", false_op="+", false_arg=10,
          emoji="\U0001FA9A", goal="Enough lumber? Build the shed. Otherwise, gather more. Lumber left?",
          share="\U0001FA9A Shed built!\nLumber: 5"),
        P("if_else_calc", v1="cement", n1=15, v2="stone", n2=10, cmp_op=">", cmp_val=20, vr="fort", vi="supply",
          true_op="+", false_op="-", emoji="\U0001F3F0",
          goal="Enough supply? Add more cement. Running low? Cut back the stone. Fort strength?",
          share="\U0001F3F0 Fort built!\nStrength measured"),
        P("if_else_calc", v1="bricks", n1=20, v2="mortar", n2=8, cmp_op=">", cmp_val=22, vr="wall", vi="site",
          true_op="+", false_op="-", emoji="\U0001F9F1",
          goal="The mason checks the site. Enough to build? Stack more bricks. Running low? Use less mortar. Wall strength?",
          share="\U0001F9F1 Wall raised!\nStrength measured"),
        P("for_accum", vr="planks", n_end=7, k=3, emoji="\U0001FA9A",
          goal="Cut planks from each log. Total planks?",
          share="\U0001FA9A Cut: 21 planks!"),
        P("for_triangular", vr="tiles", n_end=5, emoji="\U0001F9E9",
          goal="Each row gets more tiles than the last. Total tiles placed?",
          share="\U0001F9E9 Tiled: 15!"),
        P("while_if", v1="lumber", n1=35, v2="delay", n2=12, vr="jobs",
          loop_cond_v="lumber", loop_cond_op=">", loop_cond_val=0,
          if_v="delay", if_op=">", if_val=4, if_body_v="delay", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001FA9A",
          goal="A carpenter uses lumber each job. Delays slow progress but gradually clear up. Jobs completed?",
          share="\U0001FA9A Workshop busy!\n7 jobs done", diff="hard"),
        P("while_if", v1="stone", n1=32, v2="cracks", n2=8, vr="slabs",
          loop_cond_v="stone", loop_cond_op=">", loop_cond_val=0,
          if_v="cracks", if_op=">", if_val=2, if_body_v="cracks", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001FAA8",
          goal="A sculptor carves stone slabs. Cracks smooth out over time. How many slabs carved?",
          share="\U0001FAA8 Masterpiece!\n4 slabs carved", diff="hard"),
        P("for_custom_start", vr="stock", v_start=30, n_end=4, k_op="+", k_val=8, emoji="\U0001F4E6",
          goal="A warehouse starts with stock and receives shipments. Total stock?",
          share="\U0001F4E6 Stock: 62!"),
        P("while_counter", v1="primer", n1=3, vr="coats", limit=8, emoji="\U0001F3A8",
          goal="Apply primer per coat. How many coats?",
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
        P("if_else_simple", v1="fathoms", n1=50, v2="limit", n2=40, cmp_op=">", vr="dive",
          true_v="fathoms", true_op="-", true_arg=10, false_v="fathoms", false_op="+", false_arg=20,
          emoji="\U0001F30A", goal="A diver checks the fathom gauge. Too deep? Time to surface. Safe? Keep exploring. Final fathoms?",
          share="\U0001F30A Surfaced!\nFathoms: 40m"),
        P("while_accum", v1="tide", n1=4, vr="coral", step=3, limit=4, emoji="\U0001F30A",
          goal="Each tide grows stronger. Total coral eroded?",
          share="\U0001F30A Shore changed!\nCoral: 34"),
        P("while_countdown", v1="rope", n1=30, step=5, vr="hitches", emoji="\U0001FA62",
          goal="Tie rope per hitch. Total hitches?",
          share="\U0001FA62 Hitches: 6"),
        P("while_mul", v1="ripple", n1=2, mul=2, limit=7, vr="seconds", emoji="\U0001F30A",
          goal="A ripple doubles each second. Final radius?",
          share="\U0001F30A Ripple: 256"),
        P("if_else_calc", v1="sails", n1=8, v2="oars", n2=6, cmp_op=">", cmp_val=10, vr="knots", vi="hull",
          true_op="+", false_op="-", emoji="\u26F5",
          goal="The captain reads the wind. Strong enough? Raise more sails. Calm seas? Stow the oars. Ship knots?",
          share="\u26F5 Anchors aweigh!\nKnots calculated"),
        P("if_else_calc", v1="fish", n1=8, v2="bait", n2=12, cmp_op="<", cmp_val=15, vr="catch", vi="tackle",
          true_op="+", false_op="-", emoji="\U0001F3A3",
          goal="The fisher checks tackle quality. Good gear? Catch more fish. Bad day? Lose some bait. Total catch?",
          share="\U0001F3A3 Day on the lake!\nCatch counted"),
        P("while_if", v1="anchor", n1=28, v2="tangles", n2=8, vr="hauls",
          loop_cond_v="anchor", loop_cond_op=">", loop_cond_val=0,
          if_v="tangles", if_op=">", if_val=2, if_body_v="tangles", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FA62",
          goal="A sailor hauls anchor each pull. While tangled, they clear sections. How many hauls?",
          share="\U0001FA62 Anchor up!\n4 hauls", diff="hard"),
        P("while_two_var", v1="kelp", n1=0, v2="current", n2=28, op1="+", step1=7, op2="-", step2=7,
          cond_v="current", cond_op=">", cond_val="0", ret_v="kelp",
          emoji="\U0001F33D", goal="Current carries kelp to shore each wave. What's the kelp collected?",
          share="\U0001F33D All gathered!\nKelp: 28"),
        P("while_two_var", v1="sonar", n1=0, v2="charge", n2=35, op1="+", step1=7, op2="-", step2=7,
          cond_v="charge", cond_op=">", cond_val="0", ret_v="sonar",
          emoji="\U0001F4E1", goal="A submarine spends charge to emit sonar each ping. Total sonar when charge dies?",
          share="\U0001F4E1 Ping over!\nSonar: 35"),
        P("for_multiply", vr="surge", n_end=6, k=2, emoji="\U0001F525",
          goal="A tidal surge doubles each hour. Final area flooded?",
          share="\U0001F525 Surge: 64!"),
        P("while_countdown", v1="wax", n1=33, step=11, vr="tapers", emoji="\U0001F56F\uFE0F",
          goal="Melt wax per taper. Tapers made?",
          share="\U0001F56F\uFE0F Tapers: 3"),
        P("for_accum", vr="harpoons", n_end=6, k=3, emoji="\U0001F3F9",
          goal="Fire harpoons each round. Total harpoons shot?",
          share="\U0001F3F9 Fired: 18 harpoons!"),
        P("while_decay", v1="warmth", n1=0, v2="flame", n2=16, vr="embers",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F525", goal="A campfire's flame weakens each round. Total warmth generated before it dies out?",
          share="\U0001F525 Fire out!\nWarmth: 40", diff="hard"),
    ]

@theme("magic")
def theme_magic():
    return [
        P("if_else_simple", v1="mana", n1=60, v2="cost", n2=40, cmp_op=">", vr="wards",
          true_v="mana", true_op="-", true_arg=40, false_v="mana", false_op="+", false_arg=20,
          emoji="\U0001FA84", goal="The wizard eyes a powerful spell. Enough mana to cast it, or meditate to recharge? Wards left?",
          share="\U0001FA84 Spell cast!\nWards: 20"),
        P("for_accum", vr="scrolls", n_end=3, k=5, emoji="\U0001F9EA",
          goal="Brew scrolls each day. Total scrolls after all days?",
          share="\U0001F9EA Scribed: 15 scrolls!"),
        P("while_two_var", v1="elixir", n1=0, v2="herbs", n2=20, op1="+", step1=4, op2="-", step2=4,
          cond_v="herbs", cond_op=">", cond_val="0", ret_v="elixir",
          emoji="\U0001F33F", goal="An alchemist brews elixirs from herbs until the supply is exhausted. How much elixir brewed?",
          share="\U0001F33F All brewed!\nElixir: 20"),
        P("while_mul", v1="rune", n1=1, mul=5, limit=3, vr="glyphs", emoji="\U0001F48E",
          goal="A rune grows several times per glyph. Final size?",
          share="\U0001F48E Rune: 125"),
        P("for_multiply", vr="swarm", n_end=3, k=4, emoji="\U0001F41D",
          goal="A bee colony multiplies each month. Final swarm size?",
          share="\U0001F41D Swarm: 64!"),
        P("if_else_simple", v1="luck", n1=7, v2="odds", n2=5, cmp_op=">", vr="boon",
          true_v="luck", true_op="*", true_arg=3, false_v="luck", false_op="+", false_arg=2,
          emoji="\U0001F340", goal="Feeling lucky? Go for the jackpot! Otherwise, play it safe. Boon?",
          share="\U0001F340 Jackpot!\nBoon: 21"),
        P("if_else_simple", v1="gem", n1=30, v2="flaw", n2=25, cmp_op=">", vr="arcane",
          true_v="gem", true_op="+", true_arg=15, false_v="gem", false_op="-", false_arg=10,
          emoji="\U0001F48E", goal="A mage examines a gem. Pure enough? Amplify its arcane power. Flawed? It shatters a bit. Arcane level?",
          share="\U0001F48E Gem amplified!\nArcane: 45"),
        P("while_decay", v1="lore", n1=0, v2="study", n2=12, vr="eons",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F9D9", goal="A sage's study intensity fades each eon. Total lore gained?",
          share="\U0001F9D9 Enlightened!\nLore: 42", diff="hard"),
        P("while_accum", v1="ritual", n1=10, vr="runes", step=5, limit=4, emoji="\U0001F3AF",
          goal="An adventurer performs increasing rituals per quest. Total runes from all quests?",
          share="\U0001F3AF Leveled up!\nRunes: 70"),
        P("for_triangular", vr="sparks", n_end=7, emoji="\U0001F525",
          goal="A forge heats up: more sparks each minute. Total sparks?",
          share="\U0001F525 Forged: 28 sparks!"),
        P("while_if", v1="clay", n1=35, v2="kiln", n2=10, vr="casts",
          loop_cond_v="clay", loop_cond_op=">", loop_cond_val=0,
          if_v="kiln", if_op=">", if_val=4, if_body_v="kiln", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FAD9",
          goal="A potter uses clay each cast. The kiln cools between batches. How many casts?",
          share="\U0001FAD9 Kiln cooled!\n5 casts done", diff="hard"),
        P("for_custom_start", vr="aura", v_start=10, n_end=3, k_op="*", k_val=2, emoji="\u2B50",
          goal="Start with aura. Double your aura with each spell. Total aura?",
          share="\u2B50 Radiant: 80!"),
        P("while_decay", v1="charm", n1=0, v2="chant", n2=6, vr="rites",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F4E3", goal="A wizard's chants weaken each rite. Total charm raised?",
          share="\U0001F4E3 Rite over!\nCharm: 21"),
        P("for_two_var", vr="sigils", v2="focus", v2_start=7, n_end=5, vr_op="+", v2_op="+", v2_step=1, emoji="\u26CF\uFE0F",
          goal="Focus intensifies each stage. Total sigils inscribed?",
          share="\u26CF\uFE0F Inscribed: 45!"),
        P("while_two_var", v1="mana", n1=0, v2="quests", n2=45, op1="+", step1=9, op2="-", step2=9,
          cond_v="quests", cond_op=">", cond_val="0", ret_v="mana",
          emoji="\u2B50", goal="An adventurer completes quests, earning mana for each one. Total mana when the quest board is empty?",
          share="\u2B50 Quest log clear!\nMana: 45"),
        P("if_else_simple", v1="karma", n1=40, v2="trial", n2=35, cmp_op=">", vr="hex",
          true_v="karma", true_op="+", true_arg=15, false_v="karma", false_op="-", false_arg=5,
          emoji="\u2696\uFE0F", goal="The monk meditates. Is karma high enough for the trial? What hex level?",
          share="\u2696\uFE0F Enlightened!\nHex: 55"),
    ]

@theme("technology")
def theme_technology():
    return [
        P("arith_chain3", v1="width", n1=5, v2="height", n2=3, v3="border", n3=4, vr="pixels", op1="+", op2="*", emoji="\U0001F5BC\uFE0F",
          goal="Combine width and height, then stretch by the border size. How many pixels?",
          share="\U0001F5BC\uFE0F Canvas stretched!\n32 pixels wide"),
        P("if_else_simple", v1="ram", n1=40, v2="cost", n2=50, cmp_op="<", vr="cache",
          true_v="ram", true_op="*", true_arg=2, false_v="ram", false_op="+", false_arg=10,
          emoji="\u26A1", goal="The robot checks its ram. Enough juice? Overcharge! Otherwise, trickle charge. Final cache?",
          share="\u26A1 Overcharged!\nCache: 80"),
        P("if_else_simple", v1="signal", n1=8, v2="noise", n2=5, cmp_op=">", vr="data",
          true_v="signal", true_op="*", true_arg=2, false_v="signal", false_op="-", false_arg=3,
          emoji="\U0001F4E1", goal="Clear signal? Amplify it! Static? Lose some data. Reception?",
          share="\U0001F4E1 Signal boosted!\nData: 16"),
        P("if_else_simple", v1="volts", n1=60, v2="limit", n2=50, cmp_op=">", vr="board",
          true_v="volts", true_op="-", true_arg=20, false_v="volts", false_op="+", false_arg=15,
          emoji="\u26A1", goal="The board hits a voltage spike! Over the limit? Blow a fuse. Under? Boost the signal. Board voltage?",
          share="\u26A1 Board adjusted!\nVolts: 40"),
        P("if_else_simple", v1="ink", n1=12, v2="paper", n2=20, cmp_op="<", vr="output",
          true_v="ink", true_op="*", true_arg=3, false_v="ink", false_op="+", false_arg=5,
          emoji="\U0001F5A8\uFE0F", goal="The printer checks ink levels. Plenty left? Print away! Low? Just a test page. Output?",
          share="\U0001F5A8\uFE0F Printed!\nOutput: 36 pages"),
        P("for_custom_start", vr="charge", v_start=20, n_end=4, k_op="+", k_val=12, emoji="\U0001F50B",
          goal="A battery starts low and charges each plug-in. After all plug-ins, what's the charge?",
          share="\U0001F50B Charged: 68%!"),
        P("while_accum", v1="clicks", n1=2, vr="views", step=3, limit=5, emoji="\U0001F4F1",
          goal="A viral post gains more clicks each day. Total views?",
          share="\U0001F4F1 Trending!\nViews: 40"),
        P("while_mul", v1="fans", n1=4, mul=2, limit=3, vr="posts", emoji="\U0001F4F1",
          goal="Fans double per post. Final count?",
          share="\U0001F4F1 Fans: 32"),
        P("while_countdown", v1="pixels", n1=60, step=12, vr="sprites", emoji="\U0001F3AE",
          goal="Use pixels per sprite. Sprites drawn?",
          share="\U0001F3AE Sprites: 5"),
        P("if_else_calc", v1="code", n1=20, v2="tests", n2=12, cmp_op=">", cmp_val=25, vr="build", vi="suite",
          true_op="+", false_op="-", emoji="\U0001F4BB",
          goal="Code review time! Well-tested codebase? Ship more features. Undertested? Cut failing tests. Build quality?",
          share="\U0001F4BB Code reviewed!\nBuild measured"),
        P("if_else_calc", v1="pixels", n1=20, v2="frames", n2=10, cmp_op=">", cmp_val=25, vr="render", vi="gpu",
          true_op="+", false_op="-", emoji="\U0001F3AC",
          goal="Rendering on the gpu! High resolution? Add more pixels. Low? Drop some frames. Render quality?",
          share="\U0001F3AC Scene rendered!\nQuality scored"),
        P("while_decay", v1="hits", n1=0, v2="hype", n2=7, vr="hours",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F5B1\uFE0F", goal="A viral post loses hype each hour. Total hits before nobody cares?",
          share="\U0001F5B1\uFE0F Trend over!\nHits: 28", diff="hard"),
        P("while_accum", v1="upvotes", n1=1, vr="rank", step=1, limit=5, emoji="\u2B50",
          goal="A post gains extra upvotes each review as word spreads. Total rank?",
          share="\u2B50 Top post!\nRank: 15"),
        P("while_countdown", v1="wire", n1=48, step=8, vr="chips", emoji="\U0001F50C",
          goal="Use wire per chip. Chips built?",
          share="\U0001F50C Chips: 6"),
        P("while_accum", v1="likes", n1=7, vr="reach", step=4, limit=4, emoji="\U0001F44D",
          goal="Each post earns more likes as the account grows. Reach gained?",
          share="\U0001F44D Going viral!\nReach: 46"),
        P("while_mul", v1="malware", n1=3, mul=3, limit=3, vr="ticks", emoji="\U0001F9A0",
          goal="Malware triples each tick. Infected nodes?",
          share="\U0001F9A0 Infected: 81"),
        P("while_if", v1="bandwidth", n1=36, v2="load", n2=10, vr="pings",
          loop_cond_v="bandwidth", loop_cond_op=">", loop_cond_val=0,
          if_v="load", if_op=">", if_val=4, if_body_v="load", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F4BB",
          goal="A server handles pings, consuming bandwidth. Load balancing improves over time. Pings before bandwidth runs out?",
          share="\U0001F4BB Server down!\nN pings served", diff="hard"),
        P("while_if_else", v1="cache", n1=12, v2="ram", n2=70, vr="ops",
          loop_v="ram", loop_op=">", loop_val=10,
          if_v="cache", if_op=">", if_val=4,
          true_v="ram", true_op="-", true_val=8,
          false_v="ram", false_op="-", false_val=18,
          dec_v="cache", dec_op="-", dec_val=2, emoji="\U0001F4BB",
          goal="A program runs ops using ram. Good cache means less ram used, but cache degrades. How many ops?",
          share="\U0001F4BB Out of memory!\n6 ops completed", diff="hard"),
    ]

@theme("mining")
def theme_mining():
    return [
        P("for_accum", vr="rubble", n_end=7, k=2, emoji="\U0001F48E",
          goal="Mine rubble each day. Total rubble after all days?",
          share="\U0001F48E Mined: 14 rubble!"),
        P("for_if", vr="ingots", n_end=7, threshold=4, emoji="\U0001F48E",
          goal="Explore shafts. Only deep shafts contain ingots equal to the shaft number. Total ingots?",
          share="\U0001F48E Ingots: 18!"),
        P("while_two_var", v1="nuggets", n1=0, v2="ore", n2=42, op1="+", step1=7, op2="-", step2=7,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="nuggets",
          emoji="\u26CF\uFE0F", goal="Miners haul ore and smelt it into nuggets. How many nuggets when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nNuggets: 42"),
        P("while_decay", v1="haul", n1=0, v2="vein", n2=10, vr="digs",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\u26CF\uFE0F", goal="A vein thins with each dig. How much haul before the vein runs out?",
          share="\u26CF\uFE0F Vein tapped!\nHaul: 30", diff="hard"),
        P("for_accum", vr="shards", n_end=4, k=3, emoji="\U0001FA99",
          goal="A miner finds crystal shards each day. How many shards total?",
          share="\U0001FA99 Treasure: 12 shards!"),
        P("while_counter", v1="cart", n1=11, vr="loads", limit=4, emoji="\U0001FA99",
          goal="Load the cart per trip, several trips. How many loads?",
          share="\U0001FA99 Loads: 44"),
        P("while_mul", v1="yeast", n1=5, mul=2, limit=3, vr="rises", emoji="\U0001F35E",
          goal="Yeast doubles each rise. Final volume?",
          share="\U0001F35E Yeast: 40"),
        P("for_two_var", vr="shaft", v2="pace", v2_start=4, n_end=5, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F697",
          goal="A cart's pace increases each tick. Total shaft depth?",
          share="\U0001F697 Dug: 40!"),
        P("while_countdown", v1="chalk", n1=20, step=4, vr="marks", emoji="\U0001F4DA",
          goal="Use chalk per mark. Total marks?",
          share="\U0001F4DA Marks: 5"),
        P("while_countdown", v1="lamp", n1=42, step=7, vr="shafts", emoji="\U0001F5A8\uFE0F",
          goal="Lamp oil fades per shaft. Shafts lit?",
          share="\U0001F5A8\uFE0F Shafts: 6"),
        P("for_triangular", vr="ore", n_end=7, emoji="\U0001FA99",
          goal="A mine yields more ore each day with deeper tunnels. Total ore?",
          share="\U0001FA99 Mined: 28 ore!"),
        P("if_else_simple", v1="dust", n1=25, v2="limit", n2=20, cmp_op=">", vr="yield",
          true_v="dust", true_op="*", true_arg=2, false_v="dust", false_op="+", false_arg=5,
          emoji="\U0001F41D", goal="Found gold dust! Enough? Double the yield! Small find? Add a little extra. Yield?",
          share="\U0001F41D Strike!\nYield: 50"),
        P("for_accum", vr="apples", n_end=6, k=5, emoji="\U0001F34E",
          goal="Pick apples from each tree. Total apples?",
          share="\U0001F34E Picked: 30 apples!"),
        P("while_accum", v1="drill", n1=8, vr="depth", step=4, limit=3, emoji="\U0001F50B",
          goal="A drill goes faster each cycle. Total depth?",
          share="\U0001F50B Drilled deep!\nDepth: 36"),
        P("while_if", v1="grit", n1=40, v2="gravel", n2=8, vr="veins",
          loop_cond_v="grit", loop_cond_op=">", loop_cond_val=0,
          if_v="gravel", if_op=">", if_val=2, if_body_v="gravel", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001F3DE\uFE0F",
          goal="A miner loses grit each vein. Rough gravel gradually clears. Veins mined?",
          share="\U0001F3DE\uFE0F Tunnel done!\n5 veins mined", diff="hard"),
        P("for_if", vr="haul", n_end=8, threshold=4, emoji="\U0001F4B0",
          goal="Work the mine for several shifts. Early ones are slow, but each productive one earns haul equal to its number. Total haul?",
          share="\U0001F4B0 Haul: 26!"),
    ]

@theme("weather")
def theme_weather():
    return [
        P("for_custom_start", vr="chill", v_start=75, n_end=3, k_op="-", k_val=5, emoji="\u2764\uFE0F",
          goal="Lose warmth with each frost tick. Chill remaining?",
          share="\u2764\uFE0F Chill: 60!"),
        P("for_custom_start", vr="frost", v_start=40, n_end=4, k_op="-", k_val=6, emoji="\u2744\uFE0F",
          goal="Frost deepens each hour. What's the frost level?",
          share="\u2744\uFE0F Chilly: 16 degrees!"),
        P("while_countdown", v1="fuel", n1=30, step=5, vr="gusts", emoji="\U0001F680",
          goal="Burn fuel each gust. How many gusts?",
          share="\U0001F680 Gusts: 6"),
        P("while_countdown", v1="wick", n1=32, step=8, vr="dusk", emoji="\U0001F56F\uFE0F",
          goal="Wick shortens per dusk. Dusks to burn out?",
          share="\U0001F56F\uFE0F Dusks: 4"),
        P("while_countdown", v1="ribbon", n1=48, step=6, vr="bows", emoji="\U0001F380",
          goal="Use ribbon per bow. Bows tied?",
          share="\U0001F380 Bows: 8"),
        P("while_countdown", v1="seeds", n1=44, step=11, vr="beds", emoji="\U0001F33F",
          goal="Plant seeds per bed. Beds planted?",
          share="\U0001F33F Beds: 4"),
        P("while_accum", v1="gust", n1=3, vr="drift", step=1, limit=7, emoji="\U0001F3ED",
          goal="Each gust pushes more snow into drifts. Total drift?",
          share="\U0001F3ED Piled up!\nDrift: 42"),
        P("while_accum", v1="haze", n1=6, vr="fog", step=3, limit=4, emoji="\U0001F489",
          goal="Each dawn the haze thickens. Total fog after all dawns?",
          share="\U0001F489 Foggy!\nFog: 42"),
        P("if_else_calc", v1="dew", n1=20, v2="sun", n2=10, cmp_op="<", cmp_val=25, vr="yield", vi="sky",
          true_op="+", false_op="-", emoji="\U0001F327\uFE0F",
          goal="Check the forecast. Wet season? Dew helps crops. Dry? Sun scorches them. Yield?",
          share="\U0001F327\uFE0F Season's yield!\nCrops gathered"),
        P("if_else_calc", v1="thunder", n1=10, v2="bolt", n2=15, cmp_op="<", cmp_val=20, vr="gale", vi="front",
          true_op="+", false_op="-", emoji="\u26C8\uFE0F",
          goal="Storm brewing! Intense enough? Thunder amplifies the gale. Mild? Bolt dissipates. Gale power?",
          share="\u26C8\uFE0F Storm passed!\nGale measured"),
        P("while_if_else", v1="ice", n1=36, v2="sun", n2=12, vr="thaws",
          loop_v="ice", loop_op=">", loop_val=0,
          if_v="sun", if_op=">", if_val=6,
          true_v="ice", true_op="-", true_val=10,
          false_v="ice", false_op="-", false_val=3,
          dec_v="sun", dec_op="-", dec_val=2, emoji="\u2744\uFE0F",
          goal="A glacier melts in the sun. Intense sun melts it fast, but the sun fades each day. How many thaws until it's gone?",
          share="\u2744\uFE0F Glacier gone!\nMelted in 5 thaws", diff="hard"),
        P("for_accum", vr="flares", n_end=7, k=3, emoji="\U0001F56F\uFE0F",
          goal="Light flares each night. Total flares lit?",
          share="\U0001F56F\uFE0F Lit: 21 flares!"),
        P("while_counter", v1="petals", n1=6, vr="picked", limit=5, emoji="\U0001F33A",
          goal="Pick petals per flower. How many picked?",
          share="\U0001F33A Picked: 30"),
        P("while_mul", v1="flurry", n1=1, mul=3, limit=4, vr="rolls", emoji="\u26C4",
          goal="Flurry triples each roll. Final size?",
          share="\u26C4 Flurry: 81"),
        P("while_mul", v1="mold", n1=3, mul=3, limit=3, vr="spores", emoji="\U0001F344",
          goal="Mold triples each spore cycle. Final amount?",
          share="\U0001F344 Mold: 81"),
        P("for_custom_start", vr="rations", v_start=100, n_end=6, k_op="-", k_val=12, emoji="\U0001F3D5\uFE0F",
          goal="Start a camping trip with rations and use some per outing. How many rations remain?",
          share="\U0001F3D5\uFE0F Rations: 28!"),
    ]

@theme("art")
def theme_art():
    return [
        P("arith_multi_step", v1="red", n1=10, v2="green", n2=6, vi="yellow", op1="+", v3="blue", n3=2, vr="canvas", op2="*", emoji="\U0001F3A8",
          goal="Blend red and green to make yellow, then mix with blue. How much canvas covered?",
          share="\U0001F3A8 Colors mixed!\n32 units of canvas"),
        P("if_else_calc", v1="red", n1=10, v2="blue", n2=15, cmp_op="<", cmp_val=20, vr="tint", vi="palette",
          true_op="+", false_op="-", emoji="\U0001F3A8",
          goal="An artist blends colors. Cool palette? Add warm red. Too warm? Cut back the blue. Final tint?",
          share="\U0001F3A8 Color mixed!\nTint created"),
        P("while_decay", v1="hue", n1=0, v2="brush", n2=13, vr="strokes",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=1,
          emoji="\U0001F58C\uFE0F", goal="An artist's brush thins with each stroke. Total hue applied before it's too thin?",
          share="\U0001F58C\uFE0F Canvas done!\nHue: 40", diff="hard"),
        P("for_two_var", vr="sketch", v2="strokes", v2_start=4, n_end=6, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F58C\uFE0F",
          goal="An artist's brush strokes widen each pass. Total sketch detail?",
          share="\U0001F58C\uFE0F Sketched: 54!"),
        P("while_counter", v1="pigment", n1=4, vr="layers", limit=8, emoji="\U0001F3A8",
          goal="Apply pigment per layer. How many layers?",
          share="\U0001F3A8 Layers: 32"),
        P("while_countdown", v1="gesso", n1=27, step=9, vr="panels", emoji="\U0001F58C\uFE0F",
          goal="Use gesso per panel. Panels primed?",
          share="\U0001F58C\uFE0F Panels: 3"),
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
        P("for_accum", vr="drafts", n_end=5, k=12, emoji="\U0001F4D6",
          goal="Write drafts each night. Total drafts done?",
          share="\U0001F4D6 Written: 60 drafts!"),
        P("if_else_simple", v1="muse", n1=70, v2="block", n2=50, cmp_op=">", vr="flair",
          true_v="muse", true_op="+", true_arg=20, false_v="muse", false_op="-", false_arg=10,
          emoji="\U0001F389", goal="Muse strong? Create freely! Blocked? Tough week ahead. Final flair?",
          share="\U0001F389 Inspired!\nFlair: 90"),
        P("while_counter", v1="verse", n1=8, vr="stanzas", limit=6, emoji="\U0001F4DD",
          goal="Write verse per stanza. How many stanzas?",
          share="\U0001F4DD Stanzas: 48"),
        P("for_triangular", vr="fans", n_end=8, emoji="\u2764\uFE0F",
          goal="Get increasing fans each hour. Total fans?",
          share="\u2764\uFE0F Fans: 36!"),
        P("while_if", v1="ink", n1=32, v2="depth", n2=8, vr="prints",
          loop_cond_v="ink", loop_cond_op=">", loop_cond_val=0,
          if_v="depth", if_op=">", if_val=2, if_body_v="depth", if_body_op="-", if_body_val=1,
          v1_op="-", v1_step=8, emoji="\U0001F58C\uFE0F",
          goal="An artist uses ink each print. Color depth fades with each pass. How many prints before ink runs out?",
          share="\U0001F58C\uFE0F Masterpiece!\nPrints completed", diff="hard"),
        P("while_if_else", v1="flair", n1=10, v2="crowd", n2=50, vr="acts",
          loop_v="crowd", loop_op=">", loop_val=10,
          if_v="flair", if_op=">", if_val=5,
          true_v="crowd", true_op="-", true_val=5,
          false_v="crowd", false_op="-", false_val=15,
          dec_v="flair", dec_op="-", dec_val=2, emoji="\U0001F3AD",
          goal="A performer gives acts. High flair means the crowd leaves slowly, but flair fades each act. How many acts?",
          share="\U0001F3AD Final curtain!\nN acts performed", diff="hard"),
    ]

@theme("gaming")
def theme_gaming():
    return [
        P("for_if", vr="gems", n_end=6, threshold=2, emoji="\U0001F47E",
          goal="Fight monsters. Only the tough ones award gems equal to their level. Total gems?",
          share="\U0001F47E Gems: 18!"),
        P("for_if", vr="combo", n_end=9, threshold=5, emoji="\u26A1",
          goal="A machine runs cycles. The first ones are warm-up, but each one after generates combo equal to its number. Total combo?",
          share="\u26A1 Combo: 30!"),
        P("for_accum", vr="coins", n_end=4, k=15, emoji="\U0001F47E",
          goal="Defeat monsters worth coins each. Total coins?",
          share="\U0001F47E Coins: 60!"),
        P("for_custom_start", vr="level", v_start=100, n_end=3, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with a level score. Earn bonus each round. Final level?",
          share="\U0001F3AE Level: 115!"),
        P("while_counter", v1="step", n1=8, vr="tiles", limit=5, emoji="\U0001F6B6",
          goal="Walk a set number of units per step. Tiles traveled?",
          share="\U0001F6B6 Walked: 40 tiles"),
        P("while_counter", v1="scoops", n1=2, vr="cones", limit=6, emoji="\U0001F366",
          goal="Scoops per cone. How many cones served?",
          share="\U0001F366 Cones: 12"),
        P("while_counter", v1="sparks", n1=5, vr="booms", limit=6, emoji="\U0001F386",
          goal="Each firework has sparks. How many booms?",
          share="\U0001F386 Booms: 30"),
        P("for_triangular", vr="gifts", n_end=5, emoji="\U0001F381",
          goal="Each day of a holiday you give that day's number in gifts. Total gifts?",
          share="\U0001F381 Gifted: 15 presents!"),
        P("if_else_simple", v1="rank", n1=80, v2="passing", n2=70, cmp_op=">", vr="badge",
          true_v="rank", true_op="+", true_arg=10, false_v="rank", false_op="-", false_arg=20,
          emoji="\U0001F4AF", goal="Final exam day! Pass rank and get bonus. Fail and lose rank. What's the badge?",
          share="\U0001F4AF Passed!\nBadge: 90"),
        P("for_if", vr="saves", n_end=5, threshold=3, emoji="\U0001F3AE",
          goal="A goalkeeper faces shots: hard ones are tougher. Saves after all rounds?",
          share="\U0001F3AE Saved!"),
        P("for_if", vr="candy", n_end=6, threshold=3, emoji="\U0001F36C",
          goal="Hand out candy: big kids get extra, little ones get some. Total candy?",
          share="\U0001F36C Shared!"),
        P("for_triangular", vr="stacks", n_end=8, emoji="\U0001F4DA",
          goal="Stack books: increasing amounts on each shelf. Total stacks?",
          share="\U0001F4DA Stacked: 36!"),
        P("for_triangular", vr="gems", n_end=6, emoji="\u2B50",
          goal="Earn increasing gems each level. Total gems?",
          share="\u2B50 Gems: 21!"),
        P("for_if", vr="marks", n_end=8, threshold=5, emoji="\U0001F393",
          goal="Grade homework: only problems above a threshold earn full marks. Total marks?",
          share="\U0001F393 Graded!"),
        P("for_if", vr="quests", n_end=7, threshold=3, emoji="\u2709\uFE0F",
          goal="Accept quests. Only long ones count, adding the quest number. Total quests counted?",
          share="\u2709\uFE0F Quests: 22!"),
        P("while_accum", v1="spawn", n1=5, vr="loot", step=4, limit=3, emoji="\U0001F3ED",
          goal="Monster spawns increase as waves warm up. What's the loot?",
          share="\U0001F3ED All looted!\nLoot: 27"),
        P("while_if", v1="lives", n1=42, v2="venom", n2=10, vr="ticks",
          loop_cond_v="lives", loop_cond_op=">", loop_cond_val=0,
          if_v="venom", if_op=">", if_val=4, if_body_v="venom", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F47E",
          goal="A game character takes poison ticks. Antidote weakens the poison over time. How many ticks before defeat?",
          share="\U0001F47E Game over!\nN ticks survived", diff="hard"),
        P("while_if_else", v1="luck", n1=12, v2="chips", n2=60, vr="bets",
          loop_v="chips", loop_op=">", loop_val=10,
          if_v="luck", if_op=">", if_val=4,
          true_v="chips", true_op="-", true_val=5,
          false_v="chips", false_op="-", false_val=15,
          dec_v="luck", dec_op="-", dec_val=2, emoji="\U0001F3B0",
          goal="A gambler bets chips. High luck means small losses, but luck fades each bet. How many bets until broke?",
          share="\U0001F3B0 Bust!\n6 bets played", diff="hard"),
    ]

@theme("animals")
def theme_animals():
    return [
        P("for_multiply", vr="herd", n_end=3, k=5, emoji="\U0001F41D",
          goal="A herd multiplies each season. Final herd size?",
          share="\U0001F41D Herd: 125!"),
        P("while_mul", v1="howl", n1=3, mul=3, limit=3, vr="nights", emoji="\U0001F5E3\uFE0F",
          goal="Howls triple each night. How far has it spread?",
          share="\U0001F5E3\uFE0F Howl: 81"),
        P("while_mul", v1="fission", n1=4, mul=2, limit=3, vr="splits", emoji="\u2622\uFE0F",
          goal="Atoms undergo fission, doubling each split. Result?",
          share="\u2622\uFE0F Particles: 32"),
        P("while_if", v1="vigor", n1=49, v2="venom", n2=10, vr="bites",
          loop_cond_v="vigor", loop_cond_op=">", loop_cond_val=0,
          if_v="venom", if_op=">", if_val=4, if_body_v="venom", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F40D",
          goal="A snake bites the explorer! Each bite drains vigor, but antivenom weakens the poison. Bites survived?",
          share="\U0001F40D Survived!\n7 bites endured", diff="hard"),
        P("while_if", v1="nerve", n1=30, v2="dread", n2=10, vr="dens",
          loop_cond_v="nerve", loop_cond_op=">", loop_cond_val=0,
          if_v="dread", if_op=">", if_val=4, if_body_v="dread", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F47B",
          goal="Exploring a den! Each den drains nerve. The dread lessens deeper in. Dens explored?",
          share="\U0001F47B Escaped!\n5 dens survived", diff="hard"),
        P("while_two_var", v1="pelts", n1=0, v2="prey", n2=24, op1="+", step1=4, op2="-", step2=4,
          cond_v="prey", cond_op=">", cond_val="0", ret_v="pelts",
          emoji="\U0001F37A", goal="A trapper hunts prey each trip. How many pelts when prey is gone?",
          share="\U0001F37A Trapped!\nPelts: 24"),
        P("while_two_var", v1="feed", n1=0, v2="forage", n2=48, op1="+", step1=12, op2="-", step2=12,
          cond_v="forage", cond_op=">", cond_val="0", ret_v="feed",
          emoji="\U0001F3ED", goal="Animals forage and convert it to feed. Total feed when forage runs out?",
          share="\U0001F3ED Foraging done!\nFeed: 48"),
        P("for_triangular", vr="tracks", n_end=6, emoji="\U0001F3E2",
          goal="Each trail has one more set of tracks than the last. Total tracks?",
          share="\U0001F3E2 Tracked: 21 tracks!"),
        P("while_accum", v1="gallop", n1=5, vr="range", step=3, limit=5, emoji="\U0001F697",
          goal="A horse gallops faster each tick. Total range covered?",
          share="\U0001F697 Galloped!\nRange: 55"),
        P("while_mul", v1="pack", n1=2, mul=2, limit=4, vr="hunts", emoji="\U0001F517",
          goal="Pack doubles each hunt. Final pack size?",
          share="\U0001F517 Pack: 32"),
        P("while_mul", v1="plague", n1=5, mul=2, limit=3, vr="waves", emoji="\U0001F480",
          goal="Plague doubles each wave. Infected count?",
          share="\U0001F480 Infected: 40"),
        P("for_multiply", vr="brood", n_end=4, k=3, emoji="\U0001F9DF",
          goal="A brood triples each night. Final brood?",
          share="\U0001F9DF Brood: 81!"),
        P("for_multiply", vr="flock", n_end=3, k=6, emoji="\U0001F5E3\uFE0F",
          goal="A flock grows fast. How big is the flock?",
          share="\U0001F5E3\uFE0F Flock: 216!"),
        P("for_multiply", vr="spawn", n_end=2, k=5, emoji="\U0001F9EC",
          goal="A creature spawns more each cycle. How many spawn?",
          share="\U0001F9EC Spawn: 25!"),
        P("while_mul", v1="blaze", n1=2, mul=2, limit=6, vr="bursts", emoji="\U0001F525",
          goal="Wildfire blazes double every burst. Final size?",
          share="\U0001F525 Blaze: 128"),
        P("while_two_var", v1="instinct", n1=0, v2="prey", n2=30, op1="+", step1=6, op2="-", step2=6,
          cond_v="prey", cond_op=">", cond_val="0", ret_v="instinct",
          emoji="\U0001F4DA", goal="A predator tracks prey through the woods. Total instinct gained?",
          share="\U0001F4DA Hunt over!\nInstinct: 30"),
    ]

@theme("medicine")
def theme_medicine():
    return [
        P("arith_multi_step", v1="pulse", n1=100, v2="toxin", n2=25, vi="vital", op1="-", v3="serum", n3=10, vr="status", op2="+", emoji="\U0001F48A",
          goal="A hero takes toxin damage but drinks a healing serum. What's the status?",
          share="\U0001F48A Serum worked!\nStatus: 85"),
        P("while_counter", v1="dose", n1=5, vr="pills", limit=3, emoji="\U0001F48A",
          goal="Take doses several times. Total pills?",
          share="\U0001F48A Treatment: 15 pills"),
        P("if_else_calc", v1="calcium", n1=10, v2="iron", n2=8, cmp_op=">", cmp_val=15, vr="plasma", vi="blood",
          true_op="+", false_op="-", emoji="\U0001F48A",
          goal="The doctor checks blood levels. Balanced diet? Add calcium boost. Deficient? Reduce iron dose. Plasma level?",
          share="\U0001F48A Health check!\nPlasma balanced"),
        P("while_accum", v1="dose", n1=4, vr="cells", step=3, limit=4, emoji="\U0001F489",
          goal="Each round of treatment increases the dose. Total cells healed?",
          share="\U0001F489 Treatment done!\nCells: 34"),
        P("if_else_simple", v1="focus", n1=45, v2="stress", n2=30, cmp_op=">", vr="clarity",
          true_v="focus", true_op="+", true_arg=10, false_v="focus", false_op="-", false_arg=15,
          emoji="\U0001F9E0", goal="Can you stay focused, or does stress win? Final clarity?",
          share="\U0001F9E0 In the zone!\nClarity: 55"),
        P("while_countdown", v1="salve", n1=28, step=4, vr="wraps", emoji="\U0001F56F\uFE0F",
          goal="Use salve per wrap. Wraps applied?",
          share="\U0001F56F\uFE0F Wraps: 7"),
        P("for_accum", vr="pulse", n_end=8, k=5, emoji="\U0001F6B6",
          goal="Check pulse each minute. Total pulse readings?",
          share="\U0001F6B6 Checked: 40 pulses!"),
        P("if_else_simple", v1="vitals", n1=100, v2="thresh", n2=80, cmp_op=">", vr="fever",
          true_v="vitals", true_op="+", true_arg=50, false_v="vitals", false_op="-", false_arg=30,
          emoji="\u2B06\uFE0F", goal="Vitals stable? Recovery bonus! Short? Setback. Fever level?",
          share="\u2B06\uFE0F Stable!\nFever: 150"),
        P("if_else_simple", v1="rep", n1=25, v2="review", n2=30, cmp_op="<", vr="cred",
          true_v="rep", true_op="*", true_arg=2, false_v="rep", false_op="+", false_arg=5,
          emoji="\u2B50", goal="A doctor gets reviewed. Good reviews? Reputation doubles! Otherwise, slow build. Cred?",
          share="\u2B50 Renowned!\nCred: 50"),
        P("if_else_simple", v1="serum", n1=45, v2="reserve", n2=30, cmp_op=">", vr="dose",
          true_v="serum", true_op="*", true_arg=2, false_v="serum", false_op="+", false_arg=15,
          emoji="\u26FD", goal="Enough serum? Double the dose. Low supply? Small dose. How much?",
          share="\u26FD Dosed!\nDose: 90"),
        P("if_else_simple", v1="oxygen", n1=90, v2="load", n2=80, cmp_op=">", vr="flow",
          true_v="oxygen", true_op="-", true_arg=30, false_v="oxygen", false_op="+", false_arg=10,
          emoji="\U0001F50C", goal="The ventilator is straining! Overloaded? Reduce flow. Under capacity? Boost it. Flow rate?",
          share="\U0001F50C Balanced!\nFlow: 60"),
        P("while_accum", v1="rehab", n1=2, vr="gains", step=3, limit=4, emoji="\U0001F9D7",
          goal="A patient in rehab improves grip each attempt. How much gains after all attempts?",
          share="\U0001F9D7 Recovery!\nGains: 26"),
        P("while_decay", v1="relief", n1=0, v2="stamina", n2=9, vr="visits",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A patient gets relief each visit, but stamina fades. Total relief before exhaustion?",
          share="\U0001F3C3 Recovered!\nRelief: 45"),
        P("for_if", vr="swabs", n_end=8, threshold=3, emoji="\U0001F4B0",
          goal="Run lab tests. Only urgent samples need swabs equal to their number. Total swabs?",
          share="\U0001F4B0 Swabs: 30!"),
        P("for_if", vr="scans", n_end=6, threshold=3, emoji="\u2B50",
          goal="A scanner checks organs. Only critical ones need scans equal to the organ number. Total scans?",
          share="\u2B50 Scans: 15!"),
        P("while_if", v1="dosage", n1=36, v2="toxin", n2=10, vr="cycles",
          loop_cond_v="dosage", loop_cond_op=">", loop_cond_val=0,
          if_v="toxin", if_op=">", if_val=4, if_body_v="toxin", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F489",
          goal="A patient receives treatment each cycle. Toxin levels drop as the body fights. Cycles until treatment complete?",
          share="\U0001F489 Treatment complete!\nN cycles", diff="hard"),
        P("while_if_else", v1="will", n1=10, v2="fever", n2=80, vr="nights",
          loop_v="fever", loop_op=">", loop_val=20,
          if_v="will", if_op=">", if_val=4,
          true_v="fever", true_op="-", true_val=8,
          false_v="fever", false_op="-", false_val=18,
          dec_v="will", dec_op="-", dec_val=2, emoji="\U0001F48A",
          goal="A patient recovers. High will means slower decline, but will fades. Nights until discharge?",
          share="\U0001F48A Discharged!\nN nights in care", diff="hard"),
    ]

@theme("exploration")
def theme_exploration():
    return [
        P("while_if", v1="resolve", n1=35, v2="noise", n2=12, vr="treks",
          loop_cond_v="resolve", loop_cond_op=">", loop_cond_val=0,
          if_v="noise", if_op=">", if_val=6, if_body_v="noise", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001F624",
          goal="An explorer's resolve drains daily from noise. It gradually quiets down. How many treks until they snap?",
          share="\U0001F624 Snapped!\n5 treks of noise", diff="hard"),
        P("while_if", v1="ration", n1=36, v2="pace", n2=12, vr="legs",
          loop_cond_v="ration", loop_cond_op=">", loop_cond_val=0,
          if_v="pace", if_op=">", if_val=6, if_body_v="pace", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\u26FD",
          goal="An explorer burns rations each leg. At fast pace, they gradually slow down. Total legs?",
          share="\u26FD All traveled!\n6 legs", diff="hard"),
        P("while_if", v1="gear", n1=40, v2="demand", n2=10, vr="camps",
          loop_cond_v="gear", loop_cond_op=">", loop_cond_val=0,
          if_v="demand", if_op=">", if_val=4, if_body_v="demand", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=8, emoji="\U0001F6D2",
          goal="A camp uses gear each cycle. High demand fades as supplies settle. Total camps?",
          share="\U0001F6D2 Camp done!\n5 camps set", diff="hard"),
        P("for_accum", vr="beacons", n_end=5, k=9, emoji="\u2728",
          goal="An explorer lights beacons each night. Total beacons?",
          share="\u2728 Signal: 45 beacons!"),
        P("while_counter", v1="forage", n1=8, vr="hauls", limit=7, emoji="\U0001F33E",
          goal="Forage units per site. Total hauls?",
          share="\U0001F33E Foraged: 56"),
        P("while_counter", v1="trek", n1=5, vr="summit", limit=4, emoji="\U0001F3CA",
          goal="Trek per summit attempt. How many summits?",
          share="\U0001F3CA Summits: 20"),
        P("for_custom_start", vr="vigor", v_start=80, n_end=3, k_op="-", k_val=5, emoji="\u2764\uFE0F",
          goal="Lose vigor with each hazard. Vigor remaining?",
          share="\u2764\uFE0F Vigor: 65!"),
        P("while_accum", v1="cost", n1=100, vr="spent", step=20, limit=3, emoji="\U0001F9ED",
          goal="Each stage of an expedition costs $20 more than the last, starting at $100. Total spent after 3 stages?",
          share="\U0001F9ED Expedition complete!\nSpent: $360"),
        P("if_else_simple", v1="trust", n1=20, v2="doubt", n2=15, cmp_op=">", vr="pact",
          true_v="trust", true_op="+", true_arg=10, false_v="trust", false_op="-", false_arg=5,
          emoji="\U0001F91D", goal="Enough trust for a pact, or does doubt win? Pact strength?",
          share="\U0001F91D Pact formed!\nTrust: 30"),
        P("while_two_var", v1="lore", n1=0, v2="ruins", n2=25, op1="+", step1=5, op2="-", step2=5,
          cond_v="ruins", cond_op=">", cond_val="0", ret_v="lore",
          emoji="\U0001F4DA", goal="An explorer searches ruins for lore. Total lore discovered?",
          share="\U0001F4DA Ruins mapped!\nLore: 25"),
        P("if_else_calc", v1="map", n1=9, v2="compass", n2=7, cmp_op=">", cmp_val=12, vr="trail", vi="nav",
          true_op="+", false_op="-", emoji="\U0001F393",
          goal="Navigation check! Good map? Extend the trail. Lost? Compass fails. Trail length?",
          share="\U0001F393 Navigated!\nTrail calculated"),
        P("while_if_else", v1="hull", n1=80, v2="cargo", n2=18, vr="trips",
          loop_v="hull", loop_op=">", loop_val=10,
          if_v="cargo", if_op=">", if_val=5,
          true_v="hull", true_op="-", true_val=15,
          false_v="hull", false_op="-", false_val=5,
          dec_v="cargo", dec_op="-", dec_val=3, emoji="\U0001F6A2",
          goal="A cargo hull unloads each trip. Heavy cargo shrinks as it's delivered. Total trips?",
          share="\U0001F6A2 All delivered!\n5 trips completed", diff="hard"),
        P("while_decay", v1="miles", n1=0, v2="boost", n2=10, vr="sprints",
          v1_op="+", v2_op="-", v2_step=2, cond_op=">", cond_val=0,
          emoji="\U0001F4A8", goal="A turbo boost fades each sprint. What's the miles covered?",
          share="\U0001F4A8 Boost spent!\nMiles: 30"),
        P("while_decay", v1="ascent", n1=0, v2="jump", n2=12, vr="leaps",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F3C0", goal="An explorer leaps lower each time. Total ascent traveled?",
          share="\U0001F3C0 Landed!\nAscent: 30"),
        P("for_if", vr="finds", n_end=7, threshold=3, emoji="\U0001F33E",
          goal="Search dig sites. Only deep ones produce finds equal to their number. Total finds?",
          share="\U0001F33E Finds: 22!"),
        P("for_if", vr="relics", n_end=7, threshold=4, emoji="\U0001F4B5",
          goal="Explore tombs: deeper ones have more relics. Total relics?",
          share="\U0001F4B5 Relics found!"),
    ]

@theme("medieval")
def theme_medieval():
    return [
        P("arith_multi_step", v1="iron", n1=15, v2="coal", n2=5, vi="ingot", op1="+", v3="anvil", n3=2, vr="blade", op2="*", emoji="\u2694\uFE0F",
          goal="Smelt iron with coal into an ingot, then hammer on the anvil. Blade quality?",
          share="\u2694\uFE0F Blade forged!\nQuality: 40"),
        P("arith_multi_step", v1="wheat", n1=20, v2="chaff", n2=8, vi="grain", op1="-", v3="mills", n3=3, vr="levy", op2="*", emoji="\U0001F33E",
          goal="Separate wheat from chaff, then grind it through the mills. How much levy gathered?",
          share="\U0001F33E Mills grinding!\n36 bags of levy"),
        P("if_else_calc", v1="iron", n1=12, v2="coal", n2=6, cmp_op=">", cmp_val=15, vr="alloy", vi="forge",
          true_op="+", false_op="-", emoji="\u2699\uFE0F",
          goal="The blacksmith checks the forge. Hot enough? Add more iron. Cold? Lose some coal. Alloy quality?",
          share="\u2699\uFE0F Alloy forged!\nQuality result"),
        P("if_else_calc", v1="knights", n1=12, v2="squires", n2=8, cmp_op=">", cmp_val=15, vr="siege", vi="army",
          true_op="+", false_op="-", emoji="\U0001F3F0",
          goal="Large enough army? Recruit more knights. Small siege? Send squires home. Siege force?",
          share="\U0001F3F0 Army rallied!\nSiege counted"),
        P("while_countdown", v1="tallow", n1=20, step=5, vr="vigils", emoji="\U0001F56F\uFE0F",
          goal="Tallow burns per vigil. Vigils until dark?",
          share="\U0001F56F\uFE0F Vigils: 4"),
        P("for_accum", vr="tithe", n_end=5, k=4, emoji="\U0001FA99",
          goal="A lord collects tithe each season. How much tithe total?",
          share="\U0001FA99 Tithe: 20!"),
        P("while_if", v1="timber", n1=42, v2="frost", n2=14, vr="keeps",
          loop_cond_v="timber", loop_cond_op=">", loop_cond_val=0,
          if_v="frost", if_op=">", if_val=4, if_body_v="frost", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=7, emoji="\U0001FA9A",
          goal="A builder uses timber each keep. Frost gradually thaws. Keeps completed?",
          share="\U0001FA9A Castle busy!\n6 keeps done", diff="hard"),
        P("while_if_else", v1="honor", n1=12, v2="vassals", n2=100, vr="wars",
          loop_v="vassals", loop_op=">", loop_val=20,
          if_v="honor", if_op=">", if_val=5,
          true_v="vassals", true_op="-", true_val=10,
          false_v="vassals", false_op="-", false_val=20,
          dec_v="honor", dec_op="-", dec_val=2, emoji="\u2694\uFE0F",
          goal="An army fights wars. High honor means fewer vassal losses, but honor drops each fight. How many wars?",
          share="\u2694\uFE0F Campaign over!\n6 wars fought", diff="hard"),
        P("for_two_var", vr="march", v2="pace", v2_start=3, n_end=5, vr_op="+", v2_op="+", v2_step=2, emoji="\U0001F697",
          goal="A troop's pace increases each tick. Total march distance?",
          share="\U0001F697 Marched: 35!"),
        P("while_decay", v1="league", n1=0, v2="steed", n2=24, vr="rides",
          v1_op="+", v2_op="-", v2_step=4, cond_op=">", cond_val=0,
          emoji="\U0001F3C3", goal="A steed slows each ride. Total leagues?",
          share="\U0001F3C3 Ride done!\nLeagues: 84"),
        P("while_two_var", v1="yield", n1=0, v2="serfs", n2=35, op1="+", step1=5, op2="-", step2=5,
          cond_v="serfs", cond_op=">", cond_val="0", ret_v="yield",
          emoji="\U0001F33D", goal="Serfs work the fields until exhausted. What's the yield?",
          share="\U0001F33D Serfs done!\nYield: 35"),
        P("if_else_simple", v1="fealty", n1=25, v2="doubt", n2=15, cmp_op=">", vr="keep",
          true_v="fealty", true_op="+", true_arg=10, false_v="fealty", false_op="-", false_arg=5,
          emoji="\U0001F91D", goal="Two kingdoms negotiate. Enough fealty, or does doubt win? Keep strength?",
          share="\U0001F91D Pact formed!\nKeep: 35"),
        P("for_if", vr="bounty", n_end=9, threshold=4, emoji="\U0001FA99",
          goal="A dungeon has chambers. Only deep ones have bounty equal to their number. Total bounty?",
          share="\U0001FA99 Bounty: 35!"),
        P("while_counter", v1="salve", n1=4, vr="potion", limit=4, emoji="\U0001F48A",
          goal="Apply salve per potion brewed. Total potion?",
          share="\U0001F48A Brewed: 16 potions"),
        P("if_else_calc", v1="solar", n1=18, v2="wind", n2=12, cmp_op=">", cmp_val=25, vr="watts", vi="mill",
          true_op="+", false_op="-", emoji="\u2600\uFE0F",
          goal="Generating enough at the mill? Add more solar. Low? Shut down some wind. Watts?",
          share="\u2600\uFE0F Mill balanced!\nWatts output"),
        P("if_else_calc", v1="ale", n1=6, v2="mead", n2=4, cmp_op=">", cmp_val=8, vr="vigor", vi="feast",
          true_op="+", false_op="-", emoji="\u2615",
          goal="Had enough at the feast? Pour more ale. Not? Skip the mead. Vigor level?",
          share="\u2615 Feasted!\nVigor updated"),
    ]

@theme("electronics")
def theme_electronics():
    return [
        P("while_accum", v1="amps", n1=5, vr="ohms", step=3, limit=3, emoji="\u26A1",
          goal="A capacitor builds amps faster each pulse. How many ohms?",
          share="\u26A1 Charged!\nOhms: 24"),
        P("while_mul", v1="node", n1=3, mul=2, limit=5, vr="ticks", emoji="\U0001F9A0",
          goal="Nodes double each tick. Population?",
          share="\U0001F9A0 Nodes: 96"),
        P("while_countdown", v1="solder", n1=48, step=6, vr="boards", emoji="\U0001F50C",
          goal="Use solder per board. Boards built?",
          share="\U0001F50C Boards: 8"),
        P("for_multiply", vr="hertz", n_end=4, k=2, emoji="\U0001F517",
          goal="A hertz frequency doubles each step. Final hertz?",
          share="\U0001F517 Hertz: 16!"),
        P("for_multiply", vr="wave", n_end=5, k=2, emoji="\U0001F30A",
          goal="A wave doubles in amplitude each second. Final amplitude?",
          share="\U0001F30A Wave: 32!"),
        P("if_else_simple", v1="signal", n1=9, v2="noise", n2=5, cmp_op=">", vr="gain",
          true_v="signal", true_op="*", true_arg=2, false_v="signal", false_op="-", false_arg=3,
          emoji="\U0001F4E1", goal="Clear signal? Amplify it! Static? Lose gain. Reception?",
          share="\U0001F4E1 Signal boosted!\nGain: 18"),
        P("while_accum", v1="watts", n1=12, vr="joules", step=5, limit=3, emoji="\u2622\uFE0F",
          goal="A reactor's watts output increases each cycle. Total joules?",
          share="\u2622\uFE0F Reactor hot!\nJoules: 51"),
        P("while_counter", v1="probes", n1=4, vr="reads", limit=7, emoji="\U0001F52C",
          goal="Read probes per test. How many reads?",
          share="\U0001F52C Reads: 28"),
        P("while_countdown", v1="fuse", n1=24, step=4, vr="trips", emoji="\U0001F56F\uFE0F",
          goal="Fuse trips per surge. Trips to blow?",
          share="\U0001F56F\uFE0F Trips: 6"),
        P("for_custom_start", vr="volts", v_start=25, n_end=5, k_op="+", k_val=12, emoji="\U0001F50B",
          goal="A cell charges each plug-in. After all plug-ins, what's the volts?",
          share="\U0001F50B Charged: 85 volts!"),
        P("while_decay", v1="load", n1=0, v2="torque", n2=15, vr="spins",
          v1_op="+", v2_op="-", v2_step=3, cond_op=">", cond_val=0,
          emoji="\U0001F4A5", goal="A motor loses torque each spin. Total load before it gives out?",
          share="\U0001F4A5 Motor spent!\nLoad: 40", diff="hard"),
        P("while_if", v1="charge", n1=48, v2="band", n2=12, vr="bursts",
          loop_cond_v="charge", loop_cond_op=">", loop_cond_val=0,
          if_v="band", if_op=">", if_val=4, if_body_v="band", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=6, emoji="\U0001F4F1",
          goal="A device drains charge each burst. Band weakens over time. How many bursts?",
          share="\U0001F4F1 Charge dead!\n8 bursts sent", diff="hard"),
        P("for_accum", vr="arcs", n_end=5, k=7, emoji="\u2728",
          goal="A welder sends arcs each pass. Total arcs?",
          share="\u2728 Welded: 35 arcs!"),
        P("if_else_calc", v1="logic", n1=18, v2="gates", n2=10, cmp_op=">", cmp_val=25, vr="flux", vi="pcb",
          true_op="+", false_op="-", emoji="\U0001F4BB",
          goal="Good logic gates? Ship the pcb. Bad gates? Cut some flux. Flux score?",
          share="\U0001F4BB PCB reviewed!\nFlux measured"),
        P("while_accum", v1="pings", n1=3, vr="bytes", step=3, limit=5, emoji="\U0001F4F1",
          goal="A server gets more pings each hour. Total bytes?",
          share="\U0001F4F1 Busy!\nBytes: 45"),
        P("while_mul", v1="bots", n1=5, mul=3, limit=3, vr="cycles", emoji="\U0001F4F1",
          goal="Bots triple per cycle. Count?",
          share="\U0001F4F1 Bots: 135"),
    ]

@theme("pirates")
def theme_pirates():
    return [
        P("for_accum", vr="plunder", n_end=5, k=6, emoji="\U0001FA99",
          goal="A pirate plunders each port. How much plunder total?",
          share="\U0001FA99 Treasure: 30 plunder!"),
        P("for_triangular", vr="bounty", n_end=8, emoji="\U0001FA99",
          goal="A bounty grows each day with increasing raids. Total bounty?",
          share="\U0001FA99 Bounty: 36!"),
        P("while_counter", v1="grog", n1=13, vr="barrels", limit=4, emoji="\U0001FA99",
          goal="Pour grog per barrel. How many barrels?",
          share="\U0001FA99 Barrels: 52"),
        P("while_countdown", v1="rigging", n1=40, step=8, vr="sails", emoji="\U0001FA62",
          goal="Tie rigging per sail. Total sails?",
          share="\U0001FA62 Sails: 5"),
        P("while_if", v1="anchor", n1=35, v2="barnacle", n2=8, vr="dives",
          loop_cond_v="anchor", loop_cond_op=">", loop_cond_val=0,
          if_v="barnacle", if_op=">", if_val=2, if_body_v="barnacle", if_body_op="-", if_body_val=2,
          v1_op="-", v1_step=5, emoji="\U0001FA62",
          goal="A diver scrapes the anchor. While barnacled, they chip away. How many dives?",
          share="\U0001FA62 Hull clean!\n7 dives", diff="hard"),
        P("while_two_var", v1="grog", n1=0, v2="casks", n2=30, op1="+", step1=5, op2="-", step2=5,
          cond_v="casks", cond_op=">", cond_val="0", ret_v="grog",
          emoji="\U0001F37A", goal="A crew taps casks each feast. How much grog when casks are empty?",
          share="\U0001F37A Cheers!\nGrog: 30"),
        P("if_else_simple", v1="loot", n1=95, v2="price", n2=80, cmp_op=">", vr="share",
          true_v="loot", true_op="-", true_arg=80, false_v="loot", false_op="+", false_arg=10,
          emoji="\U0001F4B0", goal="Spot a legendary sword. Can you afford it? Loot share remaining?",
          share="\U0001F4B0 Sword purchased!\nShare: 15"),
        P("while_countdown", v1="sand", n1=60, step=10, vr="forts", emoji="\U0001F3F0",
          goal="Use sand per fort. Forts built?",
          share="\U0001F3F0 Forts: 6"),
        P("for_if", vr="spoils", n_end=7, threshold=4, emoji="\U0001FA99",
          goal="A ship raids ports. Only rich ones have spoils equal to their number. Total spoils?",
          share="\U0001FA99 Spoils: 18!"),
        P("while_two_var", v1="plunder", n1=0, v2="ore", n2=45, op1="+", step1=9, op2="-", step2=9,
          cond_v="ore", cond_op=">", cond_val="0", ret_v="plunder",
          emoji="\u26CF\uFE0F", goal="Miners smelt ore into plunder each shift. How much plunder when the vein runs dry?",
          share="\u26CF\uFE0F Vein tapped!\nPlunder: 45"),
        P("if_else_calc", v1="jewels", n1=30, v2="silver", n2=15, cmp_op="<", cmp_val=40, vr="chest", vi="hoard",
          true_op="+", false_op="-", emoji="\U0001FA99",
          goal="A pirate counts the hoard. Rich enough? Toss some silver out. Chest total?",
          share="\U0001FA99 Hoard counted!\nChest updated"),
        P("while_decay", v1="spirit", n1=0, v2="shanty", n2=8, vr="rounds",
          v1_op="+", v2_op="-", v2_step=1, cond_op=">", cond_val=0,
          emoji="\U0001F4E3", goal="A captain's shanties inspire less each round. Total spirit raised?",
          share="\U0001F4E3 Shanty over!\nSpirit: 36"),
        P("for_accum", vr="cannons", n_end=5, k=9, emoji="\U0001F3F9",
          goal="A ship fires cannons each broadside. Total cannons fired?",
          share="\U0001F3F9 Fired: 45 cannons!"),
        P("while_counter", v1="pace", n1=7, vr="leagues", limit=6, emoji="\U0001F6B6",
          goal="Sail a set pace per league. Leagues traveled?",
          share="\U0001F6B6 Sailed: 42 leagues"),
        P("for_custom_start", vr="bounty", v_start=95, n_end=4, k_op="+", k_val=5, emoji="\U0001F3AE",
          goal="Start with a bounty. Earn more each raid. Final bounty?",
          share="\U0001F3AE Bounty: 115!"),
        P("while_if_else", v1="crew", n1=12, v2="rations", n2=54, vr="voyage",
          loop_v="rations", loop_op=">", loop_val=0,
          if_v="crew", if_op=">", if_val=6,
          true_v="crew", true_op="-", true_val=2,
          false_v="rations", false_op="-", false_val=6,
          dec_v="rations", dec_op="-", dec_val=6, emoji="\U0001F3F4\u200D\u2620\uFE0F",
          goal="A pirate crew eats rations daily. While overstaffed, some abandon ship. How long does the voyage last?",
          share="\U0001F3F4\u200D\u2620\uFE0F Land ho!\nVoyage: 6 days at sea", diff="hard"),
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
