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
            if v == 'split' or v == 'split_fwd':
                rd = FWD[d]
                queue.append((r + DR[rd], c + DC[rd], rd))
            elif v == 'split_bck':
                rd = BCK[d]
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
    # Place fixed (pre-placed) pieces — they're part of the puzzle, not player-placed
    for f in puzzle.get('fixed', []):
        grid[f['r']][f['c']] = f['type']
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


def _inv_key(t):
    """Map piece type to inventory key (splitters share 'split' pool)."""
    return 'split' if t in ('split_fwd', 'split_bck') else t


def solve(puzzle):
    """Find minimum pieces to solve. Uses beam-aware backtracking.

    Key optimization: at each recursion level, simulate the beam with
    currently placed pieces and only try candidates that the beam actually
    passes through. A piece at a cell the beam doesn't reach has no effect.
    This cuts the branching factor from ~20 candidates to ~5-8 beam cells.
    """
    grid = make_grid(puzzle)
    if hits_all(grid, puzzle):
        return 0

    inv = puzzle['inventory']
    types = []
    if inv.get('fwd', 0) > 0: types.append('fwd')
    if inv.get('bck', 0) > 0: types.append('bck')
    if inv.get('split', 0) > 0:
        types.append('split_fwd')
        types.append('split_bck')

    candidates = get_candidate_cells(puzzle)
    target_set = {(t['edge'], t['pos']) for t in puzzle['targets']}
    total_inv = sum(inv.get(t, 0) for t in ['fwd', 'bck', 'split'])
    max_search = min(total_inv, puzzle.get('par', 99) + 2, 7)

    # Track inventory remaining for pruning
    inv_remaining = {k: inv.get(k, 0) for k in ['fwd', 'bck', 'split']}

    for num in range(1, max_search + 1):
        if _backtrack(grid, puzzle, candidates, types, 0, num, target_set, inv_remaining):
            return num
    return -1


def _backtrack(grid, puzzle, cells, types, start, left, target_set, inv_remaining):
    if left == 0:
        return hits_all(grid, puzzle)
    if len(cells) - start < left:
        return False

    # Simulate beam with current pieces — only cells on the beam path matter
    exits, beam_cells = simulate(grid, puzzle['source'])

    # Early solve: if all targets already hit, no more pieces needed
    if target_set <= exits:
        return True

    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        # Only try cells the beam actually passes through
        if (r, c) not in beam_cells:
            continue
        for t in types:
            ik = _inv_key(t)
            if inv_remaining[ik] <= 0:
                continue
            grid[r][c] = t
            inv_remaining[ik] -= 1
            if _backtrack(grid, puzzle, cells, types, i + 1, left - 1, target_set, inv_remaining):
                grid[r][c] = None
                inv_remaining[ik] += 1
                return True
            inv_remaining[ik] += 1
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
    if inv.get('split', 0) > 0:
        types.append('split_fwd')
        types.append('split_bck')

    candidates = get_candidate_cells(puzzle)
    target_set = {(t['edge'], t['pos']) for t in puzzle['targets']}
    inv_remaining = {k: inv.get(k, 0) for k in ['fwd', 'bck', 'split']}

    for num in range(1, max_pieces + 1):
        if _backtrack_gem(grid, puzzle, candidates, types, 0, num, gem, target_set, inv_remaining):
            return num
    return -1


def _backtrack_gem(grid, puzzle, cells, types, start, left, gem, target_set, inv_remaining):
    if left == 0:
        return hits_all_and_gem(grid, puzzle)
    if len(cells) - start < left:
        return False

    # Beam-path pruning: only try cells the beam currently passes through
    exits, beam_cells = simulate(grid, puzzle['source'])

    # Early solve: all targets hit AND gem collected
    if target_set <= exits and (gem['r'], gem['c']) in beam_cells:
        return True

    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        if (r, c) not in beam_cells:
            continue
        for t in types:
            ik = _inv_key(t)
            if inv_remaining[ik] <= 0:
                continue
            grid[r][c] = t
            inv_remaining[ik] -= 1
            if _backtrack_gem(grid, puzzle, cells, types, i + 1, left - 1, gem, target_set, inv_remaining):
                grid[r][c] = None
                inv_remaining[ik] += 1
                return True
            inv_remaining[ik] += 1
            grid[r][c] = None
    return False


def solve_returning_solution(puzzle, max_search=None):
    """Find minimum pieces to solve and return the actual placements.

    Returns list of (r, c, type) tuples, or None if unsolvable.
    """
    grid = make_grid(puzzle)
    if hits_all(grid, puzzle):
        return []

    inv = puzzle['inventory']
    types = []
    if inv.get('fwd', 0) > 0: types.append('fwd')
    if inv.get('bck', 0) > 0: types.append('bck')
    if inv.get('split', 0) > 0:
        types.append('split_fwd')
        types.append('split_bck')

    candidates = get_candidate_cells(puzzle)
    if max_search is None:
        total_inv = sum(inv.get(t, 0) for t in ['fwd', 'bck', 'split'])
        max_search = min(total_inv, puzzle.get('par', 99) + 2, 7)

    inv_remaining = {k: inv.get(k, 0) for k in ['fwd', 'bck', 'split']}

    for num in range(1, max_search + 1):
        result = _backtrack_one(grid, puzzle, candidates, types, 0, num, [], inv_remaining)
        if result is not None:
            return result
    return None


def _backtrack_one(grid, puzzle, cells, types, start, left, current, inv_remaining):
    """Backtrack to find one solution, returning piece placements."""
    if left == 0:
        if hits_all(grid, puzzle):
            return list(current)
        return None
    if len(cells) - start < left:
        return None
    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        for t in types:
            ik = _inv_key(t)
            if inv_remaining[ik] <= 0:
                continue
            grid[r][c] = t
            inv_remaining[ik] -= 1
            current.append((r, c, t))
            result = _backtrack_one(grid, puzzle, cells, types, i + 1, left - 1, current, inv_remaining)
            if result is not None:
                grid[r][c] = None
                inv_remaining[ik] += 1
                current.pop()
                return result
            current.pop()
            inv_remaining[ik] += 1
            grid[r][c] = None
    return None


def find_all_min_solutions(puzzle, num_pieces, max_solutions=20, time_limit=5.0):
    """Find up to max_solutions solutions using exactly num_pieces pieces.

    Used by BFS wall placement to identify which cells are used by
    shortcut solutions, so we can block the most impactful ones.
    Stops early if time_limit (seconds) is exceeded.
    """
    grid = make_grid(puzzle)
    inv = puzzle['inventory']
    types = []
    if inv.get('fwd', 0) > 0: types.append('fwd')
    if inv.get('bck', 0) > 0: types.append('bck')
    if inv.get('split', 0) > 0:
        types.append('split_fwd')
        types.append('split_bck')

    candidates = get_candidate_cells(puzzle)
    solutions = []
    deadline = time.time() + time_limit
    inv_remaining = {k: inv.get(k, 0) for k in ['fwd', 'bck', 'split']}
    _find_all(grid, puzzle, candidates, types, 0, num_pieces, [], solutions, max_solutions, deadline, inv_remaining)
    return solutions


def _find_all(grid, puzzle, cells, types, start, left, current, solutions, max_solutions, deadline, inv_remaining):
    """Collect all solutions at a given piece count with beam-path pruning."""
    if len(solutions) >= max_solutions or time.time() > deadline:
        return
    if left == 0:
        if hits_all(grid, puzzle):
            solutions.append(list(current))
        return
    if len(cells) - start < left:
        return
    # Beam-path pruning
    _, beam_cells = simulate(grid, puzzle['source'])
    for i in range(start, len(cells) - left + 1):
        r, c = cells[i]
        if grid[r][c] is not None:
            continue
        if (r, c) not in beam_cells:
            continue
        for t in types:
            ik = _inv_key(t)
            if inv_remaining[ik] <= 0:
                continue
            grid[r][c] = t
            inv_remaining[ik] -= 1
            current.append((r, c, t))
            _find_all(grid, puzzle, cells, types, i + 1, left - 1, current, solutions, max_solutions, deadline, inv_remaining)
            current.pop()
            inv_remaining[ik] += 1
            grid[r][c] = None


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
        elif result + 1 != par:
            # par should be min + 1 (golf-style: player can always beat par)
            status = f'PAR MISMATCH (min={result}, par={par}, expected par={result + 1})'
            issues.append((i + 1, f'par should be {result + 1}'))
        else:
            status = 'OK'

        # Check that fixed pieces alone don't hit any targets
        fixed_status = ''
        if p.get('fixed') and status == 'OK':
            fixed_grid = [[None] * GRID for _ in range(GRID)]
            for w in p['walls']:
                fixed_grid[w['r']][w['c']] = 'wall'
            for f in p['fixed']:
                fixed_grid[f['r']][f['c']] = f['type']
            fixed_exits, _ = simulate(fixed_grid, p['source'])
            target_set_check = {(t['edge'], t['pos']) for t in p['targets']}
            hits = fixed_exits & target_set_check
            if hits:
                fixed_status = f' | FIXED HITS {len(hits)} TARGET(S)'
                issues.append((i + 1, f'fixed pieces alone hit {len(hits)} target(s) — too easy'))

        gem_status = ''
        if not has_gem:
            gem_status = ' | NO GEM'
            issues.append((i + 1, 'missing gem'))
        elif status == 'OK':
            # Verify gem is reachable (solvable while collecting gem)
            gem_min = solve_with_gem(p, par + 2)
            if gem_min == -1:
                gem_status = ' | GEM UNREACHABLE'
                issues.append((i + 1, 'gem unreachable'))
            else:
                gem_status = f' | gem in {gem_min}'
                # Verify puzzle is also solvable WITHOUT going through gem
                # (gem should be optional — a bonus detour)
                if gem_min == result:
                    gem_status += ' (on main path — not optional)'
                    issues.append((i + 1, 'gem is on main path, not optional'))

        elapsed = time.time() - t1
        out(f'  Puzzle {i+1:>2} [{pid}] (par={par}, targets={targets}, splits={split}): {status}{fixed_status}{gem_status} [{elapsed:.2f}s]')

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
