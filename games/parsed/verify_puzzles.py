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
    # 0: Rocket
    (['let','fuel','=','100'], ['let','altitude','=','0'], ['let','thrust','=','25'],
     ['while','fuel','>','0','{'], ['altitude','=','altitude','+','thrust'], ['fuel','=','fuel','-','thrust'], ['}'],
     ['return','altitude']),
    # 1: Dungeon
    (['let','hp','=','50'], ['let','armor','=','5'], ['let','damage','=','12'], ['let','rooms','=','0'],
     ['while','hp','>','0','{'], ['hp','=','hp','-','damage','+','armor'], ['rooms','=','rooms','+','1'], ['}'],
     ['return','rooms']),
    # 2: Potion
    (['let','heat','=','0'], ['let','stirs','=','0'], ['let','potency','=','1'],
     ['while','stirs','<','5','{'], ['heat','=','heat','+','3'], ['potency','=','potency','*','2'], ['stirs','=','stirs','+','1'], ['}'],
     ['if','heat','>','10','{'], ['potency','=','potency','+','heat'], ['}'],
     ['return','potency']),
    # 3: Shield
    (['let','charge','=','2'], ['let','boost','=','3'], ['let','rounds','=','0'],
     ['while','rounds','<','3','{'], ['charge','=','charge','*','boost'], ['boost','=','boost','-','1'], ['rounds','=','rounds','+','1'], ['}'],
     ['return','charge']),
    # 4: Treasure
    (['let','gold','=','40'], ['let','gems','=','7'], ['let','bonus','=','gems','*','5'], ['let','loot','=','0'],
     ['if','gold','>','20','{'], ['loot','=','gold','+','bonus'], ['}','else','{'], ['loot','=','gems','*','2'], ['}'],
     ['return','loot']),
    # 5: Campfire
    (['let','wood','=','10'], ['let','food','=','6'], ['let','cooked','=','0'],
     ['while','wood','>','0','{'], ['if','food','>','0','{'], ['cooked','=','cooked','+','1'], ['food','=','food','-','1'], ['}'],
     ['wood','=','wood','-','2'], ['}'],
     ['return','cooked']),
    # 6: Dragon
    (['let','trust','=','0'], ['let','fear','=','10'], ['let','days','=','0'],
     ['while','fear','>','trust','{'], ['trust','=','trust','+','3'], ['fear','=','fear','-','1'], ['days','=','days','+','1'], ['}'],
     ['return','days']),
    # 7: Space nav
    (['let','x','=','0'], ['let','y','=','0'], ['let','steps','=','0'],
     ['while','steps','<','4','{'], ['x','=','x','+','2'], ['y','=','y','+','3'], ['steps','=','steps','+','1'], ['}'],
     ['let','dist','=','x','+','y'],
     ['return','dist']),
    # 8: Encryption
    (['let','a','=','7'], ['let','b','=','3'],
     ['let','key','=','a','+','b'], ['let','temp','=','a','*','b'],
     ['a','=','temp','-','key'], ['b','=','temp','+','key'],
     ['return','a','+','b']),
    # 9: Boss fight
    (['let','boss','=','30'], ['let','hero','=','20'], ['let','turns','=','0'],
     ['while','boss','>','0','{'], ['boss','=','boss','-','hero'], ['hero','=','hero','-','5'], ['turns','=','turns','+','1'], ['}'],
     ['return','turns']),
]

expected = ['100', '8', '47', '12', '75', '5', '3', '20', '42', '2']

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
