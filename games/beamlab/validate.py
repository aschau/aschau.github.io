"""Beamlab Puzzle Validator — fast solver using reverse elimination + forward backtracking.
Outputs results to validation_results.txt"""

import json, time, sys
from pathlib import Path
from itertools import combinations

GRID = 6
FWD = {'right': 'up', 'left': 'down', 'up': 'right', 'down': 'left'}
BCK = {'right': 'down', 'left': 'up', 'up': 'left', 'down': 'right'}
DR = {'up': -1, 'down': 1, 'left': 0, 'right': 0}
DC = {'up': 0, 'down': 0, 'left': -1, 'right': 1}
ENTRY = {'left': 'right', 'right': 'left', 'top': 'down', 'bottom': 'up'}


def get_entry(src):
    e, p = src['edge'], src['pos']
    d = ENTRY[e]
    if e == 'left':    return p, 0, d
    if e == 'right':   return p, GRID - 1, d
    if e == 'top':     return 0, p, d
    return GRID - 1, p, d


def simulate(grid, source):
    r, c, d = get_entry(source)
    exits = set()
    cells_visited = set()
    visited = set()
    queue = [(r, c, d)]
    while queue:
        r, c, d = queue.pop(0)
        for _ in range(100):
            if not (0 <= r < GRID and 0 <= c < GRID):
                if r < 0:      exits.add(('top', c))
                elif r >= GRID: exits.add(('bottom', c))
                elif c < 0:    exits.add(('left', r))
                else:          exits.add(('right', r))
                break
            key = (r, c, d)
            if key in visited:
                break
            visited.add(key)
            v = grid[r][c]
            if v == 'wall':
                break
            cells_visited.add((r, c))
            if v == 'split':
                rd = FWD[d]
                queue.append((r + DR[rd], c + DC[rd], rd))
            elif v == 'fwd':
                d = FWD[d]
            elif v == 'bck':
                d = BCK[d]
            r += DR[d]
            c += DC[d]
    return exits, cells_visited


def hits_all(grid, puzzle):
    exits, _ = simulate(grid, puzzle['source'])
    return all((t['edge'], t['pos']) in exits for t in puzzle['targets'])


def hits_all_and_gem(grid, puzzle):
    """Check if puzzle is solved AND beam passes through gem."""
    exits, visited = simulate(grid, puzzle['source'])
    if not all((t['edge'], t['pos']) in exits for t in puzzle['targets']):
        return False
    gem = puzzle.get('gem')
    if not gem:
        return False
    return (gem['r'], gem['c']) in visited


def make_grid(puzzle):
    grid = [[None] * GRID for _ in range(GRID)]
    for w in puzzle['walls']:
        grid[w['r']][w['c']] = 'wall'
    return grid


def get_candidate_cells(puzzle):
    """Get cells worth placing pieces on — beam path + neighbors + target approach."""
    grid = make_grid(puzzle)
    _, beam_cells = simulate(grid, puzzle['source'])

    expanded = set(beam_cells)
    for r, c in beam_cells:
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < GRID and 0 <= nc < GRID and grid[nr][nc] is None:
                expanded.add((nr, nc))

    for t in puzzle['targets']:
        tr, tc, td = get_entry(t)
        r, c = tr, tc
        for _ in range(GRID):
            if 0 <= r < GRID and 0 <= c < GRID and grid[r][c] is None:
                expanded.add((r, c))
                for dr2, dc2 in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr2, c + dc2
                    if 0 <= nr < GRID and 0 <= nc < GRID and grid[nr][nc] is None:
                        expanded.add((nr, nc))
            else:
                break
            r += DR[td]
            c += DC[td]

    return sorted(expanded)


def solve(puzzle):
    """Find minimum pieces to solve. Uses forward backtracking with pruning."""
    grid = make_grid(puzzle)
    if hits_all(grid, puzzle):
        return 0

    inv = puzzle['inventory']
    types = []
    if inv.get('fwd', 0) > 0: types.append('fwd')
    if inv.get('bck', 0) > 0: types.append('bck')
    if inv.get('split', 0) > 0: types.append('split')

    candidates = get_candidate_cells(puzzle)
    total_inv = sum(inv.get(t, 0) for t in ['fwd', 'bck', 'split'])
    max_search = min(total_inv, puzzle.get('par', 99) + 2, 7)

    for num in range(1, max_search + 1):
        if _backtrack(grid, puzzle, candidates, types, 0, num):
            return num
    return -1


def _backtrack(grid, puzzle, cells, types, start, left):
    if left == 0:
        return hits_all(grid, puzzle)
    if len(cells) - start < left:
        return False
    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        for t in types:
            grid[r][c] = t
            if _backtrack(grid, puzzle, cells, types, i + 1, left - 1):
                grid[r][c] = None
                return True
            grid[r][c] = None
    return False


def solve_with_known_solution(puzzle, solution_mirrors):
    """Fast solver: given a known working solution, try removing mirrors
    one at a time to find the minimum. Much faster than brute force.

    solution_mirrors: list of (r, c, type) tuples that form a valid solution.
    Returns the minimum number of pieces needed.
    """
    grid = make_grid(puzzle)

    # Verify the full solution works
    for r, c, t in solution_mirrors:
        grid[r][c] = t
    if not hits_all(grid, puzzle):
        return -1

    n = len(solution_mirrors)

    # Try removing mirrors, largest subsets first
    for remove_count in range(1, n):
        keep_count = n - remove_count
        for combo in combinations(range(n), keep_count):
            test_grid = make_grid(puzzle)
            for idx in combo:
                r, c, t = solution_mirrors[idx]
                test_grid[r][c] = t
            if hits_all(test_grid, puzzle):
                return keep_count

    # Check if solvable with 0 mirrors
    test_grid = make_grid(puzzle)
    if hits_all(test_grid, puzzle):
        return 0

    return n  # need all mirrors


def solve_with_gem(puzzle, max_pieces):
    """Find minimum pieces to solve while beam passes through gem cell."""
    gem = puzzle.get('gem')
    if not gem:
        return -1

    grid = make_grid(puzzle)
    inv = puzzle['inventory']
    types = []
    if inv.get('fwd', 0) > 0: types.append('fwd')
    if inv.get('bck', 0) > 0: types.append('bck')
    if inv.get('split', 0) > 0: types.append('split')

    candidates = get_candidate_cells(puzzle)

    for num in range(1, max_pieces + 1):
        if _backtrack_gem(grid, puzzle, candidates, types, 0, num, gem):
            return num
    return -1


def _backtrack_gem(grid, puzzle, cells, types, start, left, gem):
    if left == 0:
        return hits_all_and_gem(grid, puzzle)
    if len(cells) - start < left:
        return False
    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        for t in types:
            grid[r][c] = t
            if _backtrack_gem(grid, puzzle, cells, types, i + 1, left - 1, gem):
                grid[r][c] = None
                return True
            grid[r][c] = None
    return False


def main():
    json_path = Path(__file__).parent / 'puzzles.json'
    puzzles = json.loads(json_path.read_text())
    output_path = Path(__file__).parent / 'validation_results.txt'

    lines = []

    def out(msg=''):
        print(msg)
        sys.stdout.flush()
        lines.append(msg)

    out('Beamlab Puzzle Validator')
    out(f'Puzzles: {len(puzzles)}')
    out('---')

    issues = []
    t0 = time.time()

    for i, p in enumerate(puzzles):
        t1 = time.time()
        result = solve(p)

        targets = len(p['targets'])
        split = p['inventory'].get('split', 0)
        par = p['par']
        has_gem = 'gem' in p
        pid = p.get('id', '?')

        if result == -1:
            status = 'UNSOLVABLE'
            issues.append((i + 1, 'unsolvable'))
        elif result != par:
            status = f'PAR MISMATCH (solves in {result}, par={par})'
            issues.append((i + 1, f'par should be {result}'))
        else:
            status = 'OK'

        gem_status = ''
        if has_gem and status == 'OK':
            gem_min = solve_with_gem(p, par + 2)
            if gem_min == -1:
                gem_status = ' | GEM UNREACHABLE'
                issues.append((i + 1, 'gem unreachable'))
            else:
                gem_status = f' | gem in {gem_min}'

        elapsed = time.time() - t1
        out(f'  Puzzle {i+1:>2} [{pid}] (par={par}, targets={targets}, splits={split}): {status}{gem_status} [{elapsed:.2f}s]')

    total = time.time() - t0
    out('---')
    if not issues:
        out(f'ALL {len(puzzles)} PUZZLES VALID ({total:.1f}s)')
    else:
        out(f'ISSUES FOUND ({total:.1f}s):')
        for num, issue in issues:
            out(f'  Puzzle {num}: {issue}')

    output_path.write_text('\n'.join(lines))
    out(f'\nResults saved to {output_path}')


if __name__ == '__main__':
    main()
