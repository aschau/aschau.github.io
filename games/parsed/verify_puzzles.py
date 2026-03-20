"""Comprehensive puzzle verifier for Parsed.

Runs EVERY puzzle through the same validation pipeline the game uses:
1. Structural validation (syntax, undeclared variables)
2. Interpreter execution (produces output)
3. Return expression check (correct variable returned)
4. Logic check (final variable states match)
5. Scramble check (puzzle is actually scrambled, not already solved)
6. Quality checks (output non-trivial, goal text present, etc.)

Usage: python verify_puzzles.py
Reads puzzles.js, outputs results to console and validation_results.txt
"""

import json
import sys
import os
import re

# ============================================
# Interpreter (matches game.js exactly)
# ============================================

KEYWORDS = {'let', 'while', 'if', 'else', 'return', 'for', 'to'}
OPERATORS = {'+', '-', '*', '/', '=', '>', '<', '>=', '<=', '==', '!='}
ARITH_OPS = {'+', '-', '*', '/'}
COMPARISON_OPS = {'>', '<', '>=', '<=', '==', '!='}


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
            elif first == 'for':
                # for i = start to end {
                var_name = line[1]
                start_val = self._resolve(line[3])
                end_val = self._resolve(line[5])
                block_end = self._find_block_end(lines, i)
                for fi in range(start_val, end_val + 1):
                    self.vars[var_name] = fi
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
                i = block_end + 1
            elif first == 'while':
                block_end = self._find_block_end(lines, i)
                cond = self._get_condition(line)
                loop_count = 0
                while self._eval_condition(cond) and loop_count < 100:
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
                    loop_count += 1
                if loop_count >= 100 and self._eval_condition(cond):
                    raise RuntimeError("infinite loop detected")
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
                    if line[0] not in self.vars:
                        raise RuntimeError(f"can't assign to '{line[0]}' — not declared")
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
            ops = {'<': lambda a, b: a < b, '>': lambda a, b: a > b,
                   '<=': lambda a, b: a <= b, '>=': lambda a, b: a >= b,
                   '==': lambda a, b: a == b, '!=': lambda a, b: a != b}
            return ops.get(op, lambda a, b: False)(left, right)
        return False

    def _eval_expr(self, tokens):
        if not tokens:
            return 0
        if len(tokens) == 1:
            return self._resolve(tokens[0])
        result = self._resolve(tokens[0])
        idx = 1
        while idx < len(tokens) - 1:
            op = tokens[idx]
            right = self._resolve(tokens[idx + 1])
            if op == '+':
                result += right
            elif op == '-':
                result -= right
            elif op == '*':
                result *= right
            elif op == '/':
                result = result // right if right else 0
            idx += 2
        return result

    def _resolve(self, token):
        if token == 'true':
            return True
        if token == 'false':
            return False
        try:
            return int(token)
        except (ValueError, TypeError):
            pass
        if token in self.vars:
            return self.vars[token]
        raise RuntimeError(f"'{token}' is not defined")

    def _find_block_end(self, lines, start):
        depth = 0
        for i in range(start, len(lines)):
            for t in lines[i]:
                if t == '{':
                    depth += 1
                elif t == '}':
                    depth -= 1
                    if depth == 0:
                        return i
        return len(lines) - 1

    def _find_else_end(self, lines, else_line):
        depth = 1
        for i in range(else_line + 1, len(lines)):
            for t in lines[i]:
                if t == '{':
                    depth += 1
                elif t == '}':
                    depth -= 1
                    if depth == 0:
                        return i
        return len(lines) - 1


# ============================================
# Structural Validator (matches game.js)
# ============================================

def validate_structure(code_lines):
    """Mirror of game.js validateStructure — checks syntax and declarations."""
    errors = []
    declared = {}

    for i, line in enumerate(code_lines):
        ln = i + 1
        if not line:
            continue
        first = line[0]

        # Skip brace-only lines
        if len(line) == 1 and first in ('{', '}'):
            continue
        if first == '}' and len(line) >= 3 and line[1] == 'else':
            continue
        if first == '}':
            continue

        if first == 'let':
            if len(line) < 4:
                errors.append(f"line {ln}: incomplete declaration")
            elif line[2] != '=':
                errors.append(f"line {ln}: expected '=' after '{line[1]}', got '{line[2]}'")
            elif line[1] in KEYWORDS:
                errors.append(f"line {ln}: '{line[1]}' is a keyword, not a variable name")
            elif line[1] in OPERATORS:
                errors.append(f"line {ln}: unexpected operator '{line[1]}' in declaration")
            else:
                declared[line[1]] = True
            # Check expression
            expr_err = validate_expr(line[3:], ln, declared, line[1])
            if expr_err:
                errors.append(expr_err)

        elif first == 'for':
            # for i = start to end {
            if len(line) < 7:
                errors.append(f"line {ln}: incomplete for statement")
            elif line[2] != '=':
                errors.append(f"line {ln}: expected '=' in for statement")
            elif line[4] != 'to':
                errors.append(f"line {ln}: expected 'to' in for statement")
            elif line[-1] != '{':
                errors.append(f"line {ln}: expected '{{' at end of for statement")
            else:
                declared[line[1]] = True
                # Check start and end values
                for val_tok in [line[3], line[5]]:
                    if val_tok not in KEYWORDS and val_tok not in OPERATORS and val_tok not in ('{', '}'):
                        try:
                            int(val_tok)
                        except ValueError:
                            if val_tok not in declared:
                                errors.append(f"line {ln}: '{val_tok}' is not defined")

        elif first == 'while' or first == 'if':
            last_tok = line[-1]
            if last_tok != '{':
                errors.append(f"line {ln}: expected '{{' at end of {first} statement")
            if len(line) < 5:
                errors.append(f"line {ln}: incomplete {first} condition")
            else:
                has_comp = any(t in COMPARISON_OPS for t in line[1:-1])
                if not has_comp:
                    errors.append(f"line {ln}: missing comparison operator in {first} condition")
                for t in line[1:-1]:
                    if t not in OPERATORS and t not in KEYWORDS and t not in ('{', '}'):
                        try:
                            int(t)
                        except ValueError:
                            if t not in declared:
                                errors.append(f"line {ln}: '{t}' is not defined")
                                break

        elif first == 'return':
            if len(line) < 2:
                errors.append(f"line {ln}: return with no value")
            else:
                ret_err = validate_expr(line[1:], ln, declared)
                if ret_err:
                    errors.append(ret_err)

        else:
            # Assignment: x = expr
            if len(line) < 3:
                errors.append(f"line {ln}: incomplete statement")
            elif line[1] != '=':
                errors.append(f"line {ln}: expected '=' after '{first}', got '{line[1]}'")
            elif first in KEYWORDS:
                errors.append(f"line {ln}: unexpected keyword '{first}'")
            elif first in OPERATORS:
                errors.append(f"line {ln}: unexpected operator '{first}' at start of line")
            elif first not in declared:
                errors.append(f"line {ln}: can't assign to '{first}' — not declared")
            else:
                expr_err = validate_expr(line[2:], ln, declared, first)
                if expr_err:
                    errors.append(expr_err)

    return errors


def validate_expr(tokens, line_num, declared, assign_target=None):
    """Check for operator issues and undeclared variables in an expression."""
    filtered = [t for t in tokens if t not in ('{', '}')]
    if not filtered:
        return None
    if filtered[0] in ARITH_OPS:
        return f"line {line_num}: unexpected operator '{filtered[0]}' at start of expression"
    if len(filtered) > 1 and filtered[-1] in ARITH_OPS:
        return f"line {line_num}: unexpected operator '{filtered[-1]}' at end of expression"
    for i in range(len(filtered) - 1):
        if filtered[i] in ARITH_OPS and filtered[i + 1] in ARITH_OPS:
            return f"line {line_num}: unexpected operator '{filtered[i + 1]}' after '{filtered[i]}'"
    # Check undeclared variables
    if declared is not None:
        for t in filtered:
            if t not in ARITH_OPS and t not in OPERATORS and t not in KEYWORDS and t not in ('{', '}'):
                try:
                    int(t)
                except ValueError:
                    if t not in declared:
                        if assign_target:
                            return f"line {line_num}: can't set '{assign_target}' to '{t}' — '{t}' not declared"
                        return f"line {line_num}: '{t}' is not defined"
    return None


# ============================================
# Scramble Simulation (matches game.js exactly)
# ============================================

def hash_string(s):
    """Matches game.js hashString."""
    h = 0
    for ch in s:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return h


def seeded_rng(seed):
    """Matches game.js seededRng."""
    s = [seed & 0xFFFFFFFF]

    def rng():
        s[0] = (s[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = s[0] ^ (s[0] >> 15)
        # Math.imul approximation
        t = imul(t, 1 | (s[0] & 0xFFFFFFFF)) & 0xFFFFFFFF
        t = (t + (imul(t ^ (t >> 7), 61 | (t & 0xFFFFFFFF)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t = t ^ t
        t = (t ^ (t >> 14)) & 0xFFFFFFFF
        return t / 4294967296

    return rng


def imul(a, b):
    """Matches JS Math.imul — 32-bit integer multiply."""
    a = a & 0xFFFFFFFF
    b = b & 0xFFFFFFFF
    result = (a * b) & 0xFFFFFFFF
    if result >= 0x80000000:
        result -= 0x100000000
    return result


def simulate_scramble(solution_order, puzzle_id):
    """Replicate the game's seeded Fisher-Yates shuffle."""
    texts = solution_order[:]
    h = hash_string(puzzle_id or 'puzzle')

    # The game tries multiple attempts until scrambled != solution
    for attempt in range(100):
        seed = h + attempt * 7919
        s = [seed & 0xFFFFFFFF]

        def make_rng(seed_val):
            state = [seed_val & 0xFFFFFFFF]
            def rng():
                state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
                t = state[0] ^ (state[0] >> 15)
                t = (t * (1 | state[0])) & 0xFFFFFFFF
                t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF
                t = (t ^ (t >> 14)) & 0xFFFFFFFF
                return t / 4294967296
            return rng

        rng = make_rng(seed)
        texts = solution_order[:]
        for i in range(len(texts) - 1, 0, -1):
            j = int(rng() * (i + 1))
            texts[i], texts[j] = texts[j], texts[i]

        if texts != solution_order:
            break

    return texts


def count_min_swaps(scrambled, target):
    """Count minimum swaps to go from scrambled to target order.

    Handles duplicate values by tracking positions, not just values.
    For tokens with duplicates, we try the assignment that minimizes swaps.
    """
    n = len(scrambled)
    if n != len(target):
        return n  # shouldn't happen

    # For simple case (all unique), count cycles in permutation
    # For duplicates, use greedy matching
    # Build position mapping: where does each target token need to come from?
    used = [False] * n
    perm = [0] * n

    for i in range(n):
        # Find the best source for target[i] in scrambled
        best = -1
        for j in range(n):
            if not used[j] and scrambled[j] == target[i]:
                if j == i:
                    best = j
                    break  # already in place, perfect
                if best == -1:
                    best = j
        if best == -1:
            return n  # can't solve — shouldn't happen
        used[best] = True
        perm[i] = best

    # Count cycles — swaps = n - num_cycles
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


# ============================================
# Full Verification Pipeline
# ============================================

def verify_puzzle(puzzle, index):
    """Run a puzzle through the full validation pipeline. Returns list of issues."""
    issues = []
    pid = puzzle.get('id', '???')

    # Extract solution code lines
    code_lines = []
    movable_tokens = []
    movable_tokens_raw = []
    for line in puzzle['lines']:
        tokens = [t['t'] for t in line]
        code_lines.append(tokens)
        for t in line:
            if not t['f']:
                movable_tokens.append(t['t'])
                movable_tokens_raw.append(t)

    # 1. Structural validation
    struct_errors = validate_structure(code_lines)
    if struct_errors:
        for e in struct_errors:
            issues.append(f"STRUCTURAL: {e}")

    # 2. Interpreter execution
    interp = Interpreter()
    try:
        output = interp.run(code_lines)
        if output is None:
            issues.append("EXECUTION: program produced no output")
        else:
            output_str = str(output).lower() if isinstance(output, bool) else str(output)
            if output_str != puzzle['output']:
                issues.append(f"OUTPUT MISMATCH: expected '{puzzle['output']}', got '{output_str}'")
    except Exception as e:
        issues.append(f"EXECUTION ERROR: {e}")
        return issues  # Can't continue without execution

    # 3. Return expression check
    solution_return = None
    player_return = None
    for line in puzzle['lines']:
        if line[0]['t'] == 'return':
            solution_return = [t['t'] for t in line[1:]]
            break
    for line_tokens in code_lines:
        if line_tokens[0] == 'return':
            player_return = line_tokens[1:]
            break
    # (For the solution, these should always match — but verify)
    if solution_return and player_return:
        if solution_return != player_return:
            issues.append("RETURN: solution return tokens don't match extracted return")

    # 4. Variable state check (verify vars are accessible)
    final_vars = interp.vars
    if not final_vars:
        issues.append("VARS: no variables defined after execution")

    # 5. Check puzzle has movable tokens (it's actually a puzzle)
    if len(movable_tokens) < 2:
        issues.append(f"TRIVIAL: only {len(movable_tokens)} movable token(s) — not a real puzzle")

    # 6. Quality checks
    if not puzzle.get('goal'):
        issues.append("QUALITY: missing goal text")
    if not puzzle.get('shareResult'):
        issues.append("QUALITY: missing shareResult")
    if not puzzle.get('id'):
        issues.append("QUALITY: missing puzzle id")

    # Check par is reasonable
    par = puzzle.get('par', 0)
    if par < 2:
        issues.append(f"QUALITY: par={par} is too low")
    if par > 30:
        issues.append(f"QUALITY: par={par} is unusually high")

    # Check output is not empty/weird
    if puzzle['output'] in ('None', 'undefined', ''):
        issues.append(f"QUALITY: output is '{puzzle['output']}'")

    # 7. Story sanity checks
    goal_text = puzzle.get('goal', '')
    goal_lower = goal_text.lower()
    output_val = int(puzzle['output']) if puzzle['output'].lstrip('-').isdigit() else None

    # 7a. Numbers in goal should appear in the code
    goal_numbers = re.findall(r'\b(\d+)\b', goal_text)
    code_numbers = set()
    for line in puzzle['lines']:
        for t in line:
            if t['y'] == 'lit':
                code_numbers.add(t['t'])
    for gn in goal_numbers:
        if gn not in code_numbers and int(gn) > 3:  # skip small numbers (1-3) — too common in natural language
            # Check if it could be the output
            if gn != puzzle['output']:
                issues.append(
                    f"SANITY: goal mentions number '{gn}' but it doesn't appear in the code"
                )

    # 7b. "How many" questions should return non-negative values
    if output_val is not None:
        if ('how many' in goal_lower or 'how much' in goal_lower) and output_val < 0:
            issues.append(
                f"SANITY: goal asks 'how many/much' but output is negative ({output_val})"
            )

    # 7c. Numbers in goal should match loop bounds
    for line in puzzle['lines']:
        if line[0]['t'] in ('for', 'while') and len(line) >= 5:
            # Extract the loop bound number
            try:
                if line[0]['t'] == 'for' and len(line) >= 6:
                    loop_bound = line[5]['t']
                elif line[0]['t'] == 'while':
                    # Get the comparison value (last token before {)
                    for ti in range(len(line) - 1, 0, -1):
                        if line[ti]['t'] == '{':
                            continue
                        if line[ti]['y'] == 'lit':
                            loop_bound = line[ti]['t']
                            break
                    else:
                        loop_bound = None
                else:
                    loop_bound = None
                if loop_bound and int(loop_bound) > 3:
                    # Check if any number in the goal contradicts the loop bound
                    for gn in goal_numbers:
                        gn_val = int(gn)
                        lb_val = int(loop_bound)
                        # If goal says "6 rounds" but loop goes to 3, flag it
                        if gn_val > 3 and gn_val != lb_val and gn != puzzle['output']:
                            # Check if the goal number describes the loop count
                            gn_idx = goal_text.find(gn)
                            if gn_idx >= 0:
                                context = goal_text[max(0, gn_idx-15):gn_idx+len(gn)+15].lower()
                                # Only flag if context clearly describes a loop count
                                # (not per-iteration values like "5 steps each")
                                loop_words = ['round', 'time', 'day', 'hour', 'week',
                                              'cycle', 'turn', 'session', 'set', 'level',
                                              'minute', 'second', 'event', 'layer', 'night']
                                if any(w in context for w in loop_words):
                                    issues.append(
                                        f"SANITY: goal mentions '{gn}' {context.strip()} but loop bound is {loop_bound}"
                                    )
            except (ValueError, UnboundLocalError):
                pass

    # 7d. If/else: check both branches produce different results
    has_if = any(line[0]['t'] == 'if' for line in puzzle['lines'] if line)
    has_else = any('else' in [t['t'] for t in line] for line in puzzle['lines'] if line)
    if has_if and has_else:
        # Run interpreter with the condition flipped conceptually
        # (we can't easily do this, but we can check the if-condition isn't trivially true/false)
        for line in puzzle['lines']:
            if line[0]['t'] == 'if' and len(line) >= 4:
                cond_tokens = []
                for t in line[1:]:
                    if t['t'] == '{':
                        break
                    cond_tokens.append(t['t'])
                if len(cond_tokens) == 3:
                    try:
                        left = int(cond_tokens[0])
                        right = int(cond_tokens[2])
                        op = cond_tokens[1]
                        # Both sides are literals — condition is always the same
                        issues.append(
                            f"SANITY: if condition '{left} {op} {right}' uses only literals — "
                            f"one branch is dead code"
                        )
                    except ValueError:
                        pass  # has variables, which is fine

    # 8. Wording consistency: return variable should relate to the goal text
    goal_lower = puzzle.get('goal', '').lower()
    if solution_return:
        ret_name = solution_return[0] if len(solution_return) == 1 else None
        if ret_name and ret_name not in KEYWORDS:
            ret_lower = ret_name.lower()
            ret_stem = ret_lower.rstrip('s').rstrip('ed').rstrip('ing')
            found_in_goal = (
                ret_lower in goal_lower or
                ret_stem in goal_lower or
                ret_lower + 's' in goal_lower
            )
            if not found_in_goal:
                all_vars = set()
                for line in puzzle['lines']:
                    for t in line:
                        if t['y'] == 'id':
                            all_vars.add(t['t'])
                issues.append(
                    f"WORDING: return var '{ret_name}' not mentioned in goal. "
                    f"Vars: {sorted(all_vars)}. Goal: {puzzle['goal'][:80]}..."
                )

            # Also check: does the goal's question use a DIFFERENT word than the var?
            # e.g., goal asks "How many graduate?" but var is "passed"
            question_words = re.findall(r'how (?:many|much) (\w+)', goal_lower)
            question_words += re.findall(r'what.s the (\w+)', goal_lower)
            question_words += re.findall(r'total (\w+)', goal_lower)
            for qw in question_words:
                qw_stem = qw.rstrip('s').rstrip('ed').rstrip('ing').rstrip('?')
                if qw_stem and ret_stem and qw_stem != ret_stem and qw not in ret_lower and ret_stem not in qw:
                    issues.append(
                        f"WORDING: goal asks about '{qw}' but return var is '{ret_name}' — consider renaming"
                    )

    # 8. Scramble simulation — verify puzzle is solvable at par
    solution_order = [t['t'] for t in movable_tokens_raw if not t['f']]
    if len(solution_order) >= 2:
        scrambled = simulate_scramble(solution_order, puzzle.get('id', ''))
        if scrambled == solution_order:
            issues.append("SCRAMBLE: puzzle is already solved after scrambling — not a real puzzle")
        else:
            min_swaps = count_min_swaps(scrambled, solution_order)
            par = puzzle.get('par', 0)
            if min_swaps > par:
                issues.append(
                    f"PAR: minimum swaps ({min_swaps}) exceeds par ({par}) — "
                    f"puzzle is unsolvable at par"
                )

    # 9. Check for duplicate IDs (done at batch level, not here)

    return issues


def load_puzzles(filename):
    """Load puzzles from puzzles.js."""
    with open(filename, 'r', encoding='utf-8') as f:
        text = f.read()
    start = text.index('var PUZZLES = ') + len('var PUZZLES = ')
    end = text.index(';', start)
    return json.loads(text[start:end])


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    puzzles_file = os.path.join(script_dir, 'puzzles.js')

    if not os.path.exists(puzzles_file):
        print("ERROR: puzzles.js not found!")
        sys.exit(1)

    puzzles = load_puzzles(puzzles_file)
    print(f"Loaded {len(puzzles)} puzzles from puzzles.js\n")

    # Track results
    total = len(puzzles)
    passed = 0
    failed = 0
    warnings = 0
    all_issues = []

    # Check for duplicate IDs
    ids = [p['id'] for p in puzzles]
    id_set = set(ids)
    if len(id_set) != len(ids):
        dupes = [pid for pid in id_set if ids.count(pid) > 1]
        print(f"DUPLICATE IDS: {dupes}\n")

    # Check for duplicate puzzles by hashing the full code structure
    import hashlib
    seen_hashes = {}
    for i, p in enumerate(puzzles):
        # Hash the complete token structure (all token texts in order)
        code_str = '|'.join(
            ' '.join(t['t'] for t in line)
            for line in p['lines']
        )
        code_hash = hashlib.md5(code_str.encode()).hexdigest()
        if code_hash in seen_hashes:
            prev_i = seen_hashes[code_hash]
            print(f"DUPLICATE: #{i+1} and #{prev_i+1} have identical code structure!")
        seen_hashes[code_hash] = i

    # Difficulty distribution
    diff_counts = {}
    concept_counts = {}

    for i, p in enumerate(puzzles):
        issues = verify_puzzle(p, i)

        # Track difficulty
        diff = p.get('difficulty', '?')
        diff_counts[diff] = diff_counts.get(diff, 0) + 1

        # Detect concept
        has_while = any(line[0]['t'] == 'while' for line in p['lines'] if line)
        has_if = any(line[0]['t'] == 'if' for line in p['lines'] if line)
        has_for = any(line[0]['t'] == 'for' for line in p['lines'] if line)
        if has_while and has_if:
            concept = 'while+if'
        elif has_while:
            concept = 'while'
        elif has_for and has_if:
            concept = 'for+if'
        elif has_for:
            concept = 'for'
        elif has_if:
            concept = 'if/else'
        else:
            concept = 'arithmetic'
        concept_counts[concept] = concept_counts.get(concept, 0) + 1

        if issues:
            failed += 1
            all_issues.append((i, p['id'], p.get('goal', ''), issues))
            status = "FAIL"
        else:
            passed += 1
            status = "OK"

        # Progress (only show failures in console)
        if issues:
            print(f"#{i + 1:3d} [{p['id']}] {status}")
            for issue in issues:
                print(f"     {issue}")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed}/{total} passed, {failed} failed")
    print(f"\nDifficulty: {diff_counts}")
    print(f"Concepts:   {concept_counts}")
    print(f"Unique IDs: {len(id_set)}/{len(ids)}")

    # Write detailed results to file
    results_file = os.path.join(script_dir, 'validation_results.txt')
    with open(results_file, 'w', encoding='utf-8') as f:
        f.write(f"Parsed Puzzle Verification Results\n")
        f.write(f"{'=' * 60}\n")
        f.write(f"Total: {total}, Passed: {passed}, Failed: {failed}\n")
        f.write(f"Difficulty: {diff_counts}\n")
        f.write(f"Concepts: {concept_counts}\n\n")

        if all_issues:
            f.write(f"FAILURES:\n{'-' * 40}\n")
            for idx, pid, goal, issues in all_issues:
                f.write(f"\n#{idx + 1} [{pid}] {goal}\n")
                for issue in issues:
                    f.write(f"  - {issue}\n")
        else:
            f.write("All puzzles passed!\n")

    print(f"\nDetailed results written to {results_file}")

    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
