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

    puzzle_id = hashlib.md5(seed_id.encode()).hexdigest()[:8]

    # Par = min_swaps + 3 so all score labels are reachable:
    # Genius (-3) = perfect solve, Hacker (-2), Optimized (-1), Compiled (par)
    if len(solution_order) >= 2:
        scrambled = _simulate_scramble(solution_order, puzzle_id)
        min_swaps = _count_min_swaps(scrambled, solution_order)
        par = max(3, min_swaps + 3)
    else:
        par = 3

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

    return {
        "lines": lines_data,
        "goal": goal,
        "output": output_str,
        "shareResult": share_result,
        "par": par,
        "difficulty": difficulty,
        "id": puzzle_id,
        "scene": scene
    }


# ============================================
# Template functions for puzzle generation
# ============================================

def tmpl_add2(v1, n1, v2, n2, vr, emoji, goal, share, seed):
    """Easy: let a = X; let b = Y; let result = a + b; return result"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("+"), id_(v2)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_sub2(v1, n1, v2, n2, vr, emoji, goal, share, seed):
    """Easy: let a = X; let b = Y; let result = a - b; return result"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("-"), id_(v2)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_mul2(v1, n1, v2, n2, vr, emoji, goal, share, seed):
    """Easy: let a = X; let b = Y; let result = a * b; return result"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("*"), id_(v2)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_div2(v1, n1, v2, n2, vr, emoji, goal, share, seed):
    """Easy: let a = X; let b = Y; let result = a / b; return result"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("/"), id_(v2)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_chain3(v1, n1, v2, n2, v3, n3, vr, op1, op2, emoji, goal, share, seed):
    """Easy: three vars, chain calc: result = v1 op1 v2 op2 v3 (left-to-right)"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(v3), op("="), lit_m(str(n3))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m(op1), id_(v2), op_m(op2), id_(v3)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_multi_step(v1, n1, v2, n2, vi, op1, v3, n3, vr, op2, emoji, goal, share, seed):
    """Easy: let a=X, b=Y, inter = a op1 b, c=Z, result = inter op2 c"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vi), op("="), id_(v1), op_m(op1), id_(v2)],
        [kw("let"), id_(v3), op("="), lit_m(str(n3))],
        [kw("let"), id_f(vr), op("="), id_(vi), op_m(op2), id_(v3)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_add_sub_chain(v1, n1, v2, n2, v3, n3, vr, emoji, goal, share, seed):
    """Easy: result = v1 + v2 - v3"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(v3), op("="), lit_m(str(n3))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("+"), id_(v2), op_m("-"), id_(v3)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_mul_add(v1, n1, v2, n2, v3, n3, vr, emoji, goal, share, seed):
    """Easy: result = v1 * v2 + v3 (left-to-right: (v1*v2)+v3)"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(v3), op("="), lit_m(str(n3))],
        [kw("let"), id_f(vr), op("="), id_(v1), op_m("*"), id_(v2), op_m("+"), id_(v3)],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_two_step_return(v1, n1, v2, n2, vi, op1, vr, op2, c, emoji, goal, share, seed):
    """Easy: inter = v1 op1 v2; result = inter op2 c; return result"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vi), op("="), id_(v1), op_m(op1), id_(v2)],
        [kw("let"), id_f(vr), op("="), id_(vi), op_m(op2), lit_m(str(c))],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_if_else_simple(v1, n1, v2, n2, cmp_op, vr, true_v, true_op, true_arg,
                         false_v, false_op, false_arg, emoji, goal, share, seed):
    """Easy-medium: if/else with simple comparison"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f(vr), op("="), lit("0")],
        [kw("if"), id_(v1), op_m(cmp_op), id_(v2), pn("{")],
        [id_(vr), op("="), id_(true_v), op_m(true_op), lit_m(str(true_arg))],
        [pn("}"), kw("else"), pn("{")],
        [id_(vr), op("="), id_(false_v), op_m(false_op), lit_m(str(false_arg))],
        [pn("}")],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_if_else_3var(v1, n1, v2, n2, v3, n3, cmp_v1, cmp_op, cmp_v2,
                       vr, true_expr_parts, false_expr_parts, emoji, goal, share, seed):
    """Easy-medium: 3 vars, if/else"""
    lines = [
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(v3), op("="), lit_m(str(n3))],
        [kw("let"), id_f(vr), op("="), lit("0")],
        [kw("if"), id_(cmp_v1), op_m(cmp_op), id_(cmp_v2), pn("{")],
        true_expr_parts,
        [pn("}"), kw("else"), pn("{")],
        false_expr_parts,
        [pn("}")],
        [kw("return"), id_f(vr)],
    ]
    return make_puzzle(lines, emoji + " " + goal, share, "medium", seed)

def tmpl_if_else_calc(v1, n1, v2, n2, cmp_op, cmp_val, vr, vi,
                       true_op, false_op, emoji, goal, share, seed):
    """Easy-medium: calculate intermediate, then if/else on it"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vi), op("="), id_(v1), op_m("+"), id_(v2)],
        [kw("let"), id_f(vr), op("="), lit("0")],
        [kw("if"), id_(vi), op_m(cmp_op), lit_m(str(cmp_val)), pn("{")],
        [id_(vr), op("="), id_(vi), op_m(true_op), id_(v1)],
        [pn("}"), kw("else"), pn("{")],
        [id_(vr), op("="), id_(vi), op_m(false_op), id_(v2)],
        [pn("}")],
        [kw("return"), id_f(vr)],
    ], emoji + " " + goal, share, "medium", seed)

def tmpl_while_counter(v1, n1, vr, limit, emoji, goal, share, seed, diff="medium"):
    """Medium: simple while with counter"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_f("i"), op("<"), lit_m(str(limit)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("+"), id_(v1)],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_accum(v1, n1, vr, vacc, step, limit, emoji, goal, share, seed, diff="medium"):
    """Medium: while loop accumulating with step growth"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_f("i"), op("<"), lit_m(str(limit)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("+"), id_(v1)],
        [id_(v1), op("="), id_(v1), op_m("+"), lit_m(str(step))],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_countdown(v1, n1, step, vr, emoji, goal, share, seed, diff="medium"):
    """Medium: countdown while loop, count iterations"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("while"), id_(v1), op_m(">"), lit("0"), pn("{")],
        [id_(v1), op("="), id_(v1), op_m("-"), lit_m(str(step))],
        [id_(vr), op("="), id_(vr), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_mul(v1, n1, mul, limit, vr, emoji, goal, share, seed, diff="medium"):
    """Medium: multiply each iteration"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("while"), id_(vr), op("<"), lit_m(str(limit)), pn("{")],
        [id_(v1), op("="), id_(v1), op_m("*"), lit_m(str(mul))],
        [id_(vr), op("="), id_(vr), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(v1)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_two_var(v1, n1, v2, n2, op1, step1, op2, step2, cond_v, cond_op, cond_val,
                        ret_v, emoji, goal, share, seed, diff="medium"):
    """Medium-hard: two vars changing in loop"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_f("i"), op("="), lit("0")],
        [kw("while"), id_(cond_v) if not cond_val.lstrip('-').isdigit() else id_f(cond_v),
         op_m(cond_op),
         id_(cond_val) if not cond_val.lstrip('-').isdigit() else lit_m(cond_val),
         pn("{")],
        [id_(v1), op("="), id_(v1), op_m(op1), lit_m(str(step1)) if isinstance(step1, int) else id_(step1)],
        [id_(v2), op("="), id_(v2), op_m(op2), lit_m(str(step2)) if isinstance(step2, int) else id_(step2)],
        [id_f("i"), op("="), id_f("i"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(ret_v)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_decay(v1, n1, v2, n2, vr, v1_op, v2_op, v2_step, cond_op, cond_val,
                      emoji, goal, share, seed, diff="medium"):
    """Medium-hard: one var changes, other decays"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("while"), id_(v2), op_m(cond_op), lit_m(str(cond_val)), pn("{")],
        [id_(v1), op("="), id_(v1), op_m(v1_op), id_(v2)],
        [id_(v2), op("="), id_(v2), op_m(v2_op), lit_m(str(v2_step))],
        [id_(vr), op("="), id_(vr), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(v1)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_while_if(v1, n1, v2, n2, vr, loop_cond_v, loop_cond_op, loop_cond_val,
                   if_v, if_op, if_val, if_body_v, if_body_op, if_body_val,
                   v1_op, v1_step, emoji, goal, share, seed, diff="hard"):
    """Hard: while + if inside"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("while"), id_(loop_cond_v), op_m(loop_cond_op), lit_m(str(loop_cond_val)), pn("{")],
        [kw("if"), id_(if_v), op_m(if_op), lit_m(str(if_val)), pn("{")],
        [id_(if_body_v), op("="), id_(if_body_v), op_m(if_body_op), lit_m(str(if_body_val))],
        [pn("}")],
        [id_(v1), op("="), id_(v1), op_m(v1_op), lit_m(str(v1_step))],
        [id_(vr), op("="), id_(vr), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_accum(vr, n_end, k, emoji, goal, share, seed, diff="medium"):
    """Easy: let total = 0; for i = 1 to N { total = total + K } return total"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("+"), lit_m(str(k))],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_triangular(vr, n_end, emoji, goal, share, seed, diff="medium"):
    """Easy-medium: let total = 0; for i = 1 to N { total = total + i } return total"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("+"), id_f("i")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_multiply(vr, n_end, k, emoji, goal, share, seed, diff="medium"):
    """Medium: let result = 1; for i = 1 to N { result = result * K } return result"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit("1")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("*"), lit_m(str(k))],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_if(vr, n_end, threshold, emoji, goal, share, seed, diff="medium"):
    """Medium: for i = 1 to N { if i > K { total = total + i } } return total"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [kw("if"), id_f("i"), op_m(">"), lit_m(str(threshold)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m("+"), id_f("i")],
        [pn("}")],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_custom_start(vr, v_start, n_start, n_end, k_op, k_val, emoji, goal, share, seed, diff="medium"):
    """Easy: let total = start_val; for i = 1 to N { total = total op K } return total"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit_m(str(v_start))],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m(k_op), lit_m(str(k_val))],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)

def tmpl_for_two_var(vr, v2, v2_start, n_end, vr_op, v2_op, v2_step, emoji, goal, share, seed, diff="medium"):
    """Medium: two vars in for loop"""
    return make_puzzle([
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("let"), id_(v2), op("="), lit_m(str(v2_start))],
        [kw("for"), id_f("i"), op("="), lit("1"), kw_to(), lit_m(str(n_end)), pn("{")],
        [id_(vr), op("="), id_(vr), op_m(vr_op), id_(v2)],
        [id_(v2), op("="), id_(v2), op_m(v2_op), lit_m(str(v2_step))],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)


def tmpl_while_if_else(v1, n1, v2, n2, vr, loop_v, loop_op, loop_val,
                        if_v, if_op, if_val,
                        true_assign_v, true_assign_op, true_assign_val,
                        false_assign_v, false_assign_op, false_assign_val,
                        dec_v, dec_op, dec_val,
                        emoji, goal, share, seed, diff="hard"):
    """Hard: while + if/else inside"""
    return make_puzzle([
        [kw("let"), id_(v1), op("="), lit_m(str(n1))],
        [kw("let"), id_(v2), op("="), lit_m(str(n2))],
        [kw("let"), id_(vr), op("="), lit("0")],
        [kw("while"), id_(loop_v), op_m(loop_op), lit_m(str(loop_val)), pn("{")],
        [kw("if"), id_(if_v), op_m(if_op), lit_m(str(if_val)), pn("{")],
        [id_(true_assign_v), op("="), id_(true_assign_v), op_m(true_assign_op), lit_m(str(true_assign_val))],
        [pn("}"), kw("else"), pn("{")],
        [id_(false_assign_v), op("="), id_(false_assign_v), op_m(false_assign_op), lit_m(str(false_assign_val))],
        [pn("}")],
        [id_(dec_v), op("="), id_(dec_v), op_m(dec_op), lit_m(str(dec_val))],
        [pn("}")],
        [kw("return"), id_(vr)],
    ], emoji + " " + goal, share, diff, seed)


# ============================================
# Theme data - 365 unique puzzles
# ============================================

def generate_puzzles():
    puzzles = []
    idx = 0

    def add(p):
        nonlocal idx
        puzzles.append(p)
        print(f"Puzzle {idx}: OK (output={p['output']}, movable={sum(1 for l in p['lines'] for tk in l if not tk['f'])}, par={p['par']})")
        idx += 1

    # ============================================
    # MEDIUM: Chain & multi-step arithmetic (~20 puzzles)
    # ============================================

    # --- Chain arithmetic (5) ---
    chain_themes = [
        ("base", 10, "bonus", 5, "tax", 3, "pay", "+", "-", "\U0001F4B5", "You earned a base wage plus a bonus, but tax takes a cut. What's your paycheck?", "\U0001F4B5 Payday!\nBase + bonus - tax = $12"),
        ("attack", 8, "rage", 3, "block", 4, "damage", "+", "-", "\u2694\uFE0F", "A warrior's attack is boosted by rage, but the enemy blocks. How much damage lands?", "\u2694\uFE0F Critical hit!\n8 + 3 rage - 4 blocked = 7 damage"),
        ("flour", 3, "eggs", 2, "sugar", 4, "batter", "*", "+", "\U0001F370", "Mix flour and eggs together, then fold in sugar. How much batter?", "\U0001F370 Batter whipped!\nMixed up 10 cups"),
        ("width", 5, "height", 3, "border", 4, "canvas", "+", "*", "\U0001F5BC\uFE0F", "Combine width and height, then stretch by the border size. How big is the canvas?", "\U0001F5BC\uFE0F Canvas stretched!\n32 pixels wide"),
        ("speed", 12, "time", 3, "wind", 6, "flight", "*", "+", "\U0001F6EB", "A plane flies at speed for some time, then gets a tailwind boost. Total flight distance?", "\U0001F6EB Landed safely!\n42 miles traveled"),
    ]
    for v1, n1, v2, n2, v3, n3, vr, o1, o2, emoji, goal, share in chain_themes:
        add(tmpl_chain3(v1, n1, v2, n2, v3, n3, vr, o1, o2, emoji, goal, share, f"parsed_{idx:03d}"))

    # --- Multi-step / two-step (10) ---
    multistep_themes = [
        ("eggs", 6, "milk", 4, "mix", "+", "butter", 3, "batter", "*", "\U0001F95E", "Whisk eggs and milk together, then fold in butter. How much batter?", "\U0001F95E Pancakes incoming!\n30 cups of batter ready"),
        ("iron", 15, "coal", 5, "ingot", "+", "hammers", 2, "blade", "*", "\u2694\uFE0F", "Smelt iron with coal into an ingot, then hammer it into shape. Blade quality?", "\u2694\uFE0F Blade forged!\nQuality: 40"),
        ("salt", 8, "pepper", 4, "spice", "*", "water", 3, "broth", "+", "\U0001F372", "Grind salt and pepper into a spice blend, then dissolve in water. How rich is the broth?", "\U0001F372 Broth simmering!\nRichness: 35"),
        ("red", 10, "green", 6, "yellow", "+", "blue", 2, "paint", "*", "\U0001F3A8", "Blend red and green to make yellow, then mix with blue. How much paint?", "\U0001F3A8 Colors mixed!\n32 units of paint"),
        ("atk", 12, "def", 4, "raw", "-", "crit", 3, "damage", "*", "\U0001F4A5", "Attack power minus enemy defense, then land a critical hit. Total damage?", "\U0001F4A5 Critical strike!\n24 damage dealt"),
        ("wheat", 20, "chaff", 8, "grain", "-", "mills", 3, "flour", "*", "\U0001F33E", "Separate wheat from chaff, then grind it through the mills. How much flour?", "\U0001F33E Mills grinding!\n36 bags of flour"),
        ("notes", 8, "rests", 2, "bars", "*", "tempo", 5, "rhythm", "+", "\U0001F3B6", "Arrange notes with rests into bars, then add the tempo. What's the rhythm score?", "\U0001F3B6 Music flows!\nRhythm score: 21"),
        ("planks", 10, "nails", 5, "frame", "+", "paint", 2, "cabin", "*", "\U0001F3E0", "Nail planks into a frame, then apply coats of paint. How sturdy is the cabin?", "\U0001F3E0 Cabin built!\nSturdiness: 30"),
        ("health", 100, "poison", 25, "current", "-", "potion", 10, "final", "+", "\U0001F48A", "A hero takes poison damage but drinks a healing potion. What's the final HP?", "\U0001F48A Potion worked!\nFinal HP: 85"),
        ("logs", 24, "splits", 4, "boards", "/", "nails", 3, "shelves", "+", "\U0001FA9A", "Split the logs into boards, then nail on some extras. How many shelves?", "\U0001FA9A Workshop done!\n9 shelves built"),
    ]
    for v1, n1, v2, n2, vi, o1, v3, n3, vr, o2, emoji, goal, share in multistep_themes:
        add(tmpl_multi_step(v1, n1, v2, n2, vi, o1, v3, n3, vr, o2, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # EASY: For loop — accumulator (~20 puzzles)
    # ============================================

    for_accum_themes = [
        # (vr, n_end, k, emoji, goal, share)
        ("coins", 5, 3, "\U0001FA99", "A pirate finds 3 gold coins each day for 5 days. How many coins total?", "\U0001FA99 Treasure: 15 coins!"),
        ("points", 4, 10, "\U0001F3AF", "Score 10 points each round for 4 rounds. Total points?", "\U0001F3AF Score: 40 points!"),
        ("bricks", 6, 4, "\U0001F9F1", "A mason lays 4 bricks each hour for 6 hours. Total bricks?", "\U0001F9F1 Wall: 24 bricks!"),
        ("treats", 3, 7, "\U0001F36A", "A baker makes 7 cookies each batch for 3 batches. Total treats?", "\U0001F36A Baked: 21 treats!"),
        ("steps", 8, 5, "\U0001F6B6", "Walk 5 steps each minute for 8 minutes. Total steps?", "\U0001F6B6 Walked: 40 steps!"),
        ("gems", 7, 2, "\U0001F48E", "Mine 2 gems each day for 7 days. Total gems?", "\U0001F48E Mined: 14 gems!"),
        ("flowers", 4, 6, "\U0001F33B", "Plant 6 flowers each row for 4 rows. Total flowers?", "\U0001F33B Garden: 24 flowers!"),
        ("sparks", 5, 8, "\u2728", "A firework launches 8 sparks each second for 5 seconds. Total sparks?", "\u2728 Show: 40 sparks!"),
        ("fish", 6, 3, "\U0001F41F", "A fisherman catches 3 fish each hour for 6 hours. Total fish?", "\U0001F41F Catch: 18 fish!"),
        ("pages", 5, 12, "\U0001F4D6", "Read 12 pages each night for 5 nights. Total pages read?", "\U0001F4D6 Read: 60 pages!"),
        ("arrows", 4, 9, "\U0001F3F9", "An archer fires 9 arrows each round for 4 rounds. Total arrows shot?", "\U0001F3F9 Shot: 36 arrows!"),
        ("scoops", 3, 4, "\U0001F366", "Put 4 scoops on each of 3 sundaes. Total scoops?", "\U0001F366 Scoops: 12!"),
        ("notes", 6, 5, "\U0001F3B5", "Play 5 notes each measure for 6 measures. Total notes?", "\U0001F3B5 Music: 30 notes!"),
        ("candles", 7, 3, "\U0001F56F\uFE0F", "Light 3 candles each night for 7 nights. Total candles lit?", "\U0001F56F\uFE0F Lit: 21 candles!"),
        ("laps", 5, 4, "\U0001F3CA", "Swim 4 laps each session for 5 sessions. Total laps?", "\U0001F3CA Swam: 20 laps!"),
        ("stars", 8, 6, "\u2B50", "An astronomer maps 6 stars each hour for 8 hours. Total stars mapped?", "\u2B50 Mapped: 48 stars!"),
        ("blocks", 4, 7, "\U0001F3D7\uFE0F", "Stack 7 blocks each layer for 4 layers. Total blocks?", "\U0001F3D7\uFE0F Built: 28 blocks!"),
        ("potions", 3, 5, "\U0001F9EA", "Brew 5 potions each day for 3 days. Total potions?", "\U0001F9EA Brewed: 15 potions!"),
        ("stitches", 6, 8, "\U0001F9F5", "Sew 8 stitches each panel for 6 panels. Total stitches?", "\U0001F9F5 Sewn: 48 stitches!"),
        ("reps", 5, 10, "\U0001F4AA", "Do 10 pushups each set for 5 sets. Total reps?", "\U0001F4AA Workout: 50 reps!"),
    ]
    for vr, n_end, k, emoji, goal, share in for_accum_themes:
        add(tmpl_for_accum(vr, n_end, k, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # EASY: For loop — with starting value (~10 puzzles)
    # ============================================

    for_custom_start_themes = [
        # (vr, v_start, n_start, n_end, k_op, k_val, emoji, goal, share)
        ("score", 100, 100, 4, "+", 5, "\U0001F3AE", "Start with 100 points. Earn 5 bonus points each of 4 rounds. Final score?", "\U0001F3AE Score: 120!"),
        ("balance", 50, 50, 6, "+", 10, "\U0001F4B5", "Start with $50 in savings. Deposit $10 each month for 6 months. Balance?", "\U0001F4B5 Saved: $110!"),
        ("health", 80, 80, 3, "-", 5, "\u2764\uFE0F", "Start with 80 HP. Lose 5 HP each of 3 poison ticks. Health remaining?", "\u2764\uFE0F HP: 65!"),
        ("altitude", 200, 200, 5, "-", 15, "\U0001F6AC", "A hot air balloon starts at 200 feet. It descends 15 feet each minute for 5 minutes. Altitude?", "\U0001F6AC Altitude: 125 feet!"),
        ("inventory", 30, 30, 4, "+", 8, "\U0001F4E6", "A warehouse starts with 30 items. Receive 8 new items each of 4 shipments. Total inventory?", "\U0001F4E6 Inventory: 62!"),
        ("charge", 20, 20, 5, "+", 12, "\U0001F50B", "A battery starts at 20% and gains 12% per plug-in. After 5 plug-ins, what's the charge?", "\U0001F50B Charged: 80%!"),
        ("fame", 10, 10, 3, "*", 2, "\u2B50", "Start with 10 fame. Double your fame each of 3 viral posts. Total fame?", "\u2B50 Famous: 80!"),
        ("temp", 40, 40, 4, "-", 6, "\u2744\uFE0F", "Start at 40 degrees. It drops 6 degrees each of 4 hours. Temperature?", "\u2744\uFE0F Chilly: 16 degrees!"),
        ("morale", 60, 60, 5, "+", 7, "\U0001F389", "Team morale starts at 60. Each of 5 wins adds 7 morale. Final morale?", "\U0001F389 Pumped: 95!"),
        ("supplies", 100, 100, 6, "-", 12, "\U0001F3D5\uFE0F", "Start a camping trip with 100 supplies and use 12 per outing. After 6 outings, how many supplies remain?", "\U0001F3D5\uFE0F Supplies: 28!"),
    ]
    for vr, v_start, n_start, n_end, k_op, k_val, emoji, goal, share in for_custom_start_themes:
        add(tmpl_for_custom_start(vr, v_start, n_start, n_end, k_op, k_val, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # EASY-MEDIUM: For loop — triangular numbers (~12 puzzles)
    # ============================================

    for_triangular_themes = [
        # (vr, n_end, emoji, goal, share)
        ("steps", 6, "\U0001F3E2", "You climb a staircase. Floor 1 needs 1 step, floor 2 needs 2, and so on up to 6. Total steps?", "\U0001F3E2 Climbed: 21 steps!"),
        ("gifts", 5, "\U0001F381", "Each day of a holiday you give that day's number in gifts. After 5 days, total gifts?", "\U0001F381 Gifted: 15 presents!"),
        ("pushups", 7, "\U0001F4AA", "Day 1: 1 pushup. Day 2: 2. Up to day 7. Total pushups this week?", "\U0001F4AA Gains: 28 pushups!"),
        ("coins", 8, "\U0001FA99", "A piggy bank grows each day — 1 coin on day 1, 2 on day 2, up to day 8. Total coins?", "\U0001FA99 Saved: 36 coins!"),
        ("layers", 4, "\U0001F370", "Stack a layer cake: 1 layer thick, then 2, then 3, then 4. Total layers of frosting?", "\U0001F370 Layered: 10!"),
        ("drops", 10, "\U0001F4A7", "A leak drips more each hour — 1 drop, then 2, 3... up to 10. Total drops spilled?", "\U0001F4A7 Spilled: 55 drops!"),
        ("bows", 5, "\U0001F3BB", "A violinist takes bows after each piece — 1 for piece 1, 2 for piece 2, up to 5. Total bows?", "\U0001F3BB Encore: 15 bows!"),
        ("xp", 9, "\u2B50", "Earn 1 XP for quest 1, 2 XP for quest 2, up to quest 9. Total XP earned?", "\u2B50 XP: 45!"),
        ("petals", 6, "\U0001F33C", "A flower grows 1 petal, then 2, then 3... up to 6. Total petals on the bloom?", "\U0001F33C Bloomed: 21 petals!"),
        ("claps", 4, "\U0001F44F", "After song 1, 1 clap. After song 2, 2 claps. Up to song 4. Total claps?", "\U0001F44F Applause: 10 claps!"),
        ("sparks", 7, "\U0001F525", "A forge heats up — 1 spark minute 1, 2 sparks minute 2, up to 7. Total sparks?", "\U0001F525 Forged: 28 sparks!"),
        ("tiles", 5, "\U0001F9E9", "Row 1 gets 1 tile, row 2 gets 2, up to row 5. Total tiles placed?", "\U0001F9E9 Tiled: 15!"),
    ]
    for vr, n_end, emoji, goal, share in for_triangular_themes:
        add(tmpl_for_triangular(vr, n_end, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # MEDIUM: For loop — multiply (~10 puzzles)
    # ============================================

    for_multiply_themes = [
        # (vr, n_end, k, emoji, goal, share)
        ("size", 4, 2, "\U0001F9A0", "A cell divides: it doubles in size each of 4 cycles. Final size?", "\U0001F9A0 Grown: 16!"),
        ("rumor", 3, 3, "\U0001F5E3\uFE0F", "A rumor triples each day for 3 days. How far has it spread?", "\U0001F5E3\uFE0F Spread: 27!"),
        ("power", 5, 2, "\u26A1", "A reactor doubles its output each stage for 5 stages. Final power?", "\u26A1 Power: 32!"),
        ("swarm", 3, 4, "\U0001F41D", "A bee colony quadruples each month for 3 months. Final swarm size?", "\U0001F41D Swarm: 64!"),
        ("echo", 4, 3, "\U0001F50A", "An echo triples in volume with each bounce for 4 bounces. Final volume?", "\U0001F50A Echo: 81!"),
        ("crystal", 3, 5, "\U0001F48E", "A crystal grows 5x each layer for 3 layers. Final size?", "\U0001F48E Crystal: 125!"),
        ("fire", 6, 2, "\U0001F525", "A wildfire doubles each hour for 6 hours. Final area burned?", "\U0001F525 Fire: 64!"),
        ("chain", 4, 2, "\U0001F517", "A chain reaction doubles each step for 4 steps. Final reaction size?", "\U0001F517 Reaction: 16!"),
        ("ripple", 5, 2, "\U0001F30A", "A ripple doubles in radius each second for 5 seconds. Final radius?", "\U0001F30A Ripple: 32!"),
        ("virus", 3, 3, "\U0001F9A0", "A computer virus triples each hour for 3 hours. Infected machines?", "\U0001F9A0 Infected: 27!"),
    ]
    for vr, n_end, k, emoji, goal, share in for_multiply_themes:
        add(tmpl_for_multiply(vr, n_end, k, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # MEDIUM: For loop + if (~10 puzzles)
    # ============================================

    for_if_themes = [
        # (vr, n_end, threshold, emoji, goal, share)
        ("loot", 8, 4, "\U0001FA99", "A dungeon has 8 rooms. Only rooms numbered above 4 have treasure. Collect room numbers as loot. Total loot?", "\U0001FA99 Loot: 26!"),
        ("score", 10, 6, "\U0001F3AF", "Play 10 rounds. The first 6 are warm-up, but each one after scores big — add its number. Total score?", "\U0001F3AF Bonus: 34!"),
        ("harvest", 7, 3, "\U0001F33E", "Harvest 7 fields. Only mature ones (above 3) produce yield equal to their number. Total harvest?", "\U0001F33E Harvest: 22!"),
        ("xp", 6, 2, "\U0001F47E", "Fight 6 monsters. Only the tough ones (above level 2) award XP equal to their level. Total XP?", "\U0001F47E XP: 18!"),
        ("power", 9, 5, "\u26A1", "A machine runs 9 cycles. The first 5 are warm-up, but each one after generates power equal to its number. Total power?", "\u26A1 Power: 30!"),
        ("tips", 8, 3, "\U0001F4B0", "Serve 8 tables. Only big parties (table number above 3) tip their table number. Total tips?", "\U0001F4B0 Tips: 30!"),
        ("gems", 7, 4, "\U0001F48E", "Explore 7 caves. Only deep caves (above 4) contain gems equal to the cave number. Total gems?", "\U0001F48E Gems: 18!"),
        ("points", 10, 7, "\U0001F3C6", "A 10-round tournament. The first 7 are qualifiers, but each final awards points equal to its number. Total points?", "\U0001F3C6 Points: 27!"),
        ("stars", 6, 3, "\u2B50", "A telescope scans 6 sectors. Only bright sectors (above 3) reveal stars equal to the sector number. Total stars?", "\u2B50 Stars: 15!"),
        ("notes", 8, 5, "\U0001F3B5", "An 8-bar solo. Only the last bars (above bar 5) hit the high notes. Sum of those bar numbers?", "\U0001F3B5 Solo: 21!"),
    ]
    for vr, n_end, threshold, emoji, goal, share in for_if_themes:
        add(tmpl_for_if(vr, n_end, threshold, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # MEDIUM: For loop — two variable (~10 puzzles)
    # ============================================

    for_two_var_themes = [
        # (vr, v2, v2_start, n_end, vr_op, v2_op, v2_step, emoji, goal, share)
        ("distance", "speed", 3, 5, "+", "+", 2, "\U0001F697", "A car accelerates — speed starts at 3 and increases by 2 each tick. Total distance after 5 ticks?", "\U0001F697 Driven: 35!"),
        ("gold", "wage", 5, 4, "+", "+", 3, "\U0001F4B0", "A worker's wage starts at 5 and rises by 3 each day. Total gold earned after 4 days?", "\U0001F4B0 Earned: 38!"),
        ("harvest", "yield", 10, 3, "+", "-", 2, "\U0001F33E", "Each season the yield drops by 2 (starting at 10). Total harvest over 3 seasons?", "\U0001F33E Harvested: 24!"),
        ("score", "combo", 8, 4, "+", "-", 1, "\U0001F3AE", "A combo multiplier starts at 8 and fades by 1 each hit. Total score after 4 hits?", "\U0001F3AE Score: 26!"),
        ("altitude", "thrust", 20, 3, "+", "-", 5, "\U0001F680", "A rocket's thrust starts at 20 and drops by 5 each burn. Total altitude gained after 3 burns?", "\U0001F680 Altitude: 45!"),
        ("melody", "volume", 6, 5, "+", "+", 1, "\U0001F3B5", "A crescendo starts at volume 6 and grows by 1 each beat. Total melody power after 5 beats?", "\U0001F3B5 Melody: 40!"),
        ("paint", "strokes", 4, 6, "+", "+", 2, "\U0001F58C\uFE0F", "An artist's brush strokes start at 4 and widen by 2 each pass. Total paint applied after 6 passes?", "\U0001F58C\uFE0F Painted: 54!"),
        ("damage", "power", 12, 4, "+", "-", 2, "\u2694\uFE0F", "A warrior's power starts at 12 and weakens by 2 each swing. Total damage after 4 swings?", "\u2694\uFE0F Damage: 36!"),
        ("savings", "income", 15, 3, "+", "+", 5, "\U0001F4B8", "Income starts at 15 and grows by 5 each month. Total saved after 3 months?", "\U0001F4B8 Saved: 55!"),
        ("depth", "drill", 7, 5, "+", "+", 1, "\u26CF\uFE0F", "Drill speed starts at 7 and increases by 1 each stage. Total depth after 5 stages?", "\u26CF\uFE0F Drilled: 45!"),
    ]
    for vr, v2, v2_start, n_end, vr_op, v2_op, v2_step, emoji, goal, share in for_two_var_themes:
        add(tmpl_for_two_var(vr, v2, v2_start, n_end, vr_op, v2_op, v2_step, emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # EASY-MEDIUM: if/else branching (~55 puzzles)
    # ============================================

    # --- Simple if/else comparisons (30) ---
    ifelse_simple = [
        ("strength", 15, "threshold", 10, ">", "power", "strength", "+", 5, "strength", "-", 3,
         "\U0001F4AA", "A hero lifts a boulder. If strong enough, they power up. Otherwise they strain. What's their power?", "\U0001F4AA Powered up!\nPower: 20"),
        ("temp", 30, "limit", 25, ">", "reading", "temp", "-", 5, "temp", "+", 10,
         "\U0001F321\uFE0F", "The lab is overheating! If it's too hot, cool it down. Otherwise, warm it up. Final reading?", "\U0001F321\uFE0F Lab stabilized!\nTemp: 25 degrees"),
        ("score", 80, "passing", 70, ">", "grade", "score", "+", 10, "score", "-", 20,
         "\U0001F4AF", "Final exam day! Pass and get bonus points. Fail and lose points. What's the grade?", "\U0001F4AF Passed!\nGrade: 90"),
        ("energy", 40, "cost", 50, "<", "charge", "energy", "*", 2, "energy", "+", 10,
         "\u26A1", "The robot checks its battery. Enough juice? Overcharge! Otherwise, trickle charge. Final charge?", "\u26A1 Overcharged!\nEnergy: 80"),
        ("skill", 8, "quest", 5, ">", "reward", "skill", "*", 3, "skill", "+", 2,
         "\U0001F3AF", "A skilled archer enters a tournament. Win big or get a consolation prize. What's the reward?", "\U0001F3AF Bullseye!\nReward: 24"),
        ("rain", 20, "drought", 30, "<", "crop", "rain", "*", 3, "rain", "-", 5,
         "\U0001F327\uFE0F", "The forecast calls for rain. If it's wet enough, crops triple. Otherwise they wither. Harvest?", "\U0001F327\uFE0F Bumper crop!\nHarvest: 60"),
        ("level", 10, "boss", 8, ">", "outcome", "level", "*", 2, "level", "-", 3,
         "\U0001F47E", "You encounter the boss! If your level is higher, you deal double damage. Otherwise, you take a hit. Outcome?", "\U0001F47E Victory!\nOutcome: 20"),
        ("speed", 50, "limit", 60, "<", "result", "speed", "+", 0, "speed", "-", 10,
         "\U0001F6A8", "A car checks its speed against the limit. Under? Keep cruising at current speed. Over? Slow down. Result?", "\U0001F6A8 Drive safe!\nResult: 50"),
        ("hunger", 30, "fullness", 20, ">", "eat", "hunger", "-", 10, "hunger", "+", 5,
         "\U0001F354", "Lunchtime! If you're still hungry, eat a full meal. If not, just grab a snack. Hunger level?", "\U0001F354 Lunch break!\nHunger: 20"),
        ("gold", 100, "price", 80, ">", "remaining", "gold", "-", 80, "gold", "+", 10,
         "\U0001F4B0", "You spot a legendary sword in the shop. Can you afford it, or do you save up? Gold remaining?", "\U0001F4B0 Sword purchased!\nGold: 20"),
        ("wind", 25, "calm", 15, ">", "sail", "wind", "*", 2, "wind", "+", 5,
         "\u26F5", "A sailor checks the wind. Strong breeze? Full sails ahead! Calm? Paddle slowly. Speed?", "\u26F5 Full sails!\nSpeed: 50 knots"),
        ("ink", 12, "paper", 20, "<", "print", "ink", "*", 3, "ink", "+", 5,
         "\U0001F5A8\uFE0F", "The printer checks ink levels. Plenty left? Print away! Low? Just a test page. Output?", "\U0001F5A8\uFE0F Printed!\nOutput: 36 pages"),
        ("morale", 70, "threshold", 50, ">", "bonus", "morale", "+", 20, "morale", "-", 10,
         "\U0001F389", "The team checks morale. Spirits high? Throw a party! Low? Tough week ahead. Final bonus?", "\U0001F389 Party time!\nMorale: 90"),
        ("fuel", 45, "reserve", 30, ">", "range", "fuel", "*", 2, "fuel", "+", 15,
         "\u26FD", "Road trip! Full tank means double the range. Low tank? Just a short drive. How far?", "\u26FD Road trip!\nRange: 90 miles"),
        ("xp", 100, "levelUp", 80, ">", "tier", "xp", "+", 50, "xp", "-", 30,
         "\u2B06\uFE0F", "The hero checks their XP. Enough to level up? Massive bonus! Short? Setback. New tier?", "\u2B06\uFE0F Level up!\nTier: 150"),
        ("rep", 25, "fame", 30, "<", "status", "rep", "*", 2, "rep", "+", 5,
         "\u2B50", "An actor auditions for a big role. Famous enough? Star power doubles! Otherwise, slow build. Status?", "\u2B50 Stardom!\nStatus: 50"),
        ("ammo", 8, "clip", 6, ">", "remaining", "ammo", "-", 3, "ammo", "+", 4,
         "\U0001F52B", "The soldier checks the clip. Full? Fire a burst. Empty? Reload first. Ammo remaining?", "\U0001F52B Shots fired!\nAmmo: 5"),
        ("mana", 60, "cost", 40, ">", "cast", "mana", "-", 40, "mana", "+", 20,
         "\U0001FA84", "The wizard eyes a powerful spell. Enough mana to cast it, or meditate to recharge? Mana left?", "\U0001FA84 Spell cast!\nMana: 20"),
        ("wood", 30, "need", 25, ">", "build", "wood", "-", 25, "wood", "+", 10,
         "\U0001FA9A", "Winter is coming! If there's enough wood, build the shelter. Otherwise, gather more. Wood left?", "\U0001FA9A Shelter built!\nWood: 5"),
        ("luck", 7, "odds", 5, ">", "prize", "luck", "*", 3, "luck", "+", 2,
         "\U0001F340", "You find a four-leaf clover! Feeling lucky? Go for the jackpot! Otherwise, play it safe. Prize?", "\U0001F340 Jackpot!\nPrize: 21"),
        ("depth", 50, "limit", 40, ">", "dive", "depth", "-", 10, "depth", "+", 20,
         "\U0001F30A", "A diver checks the depth gauge. Too deep? Time to surface. Safe? Keep exploring. Final depth?", "\U0001F30A Surfaced!\nDepth: 40m"),
        ("power", 90, "load", 80, ">", "output", "power", "-", 30, "power", "+", 10,
         "\U0001F50C", "The generator is straining! Overloaded? Shed some load. Under capacity? Boost output. Power?", "\U0001F50C Load balanced!\nOutput: 60"),
        ("seeds", 15, "plots", 10, ">", "crop", "seeds", "-", 10, "seeds", "+", 5,
         "\U0001F331", "Spring planting! Enough garden plots? Plant the seeds. Too few? Save them for later. Crop yield?", "\U0001F331 Planted!\nCrop: 5"),
        ("karma", 40, "threshold", 35, ">", "boost", "karma", "+", 15, "karma", "-", 5,
         "\u2696\uFE0F", "The monk meditates. Is karma high enough for enlightenment? Great boost! If not, a small setback. Karma?", "\u2696\uFE0F Enlightened!\nKarma: 55"),
        ("signal", 8, "noise", 5, ">", "clarity", "signal", "*", 2, "signal", "-", 3,
         "\U0001F4E1", "Mission control checks the radio. Clear signal? Amplify it! Static? Lose some clarity. Reception?", "\U0001F4E1 Signal boosted!\nClarity: 16"),
        ("stocks", 120, "target", 100, ">", "portfolio", "stocks", "-", 50, "stocks", "+", 30,
         "\U0001F4C8", "The stock hits its target price! Time to sell for profit? Or hold and accumulate? Portfolio value?", "\U0001F4C8 Sold high!\nPortfolio: 70"),
        ("armor", 35, "attack", 20, ">", "block", "armor", "-", 20, "armor", "+", 10,
         "\U0001F6E1\uFE0F", "The knight braces for impact. Armor strong enough to absorb the blow, or reinforce it? Block value?", "\U0001F6E1\uFE0F Blow absorbed!\nArmor: 15"),
        ("oxygen", 80, "threshold", 60, ">", "supply", "oxygen", "-", 25, "oxygen", "+", 15,
         "\U0001F4A8", "The astronaut checks O2 levels. Enough to sprint to the airlock, or rest and conserve? Oxygen supply?", "\U0001F4A8 Made it!\nOxygen: 55"),
        ("focus", 45, "distraction", 30, ">", "output", "focus", "+", 10, "focus", "-", 15,
         "\U0001F9E0", "Crunch time at work! Can you stay focused, or do distractions win? Final output?", "\U0001F9E0 In the zone!\nOutput: 55"),
        ("trust", 20, "suspicion", 15, ">", "alliance", "trust", "+", 10, "trust", "-", 5,
         "\U0001F91D", "Two kingdoms negotiate. Is there enough trust for an alliance, or does suspicion win? Alliance strength?", "\U0001F91D Alliance formed!\nTrust: 30"),
    ]
    for v1, n1, v2, n2, cmp, vr, tv, top, ta, fv, fop, fa, emoji, goal, share in ifelse_simple:
        add(tmpl_if_else_simple(v1, n1, v2, n2, cmp, vr, tv, top, ta, fv, fop, fa,
                                 emoji, goal, share, f"parsed_{idx:03d}"))

    # --- if/else with calculation (25) ---
    ifelse_calc = [
        ("apples", 8, "oranges", 7, ">", 10, "basket", "total", "+", "*",
         "\U0001F34E", "Count all the fruit. If it's a big haul, add more apples. Small haul? Squeeze the oranges instead. What's in the basket?", "\U0001F34E Basket packed!\nGreat haul"),
        ("iron", 12, "coal", 6, ">", 15, "alloy", "raw", "+", "-",
         "\u2699\uFE0F", "The blacksmith checks the raw materials. Hot enough forge? Add more iron. Cold? Lose some coal. Alloy quality?", "\u2699\uFE0F Alloy forged!\nQuality result"),
        ("rain", 20, "sun", 10, "<", 25, "crop", "sky", "+", "-",
         "\U0001F327\uFE0F", "Check the weather forecast. Wet season? Rain helps the crops. Dry? Sun scorches them. Harvest?", "\U0001F327\uFE0F Season's harvest!\nCrops gathered"),
        ("wolves", 5, "sheep", 15, ">", 15, "herd", "pack", "+", "-",
         "\U0001F43A", "The wolf pack eyes the flock. Big enough pack? They hunt. Too small? Sheep scatter. What happens to the herd?", "\U0001F43A Nature's balance!\nHerd changed"),
        ("bass", 10, "treble", 8, ">", 15, "mix", "audio", "+", "-",
         "\U0001F3B5", "The DJ checks the audio levels. Loud enough? Pump up the bass. Quiet? Dial back the treble. Final mix?", "\U0001F3B5 Track mixed!\nPerfect balance"),
        ("gold", 30, "silver", 20, "<", 40, "vault", "treasure", "+", "-",
         "\U0001FA99", "A dragon counts its hoard. Rich enough? Add more gold. Poor haul? Toss some silver out. Vault total?", "\U0001FA99 Hoard counted!\nVault updated"),
        ("fuel", 25, "air", 15, ">", 35, "thrust", "mix", "+", "-",
         "\U0001F680", "The engineer checks the fuel-air mixture. Rich enough? Add fuel for thrust. Lean? Reduce airflow. Thrust level?", "\U0001F680 Engine tuned!\nThrust calculated"),
        ("str", 14, "dex", 8, ">", 18, "power", "stat", "+", "-",
         "\U0001F4AA", "The warrior levels up! High enough combined stats? Strength surges. Low? Dexterity takes a hit. Power level?", "\U0001F4AA Level up!\nPower calculated"),
        ("red", 10, "blue", 15, "<", 20, "shade", "palette", "+", "-",
         "\U0001F3A8", "An artist blends colors. Cool enough palette? Add warm red. Too warm? Cut back the blue. Final shade?", "\U0001F3A8 Color mixed!\nShade created"),
        ("coffee", 6, "tea", 4, ">", 8, "energy", "cups", "+", "-",
         "\u2615", "Morning caffeine check! Had enough cups? Pour more coffee. Not? Skip the tea. Energy level?", "\u2615 Caffeinated!\nEnergy updated"),
        ("code", 20, "tests", 10, ">", 25, "quality", "suite", "+", "-",
         "\U0001F4BB", "Code review time! Well-tested codebase? Ship more features. Undertested? Cut failing tests. Quality score?", "\U0001F4BB Code reviewed!\nQuality measured"),
        ("fish", 8, "bait", 12, "<", 15, "catch", "tackle", "+", "-",
         "\U0001F3A3", "The fisher checks tackle quality. Good gear? Catch more fish. Bad day? Lose some bait. Total catch?", "\U0001F3A3 Day on the lake!\nCatch counted"),
        ("wood", 15, "stone", 10, ">", 20, "fort", "materials", "+", "-",
         "\U0001F3F0", "Building a fort! Enough materials? Add more wood. Running low? Cut back the stone. Fort strength?", "\U0001F3F0 Fort built!\nStrength measured"),
        ("solar", 18, "wind", 12, ">", 25, "watts", "power", "+", "-",
         "\u2600\uFE0F", "The power grid checks output. Generating enough? Add more solar panels. Low? Shut down some turbines. Watts?", "\u2600\uFE0F Grid balanced!\nPower output"),
        ("math", 9, "science", 7, ">", 12, "gpa", "grades", "+", "-",
         "\U0001F393", "Report card day! Making the honor roll? Boost math score. Falling short? Science takes a hit. GPA?", "\U0001F393 Report card!\nGPA calculated"),
        ("herbs", 6, "roots", 4, ">", 8, "remedy", "potion", "+", "-",
         "\U0001F33F", "The healer brews a remedy. Strong enough ingredients? Add more herbs. Weak batch? Remove some roots. Potency?", "\U0001F33F Remedy brewed!\nPotency measured"),
        ("thunder", 10, "lightning", 15, "<", 20, "storm", "weather", "+", "-",
         "\u26C8\uFE0F", "Storm brewing! Intense enough? Thunder amplifies it. Mild? Lightning dissipates. Storm power?", "\u26C8\uFE0F Storm passed!\nPower measured"),
        ("knights", 12, "squires", 8, ">", 15, "force", "army", "+", "-",
         "\U0001F3F0", "The general rallies the troops. Large enough army? Recruit more knights. Small force? Send squires home. Army size?", "\U0001F3F0 Army rallied!\nForce counted"),
        ("pixels", 20, "frames", 10, ">", 25, "render", "scene", "+", "-",
         "\U0001F3AC", "Rendering a scene! High enough resolution? Add more pixels. Low? Drop some frames. Render quality?", "\U0001F3AC Scene rendered!\nQuality scored"),
        ("nectar", 7, "pollen", 5, ">", 10, "honey", "flowers", "+", "-",
         "\U0001F41D", "The bees return to the hive. Good harvest? Add more nectar. Poor day? Lose some pollen. Honey made?", "\U0001F41D Honey harvest!\nSweet results"),
        ("atoms", 15, "bonds", 9, ">", 20, "molecule", "matter", "+", "-",
         "\u269B\uFE0F", "The chemist checks the compound. Stable enough? Add more atoms. Unstable? Break some bonds. Molecule size?", "\u269B\uFE0F Reaction complete!\nMolecule formed"),
        ("sails", 8, "oars", 6, ">", 10, "speed", "ship", "+", "-",
         "\u26F5", "The captain reads the wind. Strong enough? Raise more sails. Calm seas? Stow the oars. Ship speed?", "\u26F5 Anchors aweigh!\nSpeed calculated"),
        ("strings", 6, "frets", 12, "<", 15, "tune", "chord", "+", "-",
         "\U0001F3B8", "The guitarist tunes up. Sounds good? Add more strings to the chord. Off-key? Cut some frets. Chord quality?", "\U0001F3B8 In tune!\nChord perfected"),
        ("calcium", 10, "iron", 8, ">", 15, "vitamin", "mineral", "+", "-",
         "\U0001F48A", "The doctor checks mineral levels. Balanced diet? Add calcium boost. Deficient? Reduce iron dose. Vitamin level?", "\U0001F48A Health check!\nVitamins balanced"),
        ("bricks", 20, "mortar", 8, ">", 22, "wall", "build", "+", "-",
         "\U0001F9F1", "The mason checks supplies. Enough to build? Stack more bricks. Running low? Use less mortar. Wall strength?", "\U0001F9F1 Wall raised!\nStrength measured"),
    ]
    for v1, n1, v2, n2, cmp, cval, vr, vi, top, fop, emoji, goal, share in ifelse_calc:
        add(tmpl_if_else_calc(v1, n1, v2, n2, cmp, cval, vr, vi, top, fop,
                               emoji, goal, share, f"parsed_{idx:03d}"))

    # ============================================
    # MEDIUM: Simple while loops (~85 puzzles)
    # ============================================

    # --- While counter (simple repeat) (20) ---
    while_counter = [
        ("step", 7, "distance", 5, "\U0001F6B6", "Walk 7 units per step for 5 steps. Distance?", "\U0001F6B6 Walked: 35 units"),
        ("dose", 4, "medicine", 3, "\U0001F48A", "Take 4mg dose 3 times. Total medicine?", "\U0001F48A Treatment: 12mg"),
        ("push", 10, "total", 4, "\U0001F4AA", "Do 10 pushups per set, 4 sets. Total?", "\U0001F4AA Workout: 40 pushups"),
        ("deposit", 25, "savings", 6, "\U0001F4B5", "Deposit $25 each month for 6 months. Total savings?", "\U0001F4B5 Saved: $150"),
        ("xp", 15, "total", 4, "\u2B50", "Earn 15 XP per quest, 4 quests. What's the total?", "\u2B50 XP: 60"),
        ("harvest", 8, "bushels", 7, "\U0001F33E", "Harvest 8 units per field, 7 fields. Total bushels?", "\U0001F33E Harvested: 56"),
        ("petals", 6, "total", 5, "\U0001F33A", "Pick 6 petals per flower, 5 flowers. How many total?", "\U0001F33A Petals: 30"),
        ("paint", 3, "coats", 8, "\U0001F3A8", "Apply 3 coats per layer, 8 layers. How many coats?", "\U0001F3A8 Coverage: 24"),
        ("bricks", 12, "total", 5, "\U0001F9F1", "Lay 12 bricks per row, 5 rows. How many total?", "\U0001F9F1 Bricks: 60"),
        ("scoops", 2, "total", 6, "\U0001F366", "Put 2 scoops per cone, 6 cones. How many total?", "\U0001F366 Scoops: 12"),
        ("laps", 5, "total", 4, "\U0001F3CA", "Swim 5 laps per session, 4 sessions. How many total?", "\U0001F3CA Laps: 20"),
        ("throws", 9, "total", 3, "\u26BE", "Throw 9 pitches per inning, 3 innings. How many total?", "\u26BE Pitches: 27"),
        ("lines", 8, "total", 6, "\U0001F4DD", "Write 8 lines per page, 6 pages. How many total?", "\U0001F4DD Lines: 48"),
        ("notes", 4, "total", 8, "\U0001F3B5", "Play 4 notes per measure, 8 measures. How many total?", "\U0001F3B5 Notes: 32"),
        ("blocks", 6, "total", 4, "\U0001F3D7\uFE0F", "Stack 6 blocks per tower, 4 towers. How many total?", "\U0001F3D7\uFE0F Blocks: 24"),
        ("samples", 3, "total", 7, "\U0001F52C", "Analyze 3 samples per test, 7 tests. How many total?", "\U0001F52C Samples: 21"),
        ("sparks", 5, "total", 6, "\U0001F386", "Each firework has 5 sparks, 6 fireworks. How many total?", "\U0001F386 Sparks: 30"),
        ("stitches", 15, "total", 3, "\U0001F9F5", "Sew 15 stitches per patch, 3 patches. How many total?", "\U0001F9F5 Stitches: 45"),
        ("drops", 8, "total", 5, "\U0001F9EA", "Add 8 drops per vial, 5 vials. How many total?", "\U0001F9EA Drops: 40"),
        ("coins", 11, "total", 4, "\U0001FA99", "Find 11 coins per chest, 4 chests. How many total?", "\U0001FA99 Coins: 44"),
    ]
    for v1, n1, vr, limit, emoji, goal, share in while_counter:
        add(tmpl_while_counter(v1, n1, vr, limit, emoji, goal, share, f"parsed_{idx:03d}"))

    # --- While accumulate with growth (20) ---
    while_accum = [
        ("wage", 10, "earned", "income", 5, 4, "\U0001F4B0", "A worker's wage increases by 5 each pay period. Total earned after 4 periods?", "\U0001F4B0 Payday!\nEarned: $70"),
        ("speed", 5, "distance", "odometer", 3, 5, "\U0001F697", "A car accelerates by 3 each tick. Total distance in 5 ticks?", "\U0001F697 Road trip!\nDistance: 55"),
        ("appetite", 2, "food", "meals", 1, 6, "\U0001F354", "A growing puppy eats more each meal (+1 appetite). How much food after 6 meals?", "\U0001F354 Stuffed!\nFood: 27"),
        ("rent", 100, "spent", "housing", 20, 3, "\U0001F3E0", "Rent goes up by $20 each year. Total spent on housing over 3 years?", "\U0001F3E0 Lease up!\nHousing: $360"),
        ("gravity", 3, "depth", "fall", 2, 4, "\U0001F30D", "A rock falls faster each second as gravity pulls harder. What depth after 4 seconds?", "\U0001F30D Splash!\nDepth: 24"),
        ("growth", 1, "size", "plant", 2, 5, "\U0001F331", "A plant's growth rate increases by 2 each week. What size after 5 weeks?", "\U0001F331 Thriving!\nSize: 25"),
        ("waves", 4, "erosion", "shore", 3, 4, "\U0001F30A", "Each tide's waves grow stronger by 3. Total erosion after 4 tides?", "\U0001F30A Shore changed!\nErosion: 34"),
        ("tempo", 60, "beats", "music", 10, 3, "\U0001F3B6", "A DJ speeds up the tempo by 10 bpm each verse. Total beats after 3 verses?", "\U0001F3B6 Drop!\nBeats: 210"),
        ("rate", 3, "output", "factory", 1, 7, "\U0001F3ED", "A factory improves its production rate by 1 each shift. Total output after 7 shifts?", "\U0001F3ED Shift over!\nOutput: 42"),
        ("dose", 5, "absorbed", "medicine", 3, 4, "\U0001F489", "Each round of treatment increases the dose by 3. Total absorbed after 4 rounds?", "\U0001F489 Treatment done!\nAbsorbed: 38"),
        ("clicks", 2, "views", "traffic", 3, 5, "\U0001F4F1", "A viral post gains 3 more clicks each day. Total views after 5 days?", "\U0001F4F1 Trending!\nViews: 40"),
        ("stars", 1, "rating", "review", 1, 5, "\u2B50", "A restaurant gains 1 extra star each review as word spreads. Total rating after 5 reviews?", "\u2B50 Five-star!\nRating: 15"),
        ("power", 8, "charged", "battery", 4, 3, "\U0001F50B", "A battery charges faster each cycle (+4 power). Total charge after 3 cycles?", "\U0001F50B Full charge!\nPower: 36"),
        ("rainfall", 5, "water", "cistern", 2, 6, "\U0001F327\uFE0F", "Monsoon season! Rainfall increases by 2 each day. How much water fills the cistern after 6 days?", "\U0001F327\uFE0F Cistern full!\nWater: 60"),
        ("talent", 3, "fame", "celebrity", 2, 4, "\U0001F31F", "An entertainer's talent grows by 2 with each show. How famous after 4 shows?", "\U0001F31F Star born!\nFame: 24"),
        ("seeds", 6, "planted", "garden", 2, 5, "\U0001F33B", "A gardener plants more seeds each day (+2). How many planted after 5 days?", "\U0001F33B Garden full!\nPlanted: 50"),
        ("exp", 10, "xp", "skill", 5, 4, "\U0001F3AF", "An adventurer earns 10 XP on the first quest, then 5 more XP per quest beyond that. Total XP from 4 quests?", "\U0001F3AF Leveled up!\nSkill: 70"),
        ("voltage", 4, "charge", "capacitor", 3, 3, "\u26A1", "A capacitor builds voltage faster each pulse (+3). How much charge after 3 pulses?", "\u26A1 Charged!\nVoltage: 21"),
        ("heat", 15, "energy", "reactor", 5, 3, "\u2622\uFE0F", "A reactor's heat output increases by 5 each cycle. Total energy after 3 cycles?", "\u2622\uFE0F Reactor hot!\nEnergy: 60"),
        ("likes", 7, "followers", "social", 4, 4, "\U0001F44D", "Each post earns 4 more likes than the last as the account grows. Followers after 4 posts?", "\U0001F44D Going viral!\nFollowers: 46"),
    ]
    for v1, n1, vr, vacc, step, limit, emoji, goal, share in while_accum:
        add(tmpl_while_accum(v1, n1, vr, vacc, step, limit, emoji, goal, share, f"parsed_{idx:03d}"))

    # --- While countdown (20) ---
    while_countdown = [
        ("fuel", 30, 5, "burns", "\U0001F680", "Burn 5 fuel each tick. How many burns?", "\U0001F680 Burns: 6"),
        ("candle", 24, 4, "hours", "\U0001F56F\uFE0F", "Candle melts 4cm/hour. Hours to melt?", "\U0001F56F\uFE0F Hours: 6"),
        ("ice", 50, 10, "minutes", "\U0001F9CA", "Ice melts 10g/min. Minutes to melt?", "\U0001F9CA Minutes: 5"),
        ("ink", 42, 7, "pages", "\U0001F5A8\uFE0F", "Ink fades 7 units/page. Pages printable?", "\U0001F5A8\uFE0F Pages: 6"),
        ("stamina", 36, 9, "rounds", "\U0001F94A", "Lose 9 stamina/round. Rounds to exhaust?", "\U0001F94A Rounds: 4"),
        ("oxygen", 48, 8, "dives", "\U0001F93F", "Use 8 oxygen/dive. Total dives?", "\U0001F93F Dives: 6"),
        ("rope", 35, 5, "knots", "\U0001FA62", "Tie 5ft per knot. Total knots?", "\U0001FA62 Knots: 7"),
        ("chalk", 20, 4, "lessons", "\U0001F4DA", "Use 4 chalk pieces/lesson. Total lessons?", "\U0001F4DA Lessons: 5"),
        ("wire", 54, 6, "circuits", "\U0001F50C", "Use 6ft wire per circuit. Circuits built?", "\U0001F50C Circuits: 9"),
        ("marble", 32, 8, "statues", "\U0001F3DB\uFE0F", "Use 8 marble blocks/statue. Statues carved?", "\U0001F3DB\uFE0F Statues: 4"),
        ("clay", 45, 9, "pots", "\U0001FAD9", "Use 9 units clay per pot. Pots made?", "\U0001FAD9 Pots: 5"),
        ("thread", 28, 4, "seams", "\U0001FAA1", "Use 4ft thread per seam. Seams sewn?", "\U0001FAA1 Seams: 7"),
        ("grain", 40, 8, "loaves", "\U0001F35E", "Use 8 grain per loaf. Loaves baked?", "\U0001F35E Loaves: 5"),
        ("pixels", 60, 12, "sprites", "\U0001F3AE", "Use 12 pixels per sprite. Sprites drawn?", "\U0001F3AE Sprites: 5"),
        ("film", 36, 6, "scenes", "\U0001F3AC", "Use 6 minutes per scene. Scenes filmed?", "\U0001F3AC Scenes: 6"),
        ("wool", 21, 3, "scarves", "\U0001F9E3", "Use 3 wool per scarf. Scarves knitted?", "\U0001F9E3 Scarves: 7"),
        ("sand", 50, 10, "castles", "\U0001F3F0", "Use 10 buckets per castle. Castles built?", "\U0001F3F0 Castles: 5"),
        ("paint", 27, 9, "rooms", "\U0001F58C\uFE0F", "Use 9 gallons per room. Rooms painted?", "\U0001F58C\uFE0F Rooms: 3"),
        ("flour", 56, 8, "pies", "\U0001F967", "Use 8 cups per pie. Pies baked?", "\U0001F967 Pies: 7"),
        ("tape", 18, 3, "boxes", "\U0001F4E6", "Use 3ft tape per box. Boxes sealed?", "\U0001F4E6 Boxes: 6"),
    ]
    for v1, n1, step, vr, emoji, goal, share in while_countdown:
        add(tmpl_while_countdown(v1, n1, step, vr, emoji, goal, share, f"parsed_{idx:03d}"))

    # --- While multiply (15) ---
    while_mul = [
        ("bacteria", 2, 2, 5, "generations", "\U0001F9A0", "Bacteria double 5 times. Population?", "\U0001F9A0 Bacteria: 64"),
        ("rumor", 3, 3, 3, "days", "\U0001F5E3\uFE0F", "Rumor triples each day for 3 days. Spread?", "\U0001F5E3\uFE0F Rumor: 81"),
        ("virus", 1, 4, 4, "hours", "\U0001F9A0", "Virus quadruples every hour for 4 hours. Count?", "\U0001F9A0 Virus: 256"),
        ("yeast", 5, 2, 3, "rises", "\U0001F35E", "Yeast doubles 3 times. Volume?", "\U0001F35E Yeast: 40"),
        ("echo", 2, 3, 4, "bounces", "\U0001F50A", "Echo triples 4 times. Volume?", "\U0001F50A Echo: 162"),
        ("algae", 3, 2, 4, "blooms", "\U0001F33F", "Algae doubles 4 times. Coverage?", "\U0001F33F Algae: 48"),
        ("followers", 4, 3, 3, "posts", "\U0001F4F1", "Followers triple per post for 3 posts. Count?", "\U0001F4F1 Followers: 108"),
        ("crystal", 1, 5, 3, "layers", "\U0001F48E", "Crystal grows 5x per layer for 3 layers. Size?", "\U0001F48E Crystal: 125"),
        ("fire", 2, 2, 6, "minutes", "\U0001F525", "Fire doubles every minute for 6 minutes. Size?", "\U0001F525 Fire: 128"),
        ("mold", 3, 3, 3, "days", "\U0001F344", "Mold triples each day for 3 days. Amount?", "\U0001F344 Mold: 81"),
        ("ripple", 1, 2, 7, "seconds", "\U0001F30A", "Ripple doubles 7 times. Radius?", "\U0001F30A Ripple: 128"),
        ("chain", 2, 2, 4, "links", "\U0001F517", "Chain doubles 4 times. Length?", "\U0001F517 Chain: 32"),
        ("plague", 5, 2, 3, "waves", "\U0001F480", "Plague doubles 3 times. Infected?", "\U0001F480 Infected: 40"),
        ("snowball", 1, 3, 4, "rolls", "\u26C4", "Snowball triples 4 times. Size?", "\u26C4 Snowball: 81"),
        ("fission", 4, 2, 3, "splits", "\u2622\uFE0F", "Atoms undergo fission, doubling 3 times. Result?", "\u2622\uFE0F Particles: 32"),
    ]
    for v1, n1, mul, limit, vr, emoji, goal, share in while_mul:
        add(tmpl_while_mul(v1, n1, mul, limit, vr, emoji, goal, share, f"parsed_{idx:03d}"))

    # --- Additional medium: custom while loops (10) ---
    # These are hand-crafted to add variety

    # Countdown to zero returning the value
    add(make_puzzle([
        [kw("let"), id_("timer"), op("="), lit_m("20")],
        [kw("let"), id_("tick"), op("="), lit_m("3")],
        [kw("let"), id_("alerts"), op("="), lit("0")],
        [kw("while"), id_("timer"), op_m(">"), lit("0"), pn("{")],
        [id_("timer"), op("="), id_("timer"), op_m("-"), id_("tick")],
        [id_("alerts"), op("="), id_("alerts"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("alerts")],
    ], "\u23F0 Timer counts down by tick. How many alerts?",
       "\u23F0 Timer done! 7 alerts", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("weight"), op("="), lit_m("60")],
        [kw("let"), id_("loss"), op("="), lit_m("4")],
        [kw("let"), id_f("weeks"), op("="), lit("0")],
        [kw("while"), id_("weight"), op_m(">"), lit_m("40"), pn("{")],
        [id_("weight"), op("="), id_("weight"), op_m("-"), id_("loss")],
        [id_f("weeks"), op("="), id_f("weeks"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("weeks")],
    ], "\U0001F3CB\uFE0F Lose weight each week. Weeks to reach target?",
       "\U0001F3CB\uFE0F Goal reached! 5 weeks", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("debt"), op("="), lit_m("90")],
        [kw("let"), id_("payment"), op("="), lit_m("15")],
        [kw("let"), id_f("months"), op("="), lit("0")],
        [kw("while"), id_("debt"), op_m(">"), lit("0"), pn("{")],
        [id_("debt"), op("="), id_("debt"), op_m("-"), id_("payment")],
        [id_f("months"), op("="), id_f("months"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("months")],
    ], "\U0001F4B3 Pay $15/month on $90 debt. Months to pay off?",
       "\U0001F4B3 Debt free! 6 months", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("temp"), op("="), lit_m("5")],
        [kw("let"), id_("warmth"), op("="), lit_m("8")],
        [kw("let"), id_f("hours"), op("="), lit("0")],
        [kw("while"), id_("temp"), op_m("<"), lit_m("45"), pn("{")],
        [id_("temp"), op("="), id_("temp"), op_m("+"), id_("warmth")],
        [id_f("hours"), op("="), id_f("hours"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("hours")],
    ], "\U0001F321\uFE0F Starting at 5 degrees, warmth adds 8 each tick. How many hours to reach 45?",
       "\U0001F321\uFE0F Warm! 5 hours", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("floor"), op("="), lit("0")],
        [kw("let"), id_("climb"), op("="), lit_m("3")],
        [kw("let"), id_f("steps"), op("="), lit("0")],
        [kw("while"), id_("floor"), op_m("<"), lit_m("18"), pn("{")],
        [id_("floor"), op("="), id_("floor"), op_m("+"), id_("climb")],
        [id_f("steps"), op("="), id_f("steps"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("steps")],
    ], "\U0001F3E2 Climb 3 floors at a time. Steps to floor 18?",
       "\U0001F3E2 Top floor! 6 steps", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("volume"), op("="), lit_m("100")],
        [kw("let"), id_("fade"), op("="), lit_m("12")],
        [kw("let"), id_f("ticks"), op("="), lit("0")],
        [kw("while"), id_("volume"), op_m(">"), lit_m("28"), pn("{")],
        [id_("volume"), op("="), id_("volume"), op_m("-"), id_("fade")],
        [id_f("ticks"), op("="), id_f("ticks"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("ticks")],
    ], "\U0001F50A Volume fades by 12 each tick. Ticks to reach 28?",
       "\U0001F50A Faded! 6 ticks", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("snow"), op("="), lit_m("2")],
        [kw("let"), id_f("depth"), op("="), lit("0")],
        [kw("let"), id_f("hours"), op("="), lit("0")],
        [kw("while"), id_f("hours"), op("<"), lit_m("5"), pn("{")],
        [id_f("depth"), op("="), id_f("depth"), op_m("+"), id_("snow")],
        [id_("snow"), op("="), id_("snow"), op_m("+"), lit_m("1")],
        [id_f("hours"), op("="), id_f("hours"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("depth")],
    ], "\u2744\uFE0F Snow falls faster each hour (+1). Depth after 5 hours?",
       "\u2744\uFE0F Snow: 2+3+4+5+6 = 20 inches", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("score"), op("="), lit("0")],
        [kw("let"), id_("bonus"), op("="), lit_m("5")],
        [kw("let"), id_f("rounds"), op("="), lit("0")],
        [kw("while"), id_f("rounds"), op("<"), lit_m("4"), pn("{")],
        [id_("score"), op("="), id_("score"), op_m("+"), id_("bonus")],
        [id_("bonus"), op("="), id_("bonus"), op_m("*"), lit_m("2")],
        [id_f("rounds"), op("="), id_f("rounds"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("score")],
    ], "\U0001F3AE Score bonus doubles each round. Total score?",
       "\U0001F3AE Score: 5+10+20+40 = 75", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("hops"), op("="), lit_m("10")],
        [kw("let"), id_f("pos"), op("="), lit("0")],
        [kw("let"), id_f("jumps"), op("="), lit("0")],
        [kw("while"), id_f("pos"), op("<"), lit_m("30"), pn("{")],
        [id_f("pos"), op("="), id_f("pos"), op_m("+"), id_("hops")],
        [id_("hops"), op("="), id_("hops"), op_m("-"), lit_m("2")],
        [id_f("jumps"), op("="), id_f("jumps"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("jumps")],
    ], "\U0001F438 Frog hops shrink by 2 each jump. Jumps to reach 30?",
       "\U0001F438 Hop: 10+8+6+4+2+0... 4 jumps", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("price"), op("="), lit_m("50")],
        [kw("let"), id_("demand"), op("="), lit_m("5")],
        [kw("let"), id_f("days"), op("="), lit("0")],
        [kw("while"), id_("price"), op_m("<"), lit_m("80"), pn("{")],
        [id_("price"), op("="), id_("price"), op_m("+"), id_("demand")],
        [id_f("days"), op("="), id_f("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("days")],
    ], "\U0001F4C8 Price rises by demand each day. Days to reach 80?",
       "\U0001F4C8 Market: 6 days to 80", "medium", f"parsed_{idx:03d}"))

    # ============================================
    # MEDIUM-HARD: While with two variables (~75 puzzles)
    # ============================================

    # --- Two var change loops (30) ---
    twovar_themes = [
        # (v1, n1, v2, n2, op1, step1, op2, step2, cond_v, cond_op, cond_val, ret_v, emoji, goal, share)
        ("thrust", 0, "fuel", 50, "+", 10, "-", 10, "fuel", ">", "0", "thrust",
         "\U0001F680", "A rocket burns fuel to build thrust each tick. How much thrust when the tank is empty?", "\U0001F680 Launched!\nThrust: 50"),
        ("gold", 0, "ore", 36, "+", 6, "-", 6, "ore", ">", "0", "gold",
         "\u26CF\uFE0F", "Miners haul ore from the mountain each shift and smelt it into gold. How much gold when the vein runs dry?", "\u26CF\uFE0F Vein tapped!\nGold: 36"),
        ("knowledge", 0, "books", 25, "+", 5, "-", 5, "books", ">", "0", "knowledge",
         "\U0001F4DA", "A scholar reads through the library, gaining knowledge with each book. Total knowledge gained?", "\U0001F4DA Library finished!\nKnowledge: 25"),
        ("muscle", 0, "protein", 40, "+", 8, "-", 8, "protein", ">", "0", "muscle",
         "\U0001F4AA", "An athlete converts protein into muscle each training session. How much muscle when the protein runs out?", "\U0001F4AA Gains!\nMuscle: 40"),
        ("brew", 0, "hops", 30, "+", 6, "-", 6, "hops", ">", "0", "brew",
         "\U0001F37A", "A brewer uses hops each batch to make beer. How much brew when the hops are gone?", "\U0001F37A Cheers!\nBrew: 30"),
        ("harvest", 0, "seeds", 28, "+", 7, "-", 7, "seeds", ">", "0", "harvest",
         "\U0001F33D", "A farmer plants seeds row by row until the bag is empty. What's the harvest?", "\U0001F33D All planted!\nHarvest: 28"),
        ("output", 0, "input", 48, "+", 12, "-", 12, "input", ">", "0", "output",
         "\U0001F3ED", "A factory processes raw input into finished output each cycle. Total output when input runs out?", "\U0001F3ED Production done!\nOutput: 48"),
        ("signal", 0, "power", 35, "+", 7, "-", 7, "power", ">", "0", "signal",
         "\U0001F4E1", "A radio tower spends power to broadcast signal each tick. Total signal when the power dies?", "\U0001F4E1 Broadcast over!\nSignal: 35"),
        ("potion", 0, "herbs", 20, "+", 4, "-", 4, "herbs", ">", "0", "potion",
         "\U0001F33F", "An alchemist brews potions from herbs until the supply is exhausted. How many potions brewed?", "\U0001F33F All brewed!\nPotions: 20"),
        ("xp", 0, "quests", 45, "+", 9, "-", 9, "quests", ">", "0", "xp",
         "\u2B50", "An adventurer completes quests, earning XP for each one. Total XP when the quest board is empty?", "\u2B50 Quest log clear!\nXP: 45"),
    ]
    for v1, n1, v2, n2, o1, s1, o2, s2, cv, co, cval, rv, emoji, goal, share in twovar_themes:
        add(tmpl_while_two_var(v1, n1, v2, n2, o1, s1, o2, s2, cv, co, cval, rv,
                                emoji, goal, share, f"parsed_{idx:03d}", "medium"))

    # --- Decay loops (15) ---
    decay_themes = [
        # (v1, n1, v2, n2, vr, v1_op, v2_op, v2_step, cond_op, cond_val, emoji, goal, share)
        ("total", 0, "boost", 10, "rounds", "+", "-", 2, ">", 0,
         "\U0001F4A8", "A turbo boost fades by 2 each round. What's the total?", "\U0001F4A8 Boost spent!\nTotal: 30"),
        ("height", 0, "jump", 12, "bounces", "+", "-", 3, ">", 0,
         "\U0001F3C0", "A basketball bounces lower each time, losing 3 height per bounce. Total height traveled?", "\U0001F3C0 Ball stopped!\nTotal height: 30"),
        ("damage", 0, "power", 8, "attacks", "+", "-", 2, ">", 0,
         "\u2694\uFE0F", "A warrior tires with each swing, losing 2 power per attack. Total damage dealt before exhaustion?", "\u2694\uFE0F Battle over!\nDamage: 20"),
        ("harvest", 0, "yield", 15, "seasons", "+", "-", 3, ">", 0,
         "\U0001F33E", "A farm's yield shrinks by 3 each season as soil depletes. Total harvest across all seasons?", "\U0001F33E Soil spent!\nHarvest: 45"),
        ("score", 0, "combo", 9, "hits", "+", "-", 3, ">", 0,
         "\U0001F3AE", "A combo multiplier drops by 3 with each hit. Total score before the combo breaks?", "\U0001F3AE Combo broken!\nScore: 18"),
        ("distance", 0, "speed", 20, "laps", "+", "-", 4, ">", 0,
         "\U0001F3C3", "A runner slows by 4 each lap from fatigue. Total distance before they stop?", "\U0001F3C3 Race done!\nDistance: 60"),
        ("melody", 0, "volume", 14, "notes", "+", "-", 2, ">", 0,
         "\U0001F3B5", "A music box winds down, each note quieter by 2. Total melody played before silence?", "\U0001F3B5 Song ended!\nMelody: 63"),
        ("savings", 0, "income", 10, "months", "+", "-", 2, ">", 0,
         "\U0001F4B0", "A freelancer's income drops by 2 each month as contracts dry up. Total saved before it hits zero?", "\U0001F4B0 Saved up!\nSavings: 30"),
        ("erosion", 0, "rain", 11, "storms", "+", "-", 2, ">", 1,
         "\U0001F327\uFE0F", "Each storm erodes the cliffside, but storms weaken over time. Total erosion before they pass?", "\U0001F327\uFE0F Storms passed!\nErosion: 40"),
        ("heat", 0, "flame", 16, "burns", "+", "-", 4, ">", 0,
         "\U0001F525", "A campfire's flame weakens by 4 each round. Total heat generated before it dies out?", "\U0001F525 Fire out!\nHeat: 40"),
        ("clicks", 0, "interest", 7, "days", "+", "-", 1, ">", 0,
         "\U0001F5B1\uFE0F", "A viral post loses 1 interest point each day. Total clicks before nobody cares?", "\U0001F5B1\uFE0F Trend over!\nClicks: 28"),
        ("wisdom", 0, "study", 12, "years", "+", "-", 2, ">", 0,
         "\U0001F9D9", "A sage's study intensity fades by 2 each year as they age. Total wisdom gained?", "\U0001F9D9 Enlightened!\nWisdom: 42"),
        ("pressure", 0, "force", 18, "cycles", "+", "-", 3, ">", 0,
         "\U0001F4A5", "A hydraulic press loses 3 force each cycle. Total pressure applied before it gives out?", "\U0001F4A5 Press spent!\nPressure: 63"),
        ("morale", 0, "speech", 6, "rallies", "+", "-", 1, ">", 0,
         "\U0001F4E3", "A leader's speeches inspire less each rally, losing 1 impact each time. Total morale raised?", "\U0001F4E3 Rally over!\nMorale: 21"),
        ("paint", 0, "brush", 13, "strokes", "+", "-", 3, ">", 1,
         "\U0001F58C\uFE0F", "An artist's brush thins by 3 with each stroke. Total paint applied before it's too thin?", "\U0001F58C\uFE0F Canvas done!\nPaint: 40"),
    ]
    for v1, n1, v2, n2, vr, v1o, v2o, v2s, co, cval, emoji, goal, share in decay_themes:
        add(tmpl_while_decay(v1, n1, v2, n2, vr, v1o, v2o, v2s, co, cval,
                              emoji, goal, share, f"parsed_{idx:03d}", "medium"))

    # --- Hand-crafted medium-hard (30 more) ---
    # These use the original hand-crafted style from the existing 30 puzzles

    add(make_puzzle([
        [kw("let"), id_("fuel"), op("="), lit("100")],
        [kw("let"), id_("altitude"), op("="), lit("0")],
        [kw("let"), id_("thrust"), op("="), lit("25")],
        [kw("while"), id_("fuel"), op(">"), lit("0"), pn("{")],
        [id_("altitude"), op("="), id_("altitude"), op_m("+"), id_("thrust")],
        [id_("fuel"), op("="), id_("fuel"), op_m("-"), id_("thrust")],
        [pn("}")],
        [kw("return"), id_("altitude")],
    ], "\U0001F680 Burn thrust from fuel each tick. What altitude do we reach?",
       "\U0001F680 Launch successful!\nAltitude: \u2588\u2588\u2588\u2588\u2588 100m \u2705\nFuel: \u2591\u2591\u2591\u2591\u2591 empty", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("charge"), op("="), lit_m("2")],
        [kw("let"), id_("boost"), op("="), lit_m("3")],
        [kw("let"), id_("rounds"), op("="), lit("0")],
        [kw("while"), id_("rounds"), op("<"), lit("3"), pn("{")],
        [id_("charge"), op("="), id_("charge"), op_m("*"), id_("boost")],
        [id_("boost"), op("="), id_("boost"), op_m("-"), lit("1")],
        [id_("rounds"), op("="), id_("rounds"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("charge")],
    ], "\U0001F6E1\uFE0F A shield charges up by multiplying with its boost each round, but the boost decays. Final charge?",
       "\U0001F6E1\uFE0F Shield charged!\n2\u00D73\u00D72\u00D71 = 12\n\u26A1 Power: 12", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("trust"), op("="), lit("0")],
        [kw("let"), id_("fear"), op("="), lit_m("10")],
        [kw("let"), id_("days"), op("="), lit("0")],
        [kw("while"), id_("fear"), op_m(">"), id_("trust"), pn("{")],
        [id_("trust"), op("="), id_("trust"), op_m("+"), lit_m("3")],
        [id_("fear"), op("="), id_("fear"), op_m("-"), lit_m("1")],
        [id_("days"), op("="), id_("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("days")],
    ], "\U0001F409 Build trust (+3/day), fear fades (-1/day). Days to tame?",
       "\U0001F409 Dragon tamed!\nTrust: 9, Fear: 7\n3 days of patience!", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F6F8 Move +2x, +3y for 4 steps. Manhattan distance (x+y)?",
       "\U0001F6F8 Navigation complete!\nPosition: (8, 12)\nDistance: 20 \u2B50", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F3CE\uFE0F Car decelerates by drag each lap. Total distance?",
       "\U0001F3CE\uFE0F Race finished!\n10+8+6+4+2 = 30\nDistance: 30 \U0001F3C1", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("bait"), op("="), lit_m("6")],
        [kw("let"), id_("fish"), op("="), lit("0")],
        [kw("let"), id_("luck"), op("="), lit_m("2")],
        [kw("while"), id_("bait"), op_m(">"), lit("0"), pn("{")],
        [id_("fish"), op("="), id_("fish"), op_m("+"), id_("luck")],
        [id_("bait"), op("="), id_("bait"), op_m("-"), lit("1")],
        [pn("}")],
        [kw("return"), id_("fish")],
    ], "\U0001F3A3 Each bait catches 'luck' fish. How many fish total?",
       "\U0001F3A3 Great catch!\n\U0001F41F \u00D7 12\n6 bait used", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("power"), op("="), lit_m("1")],
        [kw("let"), id_("mana"), op("="), lit_m("5")],
        [kw("while"), id_("mana"), op_m(">"), lit("0"), pn("{")],
        [id_("power"), op("="), id_("power"), op_m("*"), lit_m("3")],
        [id_("mana"), op("="), id_("mana"), op_m("-"), lit("1")],
        [pn("}")],
        [kw("return"), id_("power")],
    ], "\U0001FA84 Triple spell power for each mana spent. Final power?",
       "\U0001FA84 Spell unleashed!\n1\u21923\u21929\u219227\u219281\u2192243\nPower: 243!", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("enemies"), op("="), lit_m("20")],
        [kw("let"), id_("tower"), op("="), lit_m("3")],
        [kw("let"), id_("waves"), op("="), lit("0")],
        [kw("while"), id_("enemies"), op_m(">"), lit("0"), pn("{")],
        [id_("enemies"), op("="), id_("enemies"), op_m("-"), id_("tower")],
        [id_("tower"), op("="), id_("tower"), op_m("+"), lit("1")],
        [id_("waves"), op("="), id_("waves"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("waves")],
    ], "\U0001F3F0 Tower gets stronger each wave (+1). Waves to clear all enemies?",
       "\U0001F3F0 All enemies defeated!\n5 waves survived\nTower power: 8", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("balance"), op("="), lit_m("100")],
        [kw("let"), id_("interest"), op("="), lit_m("10")],
        [kw("let"), id_("years"), op("="), lit("0")],
        [kw("while"), id_("years"), op("<"), lit_m("3"), pn("{")],
        [id_("balance"), op("="), id_("balance"), op_m("+"), id_("interest")],
        [id_("interest"), op("="), id_("interest"), op_m("+"), lit_m("5")],
        [id_("years"), op("="), id_("years"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("balance")],
    ], "\U0001F4B5 Interest grows by 5 each year. Balance after 3 years?",
       "\U0001F4B5 Investment matured!\n100+10+15+20 = 145\nBalance: 145", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("ore"), op("="), lit_m("50")],
        [kw("let"), id_("heat"), op("="), lit_m("10")],
        [kw("let"), id_("blade"), op("="), lit("0")],
        [kw("while"), id_("ore"), op_m(">"), lit_m("10"), pn("{")],
        [id_("blade"), op("="), id_("blade"), op_m("+"), id_("heat")],
        [id_("ore"), op("="), id_("ore"), op_m("-"), id_("heat")],
        [pn("}")],
        [kw("return"), id_("blade")],
    ], "\u2694\uFE0F Forge blade from ore using heat. Blade quality?",
       "\u2694\uFE0F Blade forged!\nQuality: 40\nOre remaining: 10", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("pos"), op("="), lit("0")],
        [kw("let"), id_("target"), op("="), lit_m("25")],
        [kw("let"), id_("step"), op("="), lit_m("5")],
        [kw("let"), id_("moves"), op("="), lit("0")],
        [kw("while"), id_("pos"), op_m("<"), id_("target"), pn("{")],
        [id_("pos"), op("="), id_("pos"), op_m("+"), id_("step")],
        [id_("moves"), op("="), id_("moves"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("moves")],
    ], "\U0001F9E9 Step toward the target. How many moves?",
       "\U0001F9E9 Maze solved!\n5 moves to reach position 25", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("zombies"), op("="), lit_m("2")],
        [kw("let"), id_("nights"), op("="), lit("0")],
        [kw("while"), id_("nights"), op("<"), lit_m("5"), pn("{")],
        [id_("zombies"), op("="), id_("zombies"), op_m("*"), lit_m("2")],
        [id_("nights"), op("="), id_("nights"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("zombies")],
    ], "\U0001F9DF Zombies double each night. How many zombies after 5 nights?",
       "\U0001F9DF Zombie apocalypse!\n2\u21924\u21928\u219216\u219232\u219264\nHorde: 64", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("gnomes"), op("="), lit_m("3")],
        [kw("let"), id_("flowers"), op("="), lit("0")],
        [kw("let"), id_("days"), op("="), lit("0")],
        [kw("while"), id_("days"), op("<"), lit_m("4"), pn("{")],
        [id_("flowers"), op("="), id_("flowers"), op_m("+"), id_("gnomes")],
        [id_("gnomes"), op("="), id_("gnomes"), op_m("+"), lit("1")],
        [id_("days"), op("="), id_("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("flowers")],
    ], "\U0001F33B Each gnome plants 1 flower/day, hire 1 new gnome/day. Total flowers?",
       "\U0001F33B Garden blooming!\n3+4+5+6 = 18 flowers\n\U0001F33C\U0001F33C\U0001F33C", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("cookies"), op("="), lit("0")],
        [kw("let"), id_("click"), op("="), lit_m("1")],
        [kw("let"), id_("rounds"), op("="), lit("0")],
        [kw("while"), id_("rounds"), op("<"), lit_m("6"), pn("{")],
        [id_("cookies"), op("="), id_("cookies"), op_m("+"), id_("click")],
        [id_("click"), op("="), id_("click"), op_m("+"), lit_m("2")],
        [id_("rounds"), op("="), id_("rounds"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("cookies")],
    ], "\U0001F36A Click power grows by 2 each round. Total cookies after 6?",
       "\U0001F36A Cookie frenzy!\n1+3+5+7+9+11 = 36\n36 cookies!", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("skill"), op("="), lit_m("5")],
        [kw("let"), id_("practice"), op("="), lit_m("3")],
        [kw("let"), id_f("sessions"), op("="), lit("0")],
        [kw("while"), id_("skill"), op_m("<"), lit_m("30"), pn("{")],
        [id_("skill"), op("="), id_("skill"), op_m("+"), id_("practice")],
        [id_("practice"), op("="), id_("practice"), op_m("+"), lit_m("1")],
        [id_f("sessions"), op("="), id_f("sessions"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("sessions")],
    ], "\U0001F3B9 Skill grows with increasing practice. Sessions to reach 30?",
       "\U0001F3B9 Mastery: 5+3+4+5+6+7 = 5 sessions", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("population"), op("="), lit_m("10")],
        [kw("let"), id_("food"), op("="), lit_m("8")],
        [kw("let"), id_f("months"), op("="), lit("0")],
        [kw("while"), id_("food"), op_m(">"), lit_m("2"), pn("{")],
        [id_("population"), op("="), id_("population"), op_m("+"), id_("food")],
        [id_("food"), op("="), id_("food"), op_m("-"), lit_m("2")],
        [id_f("months"), op("="), id_f("months"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("population")],
    ], "\U0001F3D8\uFE0F A village grows as food feeds new settlers, but the food supply shrinks each month. Final population?",
       "\U0001F3D8\uFE0F Village: 10+8+6+4 = 28 people", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("voltage"), op("="), lit_m("5")],
        [kw("let"), id_("resistance"), op("="), lit_m("20")],
        [kw("let"), id_f("steps"), op("="), lit("0")],
        [kw("while"), id_("resistance"), op_m(">"), lit_m("8"), pn("{")],
        [id_("voltage"), op("="), id_("voltage"), op_m("+"), lit_m("3")],
        [id_("resistance"), op("="), id_("resistance"), op_m("-"), lit_m("4")],
        [id_f("steps"), op("="), id_f("steps"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("voltage")],
    ], "\u26A1 An engineer boosts voltage while lowering resistance step by step. What's the voltage when resistance gets low enough?",
       "\u26A1 Circuit: 5+3+3+3 = 14 volts", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("altitude"), op("="), lit_m("100")],
        [kw("let"), id_("oxygen"), op("="), lit_m("50")],
        [kw("let"), id_f("hours"), op("="), lit("0")],
        [kw("while"), id_("oxygen"), op_m(">"), lit_m("10"), pn("{")],
        [id_("altitude"), op("="), id_("altitude"), op_m("+"), lit_m("15")],
        [id_("oxygen"), op("="), id_("oxygen"), op_m("-"), lit_m("10")],
        [id_f("hours"), op("="), id_f("hours"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("altitude")],
    ], "\U0001F3D4\uFE0F A mountaineer climbs higher each hour but burns oxygen. What altitude do they reach before O2 runs low?",
       "\U0001F3D4\uFE0F Summit: 100+15+15+15+15 = 160m", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("health"), op("="), lit_m("40")],
        [kw("let"), id_("regen"), op("="), lit_m("8")],
        [kw("let"), id_f("turns"), op("="), lit("0")],
        [kw("while"), id_("health"), op_m("<"), lit_m("60"), pn("{")],
        [id_("health"), op("="), id_("health"), op_m("+"), id_("regen")],
        [id_("regen"), op("="), id_("regen"), op_m("-"), lit_m("2")],
        [id_f("turns"), op("="), id_f("turns"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("turns")],
    ], "\u2764\uFE0F A wounded hero regenerates health, but the healing gets weaker each turn. How many turns to fully heal?",
       "\u2764\uFE0F Healed: 40+8+6+4+2 = 60 in 4 turns", "medium", f"parsed_{idx:03d}"))

    # ============================================
    # HARD: While + if/else inside (~50 puzzles)
    # ============================================

    # --- While + if (20) ---
    while_if_themes = [
        # (v1, n1, v2, n2, vr, lcv, lco, lcval, iv, io, ival, ibv, ibo, ibval, v1o, v1s, emoji, goal, share)
        ("energy", 30, "shield", 20, "hits", "energy", ">", 0, "shield", ">", 5,
         "shield", "-", 3, "-", 7,
         "\u26A1", "A fighter takes hits that drain energy. While shields hold, they absorb some damage. How many hits before collapse?",
         "\u26A1 Shields down!\n5 hits taken"),
        ("ammo", 24, "targets", 10, "kills", "ammo", ">", 0, "targets", ">", 3,
         "targets", "-", 2, "-", 4,
         "\U0001F52B", "A sniper picks off targets, spending ammo each shot. Clustered targets go down faster. How many kills?",
         "\U0001F52B Mission complete!\n6 targets eliminated"),
        ("mana", 40, "barrier", 15, "casts", "mana", ">", 0, "barrier", ">", 3,
         "barrier", "-", 3, "-", 8,
         "\U0001FA84", "A wizard hurls spells, draining mana each cast. While the barrier holds, each spell weakens it. Total casts?",
         "\U0001FA84 Spellstorm!\n5 spells cast"),
        ("budget", 50, "staff", 10, "months", "budget", ">", 0, "staff", ">", 4,
         "staff", "-", 2, "-", 10,
         "\U0001F4B8", "A startup burns budget monthly. While overstaffed, they downsize. How many months does the money last?",
         "\U0001F4B8 Runway gone!\n5 months survived"),
        ("patience", 35, "noise", 12, "days", "patience", ">", 0, "noise", ">", 6,
         "noise", "-", 2, "-", 7,
         "\U0001F624", "A writer's patience drains daily from noise. Noisy neighbors gradually quiet down. How many days until they snap?",
         "\U0001F624 Snapped!\n5 days of noise"),
        ("water", 45, "crops", 8, "harvests", "water", ">", 0, "crops", ">", 2,
         "crops", "-", 1, "-", 9,
         "\U0001F4A7", "A farmer waters crops each harvest, but some crops wilt over time. How many harvests until the well runs dry?",
         "\U0001F4A7 Well dry!\n5 harvests gathered"),
        ("rope", 28, "knots", 8, "climbs", "rope", ">", 0, "knots", ">", 2,
         "knots", "-", 2, "-", 7,
         "\U0001FA62", "A climber uses rope each ascent. While it's knotted, they untie sections. How many climbs?",
         "\U0001FA62 Summit reached!\n4 climbs"),
        ("fuel", 36, "speed", 12, "trips", "fuel", ">", 0, "speed", ">", 6,
         "speed", "-", 2, "-", 6,
         "\u26FD", "A delivery truck burns fuel each trip. At high speed, the driver gradually slows down. Total trips?",
         "\u26FD All delivered!\n6 trips"),
        ("health", 42, "venom", 10, "bites", "health", ">", 0, "venom", ">", 4,
         "venom", "-", 2, "-", 7,
         "\U0001F40D", "A snake bites the explorer! Each bite drains health, but antivenom weakens the poison. Bites survived?",
         "\U0001F40D Survived!\n6 bites endured"),
        ("ink", 32, "color", 8, "pages", "ink", ">", 0, "color", ">", 2,
         "color", "-", 1, "-", 8,
         "\U0001F5A8\uFE0F", "A printer uses ink each page. Color intensity fades with each print. How many pages before the ink runs out?",
         "\U0001F5A8\uFE0F Ink empty!\n4 pages printed"),
        ("credits", 25, "loans", 10, "payments", "credits", ">", 0, "loans", ">", 4,
         "loans", "-", 2, "-", 5,
         "\U0001F3E6", "A student makes monthly loan payments. Multiple loans get consolidated over time. Months to pay off?",
         "\U0001F3E6 Debt free!\n5 payments made"),
        ("stamina", 40, "terrain", 8, "miles", "stamina", ">", 0, "terrain", ">", 2,
         "terrain", "-", 1, "-", 8,
         "\U0001F3DE\uFE0F", "A hiker loses stamina each mile. Rough terrain gradually smooths out as trails improve. Miles hiked?",
         "\U0001F3DE\uFE0F Trail complete!\n5 miles hiked"),
        ("sanity", 30, "horror", 10, "rooms", "sanity", ">", 0, "horror", ">", 4,
         "horror", "-", 2, "-", 6,
         "\U0001F47B", "Exploring a haunted mansion! Each room drains sanity. The horror lessens deeper in. Rooms explored?",
         "\U0001F47B Escaped!\n5 rooms survived"),
        ("battery", 48, "signal", 12, "calls", "battery", ">", 0, "signal", ">", 4,
         "signal", "-", 2, "-", 8,
         "\U0001F4F1", "A phone drains battery each call. Strong signal weakens as you move away. How many calls?",
         "\U0001F4F1 Battery dead!\n6 calls made"),
        ("air", 36, "depth", 8, "dives", "air", ">", 0, "depth", ">", 2,
         "depth", "-", 1, "-", 6,
         "\U0001F93F", "A scuba diver uses air each dive. As they go shallower, depth decreases. How many dives?",
         "\U0001F93F Surfaced!\n6 dives completed"),
        ("stock", 40, "demand", 10, "sales", "stock", ">", 0, "demand", ">", 4,
         "demand", "-", 2, "-", 8,
         "\U0001F6D2", "A shop sells inventory each cycle. High demand fades as the trend passes. Total sales cycles?",
         "\U0001F6D2 Sold out!\n5 sales cycles"),
        ("clay", 35, "kiln", 10, "firings", "clay", ">", 0, "kiln", ">", 4,
         "kiln", "-", 2, "-", 7,
         "\U0001FAD9", "A potter uses clay each firing. The kiln cools between batches. How many firings?",
         "\U0001FAD9 Kiln cooled!\n5 firings done"),
        ("seeds", 30, "pests", 8, "plantings", "seeds", ">", 0, "pests", ">", 3,
         "pests", "-", 1, "-", 6,
         "\U0001F331", "A gardener uses seeds each planting. Pest control slowly eliminates the bugs. Total plantings?",
         "\U0001F331 Garden blooming!\n5 plantings"),
        ("wood", 42, "rain", 12, "builds", "wood", ">", 0, "rain", ">", 4,
         "rain", "-", 2, "-", 7,
         "\U0001FA9A", "A carpenter uses wood each build. Rainy days slow progress but gradually clear up. Builds completed?",
         "\U0001FA9A Workshop busy!\n6 builds done"),
        ("stone", 32, "cracks", 8, "blocks", "stone", ">", 0, "cracks", ">", 2,
         "cracks", "-", 1, "-", 8,
         "\U0001FAA8", "A sculptor carves stone blocks. Cracks in the stone smooth out over time. How many blocks carved?",
         "\U0001FAA8 Masterpiece!\n4 blocks carved"),
    ]
    for v1, n1, v2, n2, vr, lcv, lco, lcval, iv, io, ival, ibv, ibo, ibval, v1o, v1s, emoji, goal, share in while_if_themes:
        add(tmpl_while_if(v1, n1, v2, n2, vr, lcv, lco, lcval, iv, io, ival, ibv, ibo, ibval, v1o, v1s,
                           emoji, goal, share, f"parsed_{idx:03d}"))

    # --- Hand-crafted hard puzzles (30 more) ---

    add(make_puzzle([
        [kw("let"), id_("hp"), op("="), lit_m("50")],
        [kw("let"), id_("armor"), op("="), lit_m("5")],
        [kw("let"), id_("damage"), op("="), lit_m("12")],
        [kw("let"), id_("rooms"), op("="), lit("0")],
        [kw("while"), id_("hp"), op_m(">"), lit("0"), pn("{")],
        [id_("hp"), op("="), id_("hp"), op_m("-"), id_("damage"), op_m("+"), id_("armor")],
        [id_("rooms"), op("="), id_("rooms"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("rooms")],
    ], "\u2694\uFE0F Each room deals damage, armor blocks some. How many rooms?",
       "\u2694\uFE0F Dungeon cleared!\n8 rooms survived", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F9EA Stir 5 times (doubles potency), add heat bonus if hot enough",
       "\U0001F9EA Potion brewed!\nPotency: 47 \u2728", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F4B0 A thief raids a vault. Rich haul? Grab the gold plus a gem bonus. Poor haul? Just pocket gems. Total loot?",
       "\U0001F4B0 Vault raided!\nGold: 40 + Bonus: 35\nTotal loot: 75!", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F525 Burn 2 wood per tick, cook 1 food if available. How many cooked?",
       "\U0001F525 Campfire done!\n\U0001F356\U0001F356\U0001F356\U0001F356\U0001F356 cooked\n5 meals prepared!", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("a"), op("="), lit_m("7")],
        [kw("let"), id_("b"), op("="), lit_m("3")],
        [kw("let"), id_("key"), op("="), id_("a"), op_m("+"), id_("b")],
        [kw("let"), id_("temp"), op("="), id_("a"), op_m("*"), id_("b")],
        [id_("a"), op("="), id_("temp"), op_m("-"), id_("key")],
        [id_("b"), op("="), id_("temp"), op_m("+"), id_("key")],
        [kw("return"), id_("a"), op_m("+"), id_("b")],
    ], "\U0001F510 A cipher adds a and b for a key, multiplies them for a temp value, then transforms both. What's a+b after encryption?",
       "\U0001F510 Encrypted!\na=11, b=31\nCipher: 42", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("boss"), op("="), lit_m("30")],
        [kw("let"), id_("hero"), op("="), lit_m("20")],
        [kw("let"), id_("turns"), op("="), lit("0")],
        [kw("while"), id_("boss"), op_m(">"), lit("0"), pn("{")],
        [id_("boss"), op("="), id_("boss"), op_m("-"), id_("hero")],
        [id_("hero"), op("="), id_("hero"), op_m("-"), lit_m("5")],
        [id_("turns"), op("="), id_("turns"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("turns")],
    ], "\U0001F47E Hero attacks boss, but weakens by 5 each turn. How many turns?",
       "\U0001F47E Boss defeated!\nTurn 1: 20 dmg, Turn 2: 15 dmg\nVictory in 2 turns!", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F33E Plant seeds (need 3 water each). How many crops grow?",
       "\U0001F33E Harvest complete!\n\U0001F33D\U0001F33D\U0001F33D\U0001F33D crops\nWater used: 12", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("walls"), op("="), lit_m("100")],
        [kw("let"), id_("catapult"), op("="), lit_m("15")],
        [kw("let"), id_("repair"), op("="), lit_m("5")],
        [kw("let"), id_("volleys"), op("="), lit("0")],
        [kw("while"), id_("walls"), op_m(">"), lit("0"), pn("{")],
        [id_("walls"), op("="), id_("walls"), op_m("-"), id_("catapult"), op_m("+"), id_("repair")],
        [id_("volleys"), op("="), id_("volleys"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("volleys")],
    ], "\U0001F3F0 Catapult hits walls, defenders repair. How many volleys to breach?",
       "\U0001F3F0 Castle breached!\nWalls crumbled after 10 volleys", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("iron"), op("="), lit_m("16")],
        [kw("let"), id_("magic"), op("="), lit_m("4")],
        [kw("let"), id_("gold"), op("="), lit("0")],
        [kw("while"), id_("magic"), op_m(">"), lit("0"), pn("{")],
        [id_("gold"), op("="), id_("gold"), op_m("+"), id_("iron"), op_m("/"), id_("magic")],
        [id_("magic"), op("="), id_("magic"), op_m("-"), lit("1")],
        [pn("}")],
        [kw("return"), id_("gold")],
    ], "\u2728 Transmute iron/magic each round (magic shrinks). Total gold?",
       "\u2728 Transmutation complete!\n4+5+8+16 = 33 gold \U0001FA99", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001FA82 Object falls with accelerating gravity. Ticks to hit ground?",
       "\U0001FA82 Impact!\nFell from 100m\n4 ticks to ground", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("battery"), op("="), lit_m("100")],
        [kw("let"), id_("screen"), op("="), lit_m("8")],
        [kw("let"), id_("radio"), op("="), lit_m("2")],
        [kw("let"), id_("hours"), op("="), lit("0")],
        [kw("while"), id_("battery"), op_m(">"), lit_m("20"), pn("{")],
        [id_("battery"), op("="), id_("battery"), op_m("-"), id_("screen"), op_m("-"), id_("radio")],
        [id_("hours"), op("="), id_("hours"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("hours")],
    ], "\U0001F50B Screen and radio drain battery. Hours until 20% left?",
       "\U0001F50B Battery died!\n8 hours of use\n\U0001FAAB empty", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("celsius"), op("="), lit_m("20")],
        [kw("let"), id_("factor"), op("="), lit_m("9")],
        [kw("let"), id_("divisor"), op("="), lit_m("5")],
        [kw("let"), id_("offset"), op("="), lit_m("32")],
        [kw("let"), id_f("fahrenheit"), op("="), id_("celsius"), op_m("*"), id_("factor"), op_m("/"), id_("divisor"), op_m("+"), id_("offset")],
        [kw("return"), id_f("fahrenheit")],
    ], "\U0001F321\uFE0F The weather app shows Celsius. Convert it to Fahrenheit using the classic formula. How hot is it?",
       "\U0001F321\uFE0F Temperature converted!\n20\u00B0C = 68\u00B0F", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
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
    ], "\U0001F392 Pack your bag! Count swords and shields as gear, add potions for total. If total is over 10, take everything. Otherwise just the gear. What do you carry?",
       "\U0001F392 Inventory full!\nGear: 8, Potions: 8\nTotal: 16 items", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("total"), op("="), lit_m("120")],
        [kw("let"), id_("pirates"), op("="), lit_m("4")],
        [kw("let"), id_("captain"), op("="), id_("total"), op_m("/"), id_("pirates")],
        [kw("let"), id_("crew"), op("="), id_("total"), op_m("-"), id_("captain")],
        [kw("return"), id_("crew")],
    ], "\U0001F3F4\u200D\u2620\uFE0F The captain claims their share of the treasure (divided by the pirate count). What does the crew get?",
       "\U0001F3F4\u200D\u2620\uFE0F Treasure split!\nCaptain: 30\nCrew: 90", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("width"), op("="), lit_m("4")],
        [kw("let"), id_("height"), op("="), lit_m("3")],
        [kw("let"), id_("pixels"), op("="), id_("width"), op_m("*"), id_("height")],
        [kw("let"), id_("colored"), op("="), id_("pixels"), op_m("-"), lit_m("2")],
        [kw("return"), id_("colored")],
    ], "\U0001F3A8 An artist fills a canvas (width times height pixels), but leaves 2 blank for contrast. How many colored?",
       "\U0001F3A8 Art complete!\n4\u00D73 = 12 pixels\n10 colored \U0001F58C\uFE0F", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("bpm"), op("="), lit_m("120")],
        [kw("let"), id_("bars"), op("="), lit_m("8")],
        [kw("let"), id_("beats"), op("="), lit_m("4")],
        [kw("let"), id_f("totalBeats"), op("="), id_("bars"), op_m("*"), id_("beats")],
        [kw("let"), id_f("seconds"), op("="), id_("totalBeats"), op_m("*"), lit_m("60"), op_m("/"), id_("bpm")],
        [kw("return"), id_f("seconds")],
    ], "\U0001F3B5 A DJ's track has bars of beats at a set tempo. How many seconds does the song last?",
       "\U0001F3B5 Track finished!\n32 beats \u00D7 60 / 120\n16 seconds \U0001F3B6", "hard", f"parsed_{idx:03d}"))

    # More hard puzzles with unique themes
    add(make_puzzle([
        [kw("let"), id_("crew"), op("="), lit_m("12")],
        [kw("let"), id_("rations"), op("="), lit_m("48")],
        [kw("let"), id_f("days"), op("="), lit("0")],
        [kw("while"), id_("rations"), op_m(">"), lit("0"), pn("{")],
        [kw("if"), id_("crew"), op_m(">"), lit_m("6"), pn("{")],
        [id_("crew"), op("="), id_("crew"), op_m("-"), lit_m("2")],
        [pn("}")],
        [id_("rations"), op("="), id_("rations"), op_m("-"), id_("crew")],
        [id_f("days"), op("="), id_f("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("days")],
    ], "\U0001F3F4\u200D\u2620\uFE0F A pirate crew eats rations daily. While overstaffed, some crew members abandon ship. How many days do rations last?",
       "\U0001F3F4\u200D\u2620\uFE0F Land ho!\nSurvived N days at sea", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("horde"), op("="), lit_m("25")],
        [kw("let"), id_("archers"), op("="), lit_m("3")],
        [kw("let"), id_f("volleys"), op("="), lit("0")],
        [kw("while"), id_("horde"), op_m(">"), lit("0"), pn("{")],
        [id_("horde"), op("="), id_("horde"), op_m("-"), id_("archers")],
        [id_("archers"), op("="), id_("archers"), op_m("+"), lit_m("1")],
        [id_f("volleys"), op("="), id_f("volleys"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("volleys")],
    ], "\U0001F3F9 Archers train between volleys, getting better each time. How many volleys to clear the horde?",
       "\U0001F3F9 Horde defeated!\nVictory in N volleys", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("temp"), op("="), lit_m("200")],
        [kw("let"), id_("cool"), op("="), lit_m("15")],
        [kw("let"), id_f("minutes"), op("="), lit("0")],
        [kw("while"), id_("temp"), op_m(">"), lit_m("50"), pn("{")],
        [kw("if"), id_("temp"), op_m(">"), lit_m("100"), pn("{")],
        [id_("temp"), op("="), id_("temp"), op_m("-"), id_("cool"), op_m("-"), lit_m("5")],
        [pn("}"), kw("else"), pn("{")],
        [id_("temp"), op("="), id_("temp"), op_m("-"), id_("cool")],
        [pn("}")],
        [id_f("minutes"), op("="), id_f("minutes"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("minutes")],
    ], "\U0001F525 A blacksmith cools a blade. It cools faster when red-hot, slower once it dims. Minutes to reach safe temp?",
       "\U0001F525 Blade quenched!\nCooled in N minutes", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("reactor"), op("="), lit_m("0")],
        [kw("let"), id_("rods"), op("="), lit_m("8")],
        [kw("let"), id_f("cycles"), op("="), lit("0")],
        [kw("while"), id_f("cycles"), op("<"), lit_m("4"), pn("{")],
        [kw("let"), id_f("output"), op("="), id_("rods"), op_m("*"), lit_m("3")],
        [id_("reactor"), op("="), id_("reactor"), op_m("+"), id_f("output")],
        [id_("rods"), op("="), id_("rods"), op_m("-"), lit_m("2")],
        [id_f("cycles"), op("="), id_f("cycles"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("reactor")],
    ], "\u2622\uFE0F A nuclear reactor's fuel rods deplete each cycle. Each rod generates 3 energy. Total reactor output after 4 cycles?",
       "\u2622\uFE0F Reactor shutdown!\nTotal output generated", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("debt"), op("="), lit_m("100")],
        [kw("let"), id_("interest"), op("="), lit_m("10")],
        [kw("let"), id_("payment"), op("="), lit_m("30")],
        [kw("let"), id_f("months"), op("="), lit("0")],
        [kw("while"), id_("debt"), op_m(">"), lit("0"), pn("{")],
        [id_("debt"), op("="), id_("debt"), op_m("+"), id_("interest"), op_m("-"), id_("payment")],
        [id_f("months"), op("="), id_f("months"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("months")],
    ], "\U0001F3E6 Debt gains interest but you pay monthly. Months to freedom?",
       "\U0001F3E6 Debt free! N months", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("fish"), op("="), lit_m("50")],
        [kw("let"), id_("caught"), op("="), lit_m("8")],
        [kw("let"), id_("breed"), op("="), lit_m("3")],
        [kw("let"), id_f("seasons"), op("="), lit("0")],
        [kw("while"), id_("fish"), op_m(">"), lit_m("20"), pn("{")],
        [id_("fish"), op("="), id_("fish"), op_m("-"), id_("caught"), op_m("+"), id_("breed")],
        [id_f("seasons"), op("="), id_f("seasons"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("seasons")],
    ], "\U0001F41F Fishers catch from the lake each season, but fish breed back some. How many seasons until the lake is depleted?",
       "\U0001F41F Lake empty!\nN seasons of fishing", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("morale"), op("="), lit_m("10")],
        [kw("let"), id_("troops"), op("="), lit_m("100")],
        [kw("let"), id_f("battles"), op("="), lit("0")],
        [kw("while"), id_("troops"), op_m(">"), lit_m("20"), pn("{")],
        [kw("if"), id_("morale"), op_m(">"), lit_m("5"), pn("{")],
        [id_("troops"), op("="), id_("troops"), op_m("-"), lit_m("10")],
        [pn("}"), kw("else"), pn("{")],
        [id_("troops"), op("="), id_("troops"), op_m("-"), lit_m("20")],
        [pn("}")],
        [id_("morale"), op("="), id_("morale"), op_m("-"), lit_m("2")],
        [id_f("battles"), op("="), id_f("battles"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("battles")],
    ], "\u2694\uFE0F An army fights battles. High morale means fewer losses, but morale drops each fight. How many battles before the army is too small?",
       "\u2694\uFE0F Campaign over!\nN battles fought", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("pressure"), op("="), lit_m("60")],
        [kw("let"), id_("valve"), op("="), lit_m("20")],
        [kw("let"), id_f("releases"), op("="), lit("0")],
        [kw("while"), id_("pressure"), op_m(">"), lit_m("10"), pn("{")],
        [id_("pressure"), op("="), id_("pressure"), op_m("-"), id_("valve")],
        [id_("valve"), op("="), id_("valve"), op_m("-"), lit_m("5")],
        [id_f("releases"), op("="), id_f("releases"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("releases")],
    ], "\U0001F4A8 A pressure valve gets weaker each release. How many releases before the pressure drops to a safe level?",
       "\U0001F4A8 Safe pressure!\n4 releases needed", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("students"), op("="), lit_m("40")],
        [kw("let"), id_("passed"), op("="), lit("0")],
        [kw("let"), id_("bar"), op("="), lit_m("30")],
        [kw("while"), id_("bar"), op_m(">"), lit_m("10"), pn("{")],
        [kw("if"), id_("students"), op_m(">"), id_("bar"), pn("{")],
        [id_("passed"), op("="), id_("passed"), op_m("+"), lit_m("5")],
        [pn("}")],
        [id_("bar"), op("="), id_("bar"), op_m("-"), lit_m("5")],
        [id_("students"), op("="), id_("students"), op_m("-"), lit_m("8")],
        [pn("}")],
        [kw("return"), id_("passed")],
    ], "\U0001F393 Students pass if they score above the bar. Each semester the bar drops and students leave. How many passed?",
       "\U0001F393 Graduation day!\nN students passed", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("sun"), op("="), lit_m("100")],
        [kw("let"), id_("panels"), op("="), lit_m("4")],
        [kw("let"), id_("stored"), op("="), lit("0")],
        [kw("let"), id_f("hours"), op("="), lit("0")],
        [kw("while"), id_("sun"), op_m(">"), lit_m("20"), pn("{")],
        [kw("let"), id_f("gen"), op("="), id_("panels"), op_m("*"), lit_m("3")],
        [id_("stored"), op("="), id_("stored"), op_m("+"), id_f("gen")],
        [id_("sun"), op("="), id_("sun"), op_m("-"), lit_m("16")],
        [id_f("hours"), op("="), id_f("hours"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("stored")],
    ], "\u2600\uFE0F Solar panels generate energy each hour, but the sun gradually sets. How much is stored before dark?",
       "\u2600\uFE0F Sunset!\nN energy stored", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("army"), op("="), lit_m("60")],
        [kw("let"), id_("fort"), op("="), lit_m("40")],
        [kw("let"), id_f("rounds"), op("="), lit("0")],
        [kw("while"), id_("fort"), op_m(">"), lit("0"), pn("{")],
        [kw("let"), id_f("strike"), op("="), id_("army"), op_m("/"), lit_m("6")],
        [id_("fort"), op("="), id_("fort"), op_m("-"), id_f("strike")],
        [id_("army"), op("="), id_("army"), op_m("-"), lit_m("5")],
        [id_f("rounds"), op("="), id_f("rounds"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("rounds")],
    ], "\U0001F3F0 An army besieges a fort, dealing damage based on its size. But soldiers fall each round. Rounds to breach the walls?",
       "\U0001F3F0 Walls breached!\nN rounds of siege", "hard", f"parsed_{idx:03d}"))

    # ============================================
    # ADDITIONAL PUZZLES to reach 365
    # ============================================

    # More for loop accumulators
    extra_for_accum = [
        ("apples", 6, 5, "\U0001F34E", "Pick 5 apples from each of 6 trees. Total apples?", "\U0001F34E Picked: 30 apples!"),
        ("xp", 4, 15, "\U0001F47E", "Defeat 4 monsters worth 15 XP each. Total XP?", "\U0001F47E XP: 60!"),
        ("planks", 7, 3, "\U0001FA9A", "Cut 3 planks from each of 7 logs. Total planks?", "\U0001FA9A Cut: 21 planks!"),
    ]
    for vr, n_end, k, emoji, goal, share in extra_for_accum:
        add(tmpl_for_accum(vr, n_end, k, emoji, goal, share, f"parsed_{idx:03d}"))

    # More for loop triangular
    extra_for_tri = [
        ("stacks", 8, "\U0001F4DA", "Stack books: 1 on shelf 1, 2 on shelf 2, up to shelf 8. Total stacks?", "\U0001F4DA Stacked: 36!"),
        ("reps", 6, "\U0001F3CB\uFE0F", "Workout: 1 rep set 1, 2 reps set 2, up to set 6. Total reps?", "\U0001F3CB\uFE0F Reps: 21!"),
    ]
    for vr, n_end, emoji, goal, share in extra_for_tri:
        add(tmpl_for_triangular(vr, n_end, emoji, goal, share, f"parsed_{idx:03d}"))

    # More for loop multiply
    extra_for_mul = [
        ("cells", 5, 2, "\U0001F9EC", "Cells divide: they double each generation for 5 generations. Final count?", "\U0001F9EC Cells: 32!"),
        ("zombies", 4, 3, "\U0001F9DF", "Zombies triple each night for 4 nights. Final horde?", "\U0001F9DF Horde: 81!"),
    ]
    for vr, n_end, k, emoji, goal, share in extra_for_mul:
        add(tmpl_for_multiply(vr, n_end, k, emoji, goal, share, f"parsed_{idx:03d}"))

    # More for loop + if
    extra_for_if = [
        ("points", 10, 5, "\U0001F3C5", "A judge scores 10 rounds. The first 5 don't count, but each one after earns points equal to its number. Total points?", "\U0001F3C5 Points: 40!"),
        ("profit", 8, 4, "\U0001F4B0", "Run a shop for 8 days. The first 4 are slow, but each busy one after that earns profit equal to its number. Total profit?", "\U0001F4B0 Profit: 26!"),
        ("letters", 7, 3, "\u2709\uFE0F", "Write 7 letters. Only long ones (above 3) need postage equal to the letter number. Total letters?", "\u2709\uFE0F Letters: 22!"),
    ]
    for vr, n_end, threshold, emoji, goal, share in extra_for_if:
        add(tmpl_for_if(vr, n_end, threshold, emoji, goal, share, f"parsed_{idx:03d}"))

    # More if/else
    extra_ifelse = [
        ("crystal", 30, "threshold", 25, ">", "strength", "crystal", "+", 15, "crystal", "-", 10,
         "\U0001F48E", "A mage examines a crystal. Pure enough? Amplify its power. Flawed? It shatters a bit. Crystal strength?", "\U0001F48E Crystal amplified!\nStrength: 45"),
        ("voltage", 60, "limit", 50, ">", "circuit", "voltage", "-", 20, "voltage", "+", 15,
         "\u26A1", "The circuit hits a voltage spike! Over the limit? Blow a fuse. Under? Boost the signal. Circuit voltage?", "\u26A1 Circuit adjusted!\nVoltage: 40"),
        ("pollen", 25, "threshold", 20, ">", "harvest", "pollen", "*", 2, "pollen", "+", 5,
         "\U0001F41D", "The bees return heavy with pollen. Enough for a big batch? Double the honey yield! Small haul? Add a little extra. Harvest?", "\U0001F41D Honey season!\nHarvest: 50"),
    ]
    for v1, n1, v2, n2, cmp, vr, tv, top, ta, fv, fop, fa, emoji, goal, share in extra_ifelse:
        add(tmpl_if_else_simple(v1, n1, v2, n2, cmp, vr, tv, top, ta, fv, fop, fa,
                                 emoji, goal, share, f"parsed_{idx:03d}"))

    # More while countdown
    extra_countdown = [
        ("wax", 33, 11, "candles", "\U0001F56F\uFE0F", "Melt 11 wax per candle. Candles made?", "\U0001F56F\uFE0F Candles: 3"),
        ("ribbon", 48, 6, "bows", "\U0001F380", "Use 6 ribbon per bow. Bows tied?", "\U0001F380 Bows: 8"),
        ("dough", 36, 4, "pastries", "\U0001F950", "Use 4 dough per pastry. Pastries baked?", "\U0001F950 Pastries: 9"),
        ("seeds", 44, 11, "rows", "\U0001F33F", "Plant 11 seeds per row. Rows planted?", "\U0001F33F Rows: 4"),
    ]
    for v1, n1, step, vr, emoji, goal, share in extra_countdown:
        add(tmpl_while_countdown(v1, n1, step, vr, emoji, goal, share, f"parsed_{idx:03d}"))

    # More while accum
    extra_accum = [
        ("output", 5, "total", "factory", 4, 3, "\U0001F3ED", "A factory's output increases by 4 each shift as machines warm up. What total is produced in 3 shifts?", "\U0001F3ED All shipped!\nTotal: 27"),
        ("height", 2, "climbed", "wall", 3, 4, "\U0001F9D7", "A rock climber finds better grips each attempt, gaining 3 more height. How high after 4 attempts?", "\U0001F9D7 Top reached!\nClimbed: 26"),
    ]
    for v1, n1, vr, vacc, step, limit, emoji, goal, share in extra_accum:
        add(tmpl_while_accum(v1, n1, vr, vacc, step, limit, emoji, goal, share, f"parsed_{idx:03d}"))

    # More decay loops
    extra_decay = [
        ("tokens", 0, "energy", 9, "laps", "+", "-", 1, ">", 0,
         "\U0001F3C3", "A runner collects energy tokens each lap, but tires out (-1 energy per lap). Total tokens before exhaustion?", "\U0001F3C3 Finish line!\nTokens: 45"),
        ("mined", 0, "vein", 10, "digs", "+", "-", 2, ">", 0,
         "\u26CF\uFE0F", "A gold vein thins by 2 with each dig. How much is mined before the vein runs out?", "\u26CF\uFE0F Vein tapped!\nMined: 30"),
        ("points", 0, "streak", 8, "games", "+", "-", 2, ">", 0,
         "\U0001F3C0", "A winning streak earns points but fades by 2 each game. Total points before the streak breaks?", "\U0001F3C0 Streak ended!\nPoints: 20"),
    ]
    for v1, n1, v2, n2, vr, v1o, v2o, v2s, co, cval, emoji, goal, share in extra_decay:
        add(tmpl_while_decay(v1, n1, v2, n2, vr, v1o, v2o, v2s, co, cval,
                              emoji, goal, share, f"parsed_{idx:03d}", "medium"))

    # More hand-crafted medium
    add(make_puzzle([
        [kw("let"), id_("dice"), op("="), lit_m("6")],
        [kw("let"), id_("score"), op("="), lit("0")],
        [kw("let"), id_f("rolls"), op("="), lit("0")],
        [kw("while"), id_f("rolls"), op("<"), lit_m("5"), pn("{")],
        [id_("score"), op("="), id_("score"), op_m("+"), id_("dice")],
        [id_("dice"), op("="), id_("dice"), op_m("-"), lit_m("1")],
        [id_f("rolls"), op("="), id_f("rolls"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("score")],
    ], "\U0001F3B2 Dice value drops by 1 each roll. Score after 5 rolls?",
       "\U0001F3B2 Score: 6+5+4+3+2 = 20", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("fans"), op("="), lit_m("100")],
        [kw("let"), id_("hype"), op("="), lit_m("20")],
        [kw("let"), id_f("weeks"), op("="), lit("0")],
        [kw("while"), id_("hype"), op_m(">"), lit_m("5"), pn("{")],
        [id_("fans"), op("="), id_("fans"), op_m("+"), id_("hype")],
        [id_("hype"), op("="), id_("hype"), op_m("-"), lit_m("5")],
        [id_f("weeks"), op("="), id_f("weeks"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("fans")],
    ], "\U0001F3A4 Fan growth fades by 5 each week. Final fans?",
       "\U0001F3A4 Fans: 100+20+15+10 = 145", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("recipe"), op("="), lit_m("3")],
        [kw("let"), id_("dishes"), op("="), lit("0")],
        [kw("let"), id_f("days"), op("="), lit("0")],
        [kw("while"), id_f("days"), op("<"), lit_m("4"), pn("{")],
        [id_("dishes"), op("="), id_("dishes"), op_m("+"), id_("recipe")],
        [id_("recipe"), op("="), id_("recipe"), op_m("+"), lit_m("2")],
        [id_f("days"), op("="), id_f("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_("dishes")],
    ], "\U0001F373 Learn 2 new recipes each day. Total dishes after 4 days?",
       "\U0001F373 Dishes: 3+5+7+9 = 24", "medium", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("orbit"), op("="), lit_m("10")],
        [kw("let"), id_("thrust"), op("="), lit_m("4")],
        [kw("let"), id_f("burns"), op("="), lit("0")],
        [kw("while"), id_("orbit"), op_m("<"), lit_m("30"), pn("{")],
        [id_("orbit"), op("="), id_("orbit"), op_m("+"), id_("thrust")],
        [id_("thrust"), op("="), id_("thrust"), op_m("+"), lit_m("1")],
        [id_f("burns"), op("="), id_f("burns"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("burns")],
    ], "\U0001F6F0\uFE0F Thrust increases +1 each burn. Burns to reach orbit 30?",
       "\U0001F6F0\uFE0F Orbit: N burns", "medium", f"parsed_{idx:03d}"))

    # More hard: while+if
    add(make_puzzle([
        [kw("let"), id_("ship"), op("="), lit_m("80")],
        [kw("let"), id_("cargo"), op("="), lit_m("15")],
        [kw("let"), id_f("trips"), op("="), lit("0")],
        [kw("while"), id_("ship"), op_m(">"), lit_m("10"), pn("{")],
        [kw("if"), id_("cargo"), op_m(">"), lit_m("5"), pn("{")],
        [id_("ship"), op("="), id_("ship"), op_m("-"), id_("cargo")],
        [id_("cargo"), op("="), id_("cargo"), op_m("-"), lit_m("3")],
        [pn("}"), kw("else"), pn("{")],
        [id_("ship"), op("="), id_("ship"), op_m("-"), lit_m("5")],
        [pn("}")],
        [id_f("trips"), op("="), id_f("trips"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("trips")],
    ], "\U0001F6A2 A cargo ship unloads each trip. Heavy cargo shrinks as it's delivered. Light loads? Fixed cost instead. Total trips?",
       "\U0001F6A2 All delivered!\nN trips completed", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("soil"), op("="), lit_m("50")],
        [kw("let"), id_("rain"), op("="), lit_m("12")],
        [kw("let"), id_("harvest"), op("="), lit("0")],
        [kw("while"), id_("soil"), op_m(">"), lit_m("10"), pn("{")],
        [kw("if"), id_("rain"), op_m(">"), lit_m("4"), pn("{")],
        [id_("harvest"), op("="), id_("harvest"), op_m("+"), id_("rain")],
        [id_("rain"), op("="), id_("rain"), op_m("-"), lit_m("2")],
        [pn("}"), kw("else"), pn("{")],
        [id_("harvest"), op("="), id_("harvest"), op_m("+"), lit_m("2")],
        [pn("}")],
        [id_("soil"), op("="), id_("soil"), op_m("-"), lit_m("8")],
        [pn("}")],
        [kw("return"), id_("harvest")],
    ], "\U0001F33E A farm harvests what the rain provides, but rain fades and soil depletes. What's the harvest?",
       "\U0001F33E Season over!\nTotal harvest gathered", "hard", f"parsed_{idx:03d}"))

    add(make_puzzle([
        [kw("let"), id_("ice"), op("="), lit_m("40")],
        [kw("let"), id_("sun"), op("="), lit_m("10")],
        [kw("let"), id_f("days"), op("="), lit("0")],
        [kw("while"), id_("ice"), op_m(">"), lit("0"), pn("{")],
        [kw("if"), id_("sun"), op_m(">"), lit_m("6"), pn("{")],
        [id_("ice"), op("="), id_("ice"), op_m("-"), id_("sun")],
        [pn("}"), kw("else"), pn("{")],
        [id_("ice"), op("="), id_("ice"), op_m("-"), lit_m("3")],
        [pn("}")],
        [id_("sun"), op("="), id_("sun"), op_m("-"), lit_m("2")],
        [id_f("days"), op("="), id_f("days"), op("+"), lit("1")],
        [pn("}")],
        [kw("return"), id_f("days")],
    ], "\u2744\uFE0F A glacier melts in the sun. Intense sun melts it fast, but the sun fades each day. How many days until it's gone?",
       "\u2744\uFE0F Glacier gone!\nMelted in N days", "hard", f"parsed_{idx:03d}"))

    # --- Additional for-loop and if/else puzzles to fill to 365 ---

    more_for = [
        ("shells", 5, 4, "\U0001F41A", "Collect 4 shells from each of 5 beaches. How many shells?", "\U0001F41A Collected: 20 shells!"),
        ("arrows", 6, 3, "\U0001F3F9", "Fire 3 arrows each round for 6 rounds. Total arrows shot?", "\U0001F3F9 Fired: 18 arrows!"),
        ("notes", 4, 8, "\U0001F3B5", "Practice 8 notes per session for 4 sessions. How many notes total?", "\U0001F3B5 Learned: 32 notes!"),
        ("frames", 5, 6, "\U0001F3AC", "Render 6 frames each second for 5 seconds. Total frames?", "\U0001F3AC Rendered: 30 frames!"),
        ("seeds", 7, 4, "\U0001F331", "Plant 4 seeds in each of 7 pots. How many seeds?", "\U0001F331 Planted: 28 seeds!"),
        ("laps", 8, 3, "\U0001F3CA", "Swim 3 laps each set for 8 sets. Total laps?", "\U0001F3CA Swam: 24 laps!"),
        ("tickets", 6, 5, "\U0001F3AB", "Sell 5 tickets each hour for 6 hours. Total tickets?", "\U0001F3AB Sold: 30 tickets!"),
        ("photos", 4, 9, "\U0001F4F8", "Take 9 photos at each of 4 landmarks. Total photos?", "\U0001F4F8 Taken: 36 photos!"),
    ]
    for vr, n_end, k, emoji, goal, share in more_for:
        add(tmpl_for_accum(vr, n_end, k, emoji, goal, share, f"parsed_{idx:03d}"))

    more_for_tri = [
        ("pages", 7, "\U0001F4D6", "Read 1 page day 1, 2 pages day 2, up to day 7. Total pages read?", "\U0001F4D6 Read: 28 pages!"),
        ("pushups", 5, "\U0001F4AA", "Do 1 pushup in set 1, 2 in set 2, up to set 5. Total pushups?", "\U0001F4AA Reps: 15!"),
        ("stars", 6, "\u2B50", "Earn 1 star level 1, 2 stars level 2, up to level 6. Total stars?", "\u2B50 Stars: 21!"),
        ("likes", 8, "\u2764\uFE0F", "Get 1 like hour 1, 2 likes hour 2, up to hour 8. Total likes?", "\u2764\uFE0F Likes: 36!"),
    ]
    for vr, n_end, emoji, goal, share in more_for_tri:
        add(tmpl_for_triangular(vr, n_end, emoji, goal, share, f"parsed_{idx:03d}"))

    more_for_mul = [
        ("rumor", 3, 6, "\U0001F5E3\uFE0F", "A rumor spreads — each person tells 6 others for 3 rounds. How big is the rumor?", "\U0001F5E3\uFE0F Rumor: 216 people!"),
        ("cells", 2, 5, "\U0001F9EC", "A cell multiplies 5-fold each cycle for 2 cycles. How many cells?", "\U0001F9EC Cells: 25!"),
    ]
    for vr, start_val, n_end, emoji, goal, share in more_for_mul:
        add(tmpl_for_multiply(vr, start_val, n_end, emoji, goal, share, f"parsed_{idx:03d}"))

    more_for_if = [
        ("grade", 8, 5, "\U0001F393", "Grade homework: full marks for problems above 5, half marks below. Total grade after 8 problems?", "\U0001F393 Graded!"),
        ("snacks", 6, 3, "\U0001F36C", "Hand out snacks: big kids (above 3) get extra, little ones get some. Total snacks for 6 kids?", "\U0001F36C Shared!"),
        ("tips", 7, 4, "\U0001F4B5", "Wait tables: big parties (above 4) tip more, small ones tip less. Total tips for 7 tables?", "\U0001F4B5 Tips collected!"),
        ("saves", 5, 3, "\U0001F3AE", "A goalkeeper faces shots: hard ones (above 3) are tougher. Saves after 5 rounds?", "\U0001F3AE Saved!"),
    ]
    for vr, n_end, threshold, emoji, goal, share in more_for_if:
        add(tmpl_for_if(vr, n_end, threshold, emoji, goal, share, f"parsed_{idx:03d}"))

    # Check total count
    print(f"\nTotal puzzles generated: {len(puzzles)}")

    # Shuffle with fixed seed for even difficulty distribution
    rng = random.Random(42)
    rng.shuffle(puzzles)

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
