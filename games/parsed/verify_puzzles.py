"""Verify that all Parsed puzzles produce the expected output."""

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
            # Skip } else { — these are handled by the if block logic
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
                val = self._eval_expr(expr)
                self.vars[var_name] = val
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
                # Check if there's an else block
                # } else { can be on the same line as the closing brace
                has_else = False
                else_line = block_end
                if block_end < len(lines):
                    bl = lines[block_end]
                    if len(bl) > 1 and 'else' in bl:
                        has_else = True
                # Also check next line for standalone else
                if not has_else and block_end + 1 < len(lines):
                    nl = lines[block_end + 1]
                    if nl and nl[0] == 'else':
                        has_else = True
                        else_line = block_end + 1

                if self._eval_condition(cond):
                    self._exec_block(lines, i + 1, block_end - 1)
                    if self.output is not None:
                        return
                    if has_else:
                        else_end = self._find_else_block_end(lines, else_line)
                        i = else_end + 1
                    else:
                        i = block_end + 1
                else:
                    if has_else:
                        else_end = self._find_else_block_end(lines, else_line)
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
            if op == '<': return left < right
            if op == '>': return left > right
            if op == '<=': return left <= right
            if op == '>=': return left >= right
            if op == '==': return left == right
            if op == '!=': return left != right
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
        return 0

    def _find_block_end(self, lines, start):
        """Find the line index of the closing } for the block that opens on `start`."""
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

    def _find_else_block_end(self, lines, else_line):
        """Find closing } for an else block. The else_line is '} else {'."""
        # Count only from the else's opening brace
        depth = 1  # the { on the else line
        for i in range(else_line + 1, len(lines)):
            for t in lines[i]:
                if t == '{':
                    depth += 1
                elif t == '}':
                    depth -= 1
                    if depth == 0:
                        return i
        return len(lines) - 1


puzzles = [
    (['let','key','=','true'], ['let','door','=','false'], ['if','key','==','true','{'], ['door','=','true'], ['}'], ['return','door']),
    (['let','herbs','=','3'], ['let','water','=','2'], ['let','potion','=','herbs','+','water'], ['return','potion']),
    (['let','ripeness','=','8'], ['let','ready','=','false'], ['if','ripeness','>','5','{'], ['ready','=','true'], ['}'], ['return','ready']),
    (['let','fuel','=','100'], ['let','altitude','=','0'], ['while','fuel','>','0','{'], ['altitude','=','altitude','+','10'], ['fuel','=','fuel','-','20'], ['}'], ['return','altitude']),
    (['let','hunger','=','5'], ['let','snacks','=','0'], ['while','hunger','>','0','{'], ['snacks','=','snacks','+','1'], ['hunger','=','hunger','-','1'], ['}'], ['return','snacks']),
    (['let','temp','=','35'], ['let','outfit','=','0'], ['if','temp','>','30','{'], ['outfit','=','1'], ['}','else','{'], ['outfit','=','2'], ['}'], ['return','outfit']),
    (['let','dial_a','=','7'], ['let','dial_b','=','3'], ['let','combo','=','dial_a','*','dial_b'], ['let','unlocked','=','false'], ['if','combo','==','21','{'], ['unlocked','=','true'], ['}'], ['return','unlocked']),
    (['let','energy','=','1'], ['let','rounds','=','0'], ['while','rounds','<','4','{'], ['energy','=','energy','*','2'], ['rounds','=','rounds','+','1'], ['}'], ['return','energy']),
    (['let','wood','=','3'], ['let','match','=','true'], ['let','fire','=','false'], ['if','wood','>','0','{'], ['if','match','==','true','{'], ['fire','=','true'], ['}'], ['}'], ['return','fire']),
    (['let','hp','=','100'], ['let','rooms','=','0'], ['while','hp','>','20','{'], ['hp','=','hp','-','15'], ['rooms','=','rooms','+','1'], ['}'], ['return','rooms']),
]

expected = ['true', '5', 'true', '50', '5', '1', 'true', '16', 'true', '6']

interp = Interpreter()
all_pass = True
for i, (lines, exp) in enumerate(zip(puzzles, expected)):
    result = interp.run(list(lines))
    result_str = str(result).lower() if isinstance(result, bool) else str(result)
    status = "PASS" if result_str == exp else "FAIL"
    if status == "FAIL":
        all_pass = False
    print(f"Puzzle {i}: {status} (expected={exp}, got={result_str})")

print(f"\n{'All puzzles passed!' if all_pass else 'Some puzzles FAILED!'}")
