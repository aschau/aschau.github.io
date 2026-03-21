"""Beamlab Puzzle Generator — Walls-First with Path-Determined Targets

Generation order:
1. Place structured walls (maze-like patterns with corridors)
2. Pick source edge
3. Build beam path through open cells (recursive backtracking)
4. Target = wherever the beam exits the grid
5. Remove mirrors — those become the player's puzzle to solve
6. Place gem adjacent to beam path
7. Verify with solver

This eliminates expensive solution-space analysis: walls constrain the grid
from the start, so the path builder is fast and shortcuts are naturally blocked.

Usage: python generate.py [count] [seed]
"""

import json, random, sys, time, hashlib
from pathlib import Path
from validate import (solve as validate_solve, solve_with_gem,
                      solve_with_known_solution)

GRID = 6
FWD = {'right': 'up', 'left': 'down', 'up': 'right', 'down': 'left'}
BCK = {'right': 'down', 'left': 'up', 'up': 'left', 'down': 'right'}
DR = {'up': -1, 'down': 1, 'left': 0, 'right': 0}
DC = {'up': 0, 'down': 0, 'left': -1, 'right': 1}
ENTRY = {'left': 'right', 'right': 'left', 'top': 'down', 'bottom': 'up'}
EDGES = ['left', 'right', 'top', 'bottom']
OPPOSITE = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}

TURN_MIRROR = {
    ('right', 'up'): 'fwd', ('right', 'down'): 'bck',
    ('left', 'up'): 'bck',  ('left', 'down'): 'fwd',
    ('up', 'right'): 'fwd', ('up', 'left'): 'bck',
    ('down', 'right'): 'bck', ('down', 'left'): 'fwd',
}
PERPENDICULAR = {
    'right': ['up', 'down'], 'left': ['up', 'down'],
    'up': ['left', 'right'], 'down': ['left', 'right'],
}


def get_entry(src):
    e, p = src['edge'], src['pos']
    d = ENTRY[e]
    if e == 'left':    return p, 0, d
    if e == 'right':   return p, GRID - 1, d
    if e == 'top':     return 0, p, d
    return GRID - 1, p, d


def simulate(grid, source):
    """Return (exits set, cells_visited set)."""
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


def hits_all(grid, source, targets):
    exits, _ = simulate(grid, source)
    return all((t['edge'], t['pos']) in exits for t in targets)


def make_empty_grid():
    return [[None] * GRID for _ in range(GRID)]


def get_exit_info(r, c):
    """Map an out-of-bounds position to (edge, pos)."""
    if r < 0:    return ('top', c)
    if r >= GRID: return ('bottom', c)
    if c < 0:    return ('left', r)
    if c >= GRID: return ('right', r)
    return None


# =============================================
# Wall Placement (Maze-like patterns)
# =============================================

def place_walls_structured(num_walls, entry_r, entry_c, entry_d):
    """Place walls that create interesting corridors without blocking the entry.

    Strategies mixed together:
    - Corridor walls: pairs/triples in a line to create channels
    - Barrier walls: block direct paths to force detours
    - Scattered walls: individual cells to narrow options
    """
    walls = set()
    # Entry line cells — don't wall these (beam must enter)
    entry_line = set()
    r, c = entry_r, entry_c
    for _ in range(2):  # protect first 2 cells of entry
        if 0 <= r < GRID and 0 <= c < GRID:
            entry_line.add((r, c))
        r += DR[entry_d]
        c += DC[entry_d]

    all_cells = [(r, c) for r in range(GRID) for c in range(GRID)
                 if (r, c) not in entry_line]

    strategies = ['corridor', 'barrier', 'scatter']

    for _ in range(num_walls * 3):  # extra iterations to hit target
        if len(walls) >= num_walls:
            break

        strategy = random.choice(strategies)

        if strategy == 'corridor':
            # Place 2-3 walls in a line (horizontal or vertical)
            hor = random.choice([True, False])
            if hor:
                row = random.randint(0, GRID - 1)
                start = random.randint(0, GRID - 2)
                length = random.randint(2, min(3, GRID - start))
                cells = [(row, start + i) for i in range(length)]
            else:
                col = random.randint(0, GRID - 1)
                start = random.randint(0, GRID - 2)
                length = random.randint(2, min(3, GRID - start))
                cells = [(start + i, col) for i in range(length)]
            for rc in cells:
                if rc not in entry_line and rc not in walls and len(walls) < num_walls:
                    walls.add(rc)

        elif strategy == 'barrier':
            # Single wall on the direct entry path (forces a detour)
            r, c = entry_r, entry_c
            steps = random.randint(2, GRID - 1)
            for _ in range(steps):
                r += DR[entry_d]
                c += DC[entry_d]
            if 0 <= r < GRID and 0 <= c < GRID and (r, c) not in entry_line and (r, c) not in walls:
                walls.add((r, c))

        else:  # scatter
            candidates = [rc for rc in all_cells if rc not in walls]
            if candidates:
                walls.add(random.choice(candidates))

    # Verify connectivity — make sure at least 70% of non-wall cells are reachable
    # from the entry via flood fill (no isolated pockets)
    wall_list = list(walls)
    grid_check = make_empty_grid()
    for wr, wc in wall_list:
        grid_check[wr][wc] = 'wall'

    reachable = set()
    flood = [(entry_r, entry_c)]
    while flood:
        fr, fc = flood.pop()
        if (fr, fc) in reachable:
            continue
        if not (0 <= fr < GRID and 0 <= fc < GRID):
            continue
        if grid_check[fr][fc] == 'wall':
            continue
        reachable.add((fr, fc))
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            flood.append((fr + dr, fc + dc))

    open_cells = GRID * GRID - len(walls)
    if len(reachable) < open_cells * 0.7:
        return None  # walls create too many isolated pockets

    return wall_list


# =============================================
# Path Building (through wall-constrained grid)
# =============================================

def _build_path(r, c, d, walls_set, mirrors_left, visited, mirrors, min_coverage=4):
    """Build a beam path through a wall-constrained grid.

    The beam walks straight until hitting a wall or grid edge,
    then we place a mirror to turn. Target = wherever the beam
    eventually exits the grid.

    Returns (path_cells, mirrors, exit_edge, exit_pos) or None.
    """
    # Trace straight line (stop at wall, edge, or visited cell)
    line = []
    cr, cc = r, c
    while 0 <= cr < GRID and 0 <= cc < GRID:
        if (cr, cc) in walls_set or (cr, cc) in visited:
            break
        line.append((cr, cc))
        cr += DR[d]
        cc += DC[d]

    if not line:
        return None

    # Coverage pruning: check if we can still reach min_coverage rows and cols
    all_cells = visited | set(line)
    current_rows = len({r for r, c in all_cells})
    current_cols = len({c for r, c in all_cells})
    if current_rows + mirrors_left < min_coverage or current_cols + mirrors_left < min_coverage:
        return None

    # No mirrors left — beam exits from end of line
    if mirrors_left == 0:
        last_r, last_c = line[-1]
        exit_r, exit_c = last_r + DR[d], last_c + DC[d]
        # Must exit grid (not hit a wall inside grid)
        if not (0 <= exit_r < GRID and 0 <= exit_c < GRID):
            info = get_exit_info(exit_r, exit_c)
            if info:
                rows = {r for r, c in all_cells}
                cols = {c for r, c in all_cells}
                if len(rows) >= min_coverage and len(cols) >= min_coverage:
                    return (set(line), list(mirrors), info[0], info[1])
        return None

    # Place a mirror at each position — prefer LONGER segments first
    indices = list(range(len(line) - 1, -1, -1))
    # Add some randomness so we don't always pick the longest
    if random.random() < 0.3:
        random.shuffle(indices)

    for idx in indices:
        mr, mc = line[idx]
        segment = set(line[:idx + 1])
        new_visited = visited | segment

        turns = list(PERPENDICULAR[d])
        random.shuffle(turns)

        for new_d in turns:
            nr, nc = mr + DR[new_d], mc + DC[new_d]
            if not (0 <= nr < GRID and 0 <= nc < GRID):
                continue
            if (nr, nc) in new_visited or (nr, nc) in walls_set:
                continue

            mtype = TURN_MIRROR[(d, new_d)]
            result = _build_path(
                nr, nc, new_d, walls_set,
                mirrors_left - 1, new_visited,
                mirrors + [(mr, mc, mtype)],
                min_coverage
            )
            if result:
                sub_cells, sub_mirrors, exit_edge, exit_pos = result
                return (segment | sub_cells, sub_mirrors, exit_edge, exit_pos)

    return None


def _build_splitter_path(r, c, d, walls_set, branch_mirrors, visited, min_coverage=4):
    """Build a path with one splitter creating two branches.

    Places the splitter on the initial straight line, then builds
    two sub-paths (reflected + straight-through). Each branch's
    exit becomes a target.

    Returns (path_cells, mirrors, [(exit_edge, exit_pos), ...]) or None.
    """
    # Straight line from entry
    beam_line = []
    cr, cc = r, c
    while 0 <= cr < GRID and 0 <= cc < GRID:
        if (cr, cc) in walls_set or (cr, cc) in visited:
            break
        beam_line.append((cr, cc))
        cr += DR[d]
        cc += DC[d]

    if len(beam_line) < 2:
        return None

    positions = list(range(len(beam_line)))
    random.shuffle(positions)

    for si in positions[:5]:
        sr, sc = beam_line[si]
        split_type = random.choice(['split_fwd', 'split_bck'])
        ref_d = FWD[d] if split_type == 'split_fwd' else BCK[d]
        pre = set(beam_line[:si + 1])
        remaining_straight = set(beam_line[si + 1:])

        for total in range(branch_mirrors + 1):
            for ref_n in range(total + 1):
                str_n = total - ref_n

                # Reflected branch
                rr, rc = sr + DR[ref_d], sc + DC[ref_d]
                if not (0 <= rr < GRID and 0 <= rc < GRID) or (rr, rc) in walls_set:
                    continue

                ref_visited = pre | remaining_straight
                ref = _build_path(rr, rc, ref_d, walls_set, ref_n, ref_visited, [], 3)
                if not ref:
                    continue
                ref_cells, ref_mirrors, ref_exit_edge, ref_exit_pos = ref

                # Straight branch
                sr2, sc2 = sr + DR[d], sc + DC[d]
                if not (0 <= sr2 < GRID and 0 <= sc2 < GRID):
                    # Exits immediately
                    info = get_exit_info(sr2, sc2)
                    if info and str_n == 0:
                        all_path = pre | ref_cells
                        all_mirrors = [(sr, sc, split_type)] + ref_mirrors
                        rows = {r for r, c in all_path}
                        cols = {c for r, c in all_path}
                        if len(rows) >= min_coverage and len(cols) >= min_coverage:
                            exits = [(ref_exit_edge, ref_exit_pos), info]
                            return (all_path, all_mirrors, exits)
                    continue

                if (sr2, sc2) in walls_set:
                    continue

                str_visited = pre | ref_cells
                strt = _build_path(sr2, sc2, d, walls_set, str_n, str_visited, [], 3)
                if not strt:
                    continue
                str_cells, str_mirrors, str_exit_edge, str_exit_pos = strt

                # Check exits are different
                if ref_exit_edge == str_exit_edge and ref_exit_pos == str_exit_pos:
                    continue

                all_path = pre | ref_cells | str_cells
                all_mirrors = [(sr, sc, split_type)] + ref_mirrors + str_mirrors

                rows = {r for r, c in all_path}
                cols = {c for r, c in all_path}
                if len(rows) >= min_coverage and len(cols) >= min_coverage:
                    exits = [(ref_exit_edge, ref_exit_pos), (str_exit_edge, str_exit_pos)]
                    return (all_path, all_mirrors, exits)

    return None


# =============================================
# Gem Placement
# =============================================

def find_gem_candidates(beam_path, occupied, walls_set):
    """Find all cells adjacent to the beam path that could hold a gem."""
    candidates = set()
    for r, c in beam_path:
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if (0 <= nr < GRID and 0 <= nc < GRID and
                (nr, nc) not in beam_path and
                (nr, nc) not in occupied and
                (nr, nc) not in walls_set):
                candidates.add((nr, nc))
    return sorted(candidates)


# =============================================
# Main Generator
# =============================================

def generate_puzzle(difficulty='expert', use_splitter=False):
    """Generate a puzzle: walls first, path determines target.

    Difficulty controls:
    - mirror_range: total mirrors in the intended path (some become fixed)
    - wall_range: how many walls (fewer = harder, more wrong options)
    - fixed_range: how many mirrors to pre-place (adds complexity)
    - min_required: minimum PLAYER-placed pieces (after accounting for fixed)
    """
    cfg = {
        'medium': {'mirror_range': (3, 4), 'wall_range': (4, 6), 'fixed_range': (1, 1), 'min_required': 3},
        'hard':   {'mirror_range': (4, 6), 'wall_range': (4, 7), 'fixed_range': (1, 1), 'min_required': 4},
        'expert': {'mirror_range': (5, 7), 'wall_range': (4, 6), 'fixed_range': (1, 2), 'min_required': 4},
    }[difficulty]

    _fail_reasons = {'walls': 0, 'path': 0, 'verify': 0, 'fixed': 0,
                      'min_low': 0, 'min_high': 0, 'gem': 0}

    for attempt in range(300):
        # 1. Pick source
        src_edge = random.choice(EDGES)
        src_pos = random.randint(0, GRID - 1)
        source = {'edge': src_edge, 'pos': src_pos}
        entry_r, entry_c, entry_d = get_entry(source)

        # 2. Place walls (maze-like, respecting entry)
        num_walls = random.randint(*cfg['wall_range'])
        if num_walls == 0:
            wall_list = []
        else:
            wall_list = place_walls_structured(num_walls, entry_r, entry_c, entry_d)
            if wall_list is None:
                _fail_reasons['walls'] += 1
                continue
        walls_set = set(wall_list)
        walls = [{'r': r, 'c': c} for r, c in wall_list]

        # 3. Build beam path through the constrained grid
        if use_splitter:
            branch_mirrors = random.randint(1, 3)
            result = _build_splitter_path(
                entry_r, entry_c, entry_d, walls_set,
                branch_mirrors, set(), min_coverage=4
            )
            if not result:
                _fail_reasons['path'] += 1
                continue
            path_cells, mirrors, exit_list = result
            targets = [{'edge': e, 'pos': p} for e, p in exit_list]
            if any(t['edge'] == src_edge and t['pos'] == src_pos for t in targets):
                _fail_reasons['path'] += 1
                continue
        else:
            num_mirrors = random.randint(*cfg['mirror_range'])
            result = _build_path(
                entry_r, entry_c, entry_d, walls_set,
                num_mirrors, set(), [], min_coverage=4
            )
            if not result:
                _fail_reasons['path'] += 1
                continue
            path_cells, mirrors, exit_edge, exit_pos = result
            if exit_edge == src_edge and exit_pos == src_pos:
                _fail_reasons['path'] += 1
                continue
            targets = [{'edge': exit_edge, 'pos': exit_pos}]

        # 4. Verify intended solution works
        grid = make_empty_grid()
        for wr, wc in wall_list:
            grid[wr][wc] = 'wall'
        for r, c, t in mirrors:
            grid[r][c] = t
        if not hits_all(grid, source, targets):
            _fail_reasons['verify'] += 1
            continue

        # 5. Select fixed pieces (pre-placed mirrors from the solution)
        #    Fixed pieces alone must NOT hit any targets (would make puzzle trivial)
        num_fixed = random.randint(*cfg['fixed_range'])
        fixed = []
        if num_fixed > 0 and len(mirrors) > num_fixed + 1:
            pick_count = min(num_fixed, len(mirrors) - 1)
            target_set = {(t['edge'], t['pos']) for t in targets}

            # Pre-filter: find which individual mirrors are safe (don't route
            # the beam to any target on their own). Only combine safe mirrors.
            safe_indices = []
            for mi in range(len(mirrors)):
                test_grid = make_empty_grid()
                for wr, wc in wall_list:
                    test_grid[wr][wc] = 'wall'
                mr, mc, mt = mirrors[mi]
                test_grid[mr][mc] = mt
                exits, _ = simulate(test_grid, source)
                if not (exits & target_set):
                    safe_indices.append(mi)

            if len(safe_indices) < pick_count:
                continue  # not enough safe mirrors to pick from

            # Try random combinations of safe mirrors
            fixed_ok = False
            for _ in range(20):
                chosen = random.sample(safe_indices, pick_count)
                candidate_fixed = [{'r': mirrors[i][0], 'c': mirrors[i][1],
                                    'type': mirrors[i][2]} for i in chosen]

                # Verify the combination together doesn't hit targets
                if pick_count > 1:
                    test_grid = make_empty_grid()
                    for wr, wc in wall_list:
                        test_grid[wr][wc] = 'wall'
                    for f in candidate_fixed:
                        test_grid[f['r']][f['c']] = f['type']
                    exits, _ = simulate(test_grid, source)
                    if exits & target_set:
                        continue

                fixed = candidate_fixed
                fixed_ok = True
                break

            if not fixed_ok:
                _fail_reasons['fixed'] += 1
                continue

        # 6. Build puzzle and verify minimum ADDITIONAL pieces with full solver
        #    Fixed pieces are already on the grid (handled by make_grid via 'fixed')
        has_split = any(t in ('split', 'split_fwd', 'split_bck') for _, _, t in mirrors)
        inv_temp = {'fwd': 8, 'bck': 8}
        if has_split:
            inv_temp['split'] = 3
        puzzle = {
            'source': source,
            'targets': targets,
            'walls': walls,
            'fixed': fixed,
            'par': 8,
            'inventory': inv_temp,
            'difficulty': difficulty,
        }

        min_pieces = validate_solve(puzzle)
        if min_pieces < 0 or min_pieces < cfg['min_required']:
            _fail_reasons['min_low'] += 1
            continue
        if min_pieces > 7:
            _fail_reasons['min_high'] += 1
            continue

        par = min_pieces + 1
        inv = {'fwd': par, 'bck': par}
        if has_split:
            inv['split'] = max(2, par - 1)
        puzzle['par'] = par
        puzzle['inventory'] = inv
        puzzle['_min'] = min_pieces

        # 7. Place gem — required, must be optional (reachable but not on main path)
        occupied = {(r, c) for r, c, _ in mirrors}
        gem_candidates = find_gem_candidates(path_cells, occupied, walls_set)
        random.shuffle(gem_candidates)

        placed_gem = False
        for gem_r, gem_c in gem_candidates[:8]:
            puzzle['gem'] = {'r': gem_r, 'c': gem_c}
            gem_min = solve_with_gem(puzzle, par + 1)
            if gem_min == -1:
                continue
            if gem_min <= min_pieces:
                continue
            placed_gem = True
            break

        if not placed_gem:
            if 'gem' in puzzle:
                del puzzle['gem']
            _fail_reasons['gem'] += 1
            continue

        puzzle['_fail_reasons'] = _fail_reasons
        return puzzle

    return _fail_reasons


def puzzle_hash(puzzle):
    """Generate a short hash ID for a puzzle based on its structure."""
    key = json.dumps({
        'source': puzzle['source'],
        'targets': puzzle['targets'],
        'walls': sorted([f"{w['r']},{w['c']}" for w in puzzle['walls']])
    }, sort_keys=True)
    return hashlib.sha256(key.encode()).hexdigest()[:8]


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if seed is not None:
        random.seed(seed)

    print(f'Generating {count} puzzle(s) [walls-first + path-determined targets]...')
    print('---')

    puzzles = []
    seen_hashes = set()
    max_attempts = count * 15
    attempts = 0

    t0 = time.time()
    while len(puzzles) < count and attempts < max_attempts:
        attempts += 1
        t1 = time.time()

        # Difficulty mix: 20% medium, 45% hard, 35% expert
        r = random.random()
        diff = 'medium' if r < 0.2 else ('hard' if r < 0.65 else 'expert')

        # 25% splitter puzzles (splitters have lower success rate)
        use_splitter = random.random() < 0.25
        puzzle = generate_puzzle(diff, use_splitter=use_splitter)

        elapsed = time.time() - t1

        if puzzle and isinstance(puzzle, dict) and 'source' in puzzle:
            fail_reasons = puzzle.pop('_fail_reasons', {})
            min_p = puzzle.pop('_min')
            h = puzzle_hash(puzzle)

            if h in seen_hashes:
                print(f'  Attempt {attempts}: DUPLICATE (hash={h}), skipping [{elapsed:.2f}s]')
                continue

            seen_hashes.add(h)
            puzzle['id'] = h
            puzzles.append(puzzle)
            targets = len(puzzle['targets'])
            splits = puzzle['inventory'].get('split', 0)
            has_gem = 'gem' in puzzle
            nwalls = len(puzzle['walls'])
            nfixed = len(puzzle.get('fixed', []))
            pdiff = puzzle.get('difficulty', '?')
            print(f'  Puzzle {len(puzzles)}: {pdiff} par={puzzle["par"]}, min={min_p}, '
                  f'targets={targets}, splits={splits}, walls={nwalls}, fixed={nfixed}, '
                  f'gem={has_gem}, id={h} [{elapsed:.2f}s]')
        else:
            ptype = 'splitter' if use_splitter else 'mirror'
            reasons = puzzle if isinstance(puzzle, dict) else {}
            reason_str = ', '.join(f'{k}={v}' for k, v in reasons.items() if v > 0) if reasons else 'exhausted'
            print(f'  Attempt {attempts}: FAILED ({ptype}) [{elapsed:.2f}s] ({reason_str})')
        sys.stdout.flush()

    total = time.time() - t0
    print(f'---')
    print(f'Generated {len(puzzles)}/{count} puzzles ({total:.1f}s)')

    save_puzzles(puzzles)


def fixed_hits_target(puzzle):
    """Check if fixed pieces alone route the beam to any target."""
    if not puzzle.get('fixed'):
        return False
    grid = [[None] * GRID for _ in range(GRID)]
    for w in puzzle['walls']:
        grid[w['r']][w['c']] = 'wall'
    for f in puzzle['fixed']:
        grid[f['r']][f['c']] = f['type']
    exits, _ = simulate(grid, puzzle['source'])
    target_set = {(t['edge'], t['pos']) for t in puzzle['targets']}
    return bool(exits & target_set)


def patch():
    """Load existing puzzles, keep good ones, replace bad ones."""
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if seed is not None:
        random.seed(seed)

    json_path = Path(__file__).parent / 'puzzles.json'
    existing = json.loads(json_path.read_text())
    total = len(existing)

    print(f'Patching {total} existing puzzles...')
    print('---')

    kept = 0
    replaced = 0
    puzzles = []
    seen_hashes = set()

    for i, p in enumerate(existing):
        h = puzzle_hash(p)
        if fixed_hits_target(p):
            # Bad puzzle — needs replacement
            print(f'  Puzzle {i+1} [{h}]: REPLACING (fixed hits target)')
            replacement = None
            for _ in range(50):
                r = random.random()
                diff = p.get('difficulty', 'hard')
                use_splitter = any(f.get('type') in ('split', 'split_fwd', 'split_bck') for f in p.get('fixed', []))
                candidate = generate_puzzle(diff, use_splitter=use_splitter)
                if candidate and isinstance(candidate, dict) and 'source' in candidate:
                    candidate.pop('_fail_reasons', None)
                    candidate.pop('_min', None)
                    ch = puzzle_hash(candidate)
                    if ch not in seen_hashes:
                        candidate['id'] = ch
                        replacement = candidate
                        break

            if replacement:
                seen_hashes.add(puzzle_hash(replacement))
                puzzles.append(replacement)
                replaced += 1
                rh = replacement['id']
                print(f'           -> {replacement["difficulty"]} par={replacement["par"]}, id={rh}')
            else:
                # Couldn't replace — keep original as fallback
                seen_hashes.add(h)
                puzzles.append(p)
                kept += 1
                print(f'           -> KEPT (no replacement found)')
        else:
            seen_hashes.add(h)
            puzzles.append(p)
            kept += 1

    print(f'---')
    print(f'Kept {kept}, replaced {replaced} of {total} puzzles')

    save_puzzles(puzzles)


def save_puzzles(puzzles):
    """Write puzzles to both JSON and JS files."""
    json_path = Path(__file__).parent / 'puzzles.json'
    json_path.write_text(json.dumps(puzzles, indent=2))
    print(f'Saved JSON to {json_path}')

    js_path = Path(__file__).parent / 'puzzles.js'
    compact = json.dumps(puzzles, separators=(',', ':'))
    js_content = f"""// ============================================
// Beamlab — Puzzle Data & Daily Selection
// Auto-generated by generate.py — do not edit manually
// ============================================

var PUZZLES = {compact};

var LAUNCH_EPOCH = new Date('2026-03-17T00:00:00');

function getDailyPuzzleIndex() {{
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var epoch = new Date(LAUNCH_EPOCH);
    epoch.setHours(0, 0, 0, 0);
    var dayIndex = Math.floor((now - epoch) / 86400000);
    return ((dayIndex % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
}}

function getDailyPuzzleNumber() {{
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var epoch = new Date(LAUNCH_EPOCH);
    epoch.setHours(0, 0, 0, 0);
    return Math.floor((now - epoch) / 86400000) + 1;
}}

function getDailyPuzzle() {{
    var index = getDailyPuzzleIndex();
    return JSON.parse(JSON.stringify(PUZZLES[index]));
}}

function getTodayDateString() {{
    return new Date().toLocaleDateString('en-US', {{
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }});
}}
"""
    js_path.write_text(js_content)
    print(f'Saved JS to {js_path}')


def _generate_one_puzzle(args):
    """Worker function for multiprocessing puzzle generation."""
    idx, seed_val = args
    random.seed(seed_val)
    for _ in range(50):
        r = random.random()
        diff = 'medium' if r < 0.2 else ('hard' if r < 0.65 else 'expert')
        use_splitter = random.random() < 0.25
        candidate = generate_puzzle(diff, use_splitter=use_splitter)
        if candidate and isinstance(candidate, dict) and 'source' in candidate:
            candidate.pop('_fail_reasons', None)
            candidate.pop('_min', None)
            candidate['id'] = puzzle_hash(candidate)
            return (idx, candidate)
    return (idx, None)


def regenerate_future():
    """Keep past/today puzzles, regenerate future ones with updated mechanics."""
    from datetime import date
    from multiprocessing import Pool, cpu_count
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 42
    random.seed(seed)

    json_path = Path(__file__).parent / 'puzzles.json'
    existing = json.loads(json_path.read_text())
    total = len(existing)

    epoch = date(2026, 3, 17)
    today = date.today()
    days_passed = (today - epoch).days
    cutoff = max(0, days_passed)  # keep indices 0..cutoff (inclusive)

    num_to_gen = total - cutoff - 1
    cores = cpu_count()
    print(f'Regenerating puzzles: keeping 0-{cutoff} ({cutoff + 1} served), regenerating {num_to_gen} using {cores} cores...')
    print('---')
    sys.stdout.flush()

    # Generate unique seeds for each puzzle worker
    worker_args = [(i, seed + i * 7919) for i in range(cutoff + 1, total)]

    results = {}
    with Pool(cores) as pool:
        for idx, puzzle in pool.imap_unordered(_generate_one_puzzle, worker_args):
            results[idx] = puzzle
            status = f'par={puzzle["par"]}, id={puzzle["id"]}' if puzzle else 'FAILED'
            print(f'  Puzzle {idx + 1}: {status}')
            sys.stdout.flush()

    # Assemble in order
    puzzles = existing[:cutoff + 1]
    seen_hashes = {puzzle_hash(p) for p in puzzles}
    regenerated = 0

    for i in range(cutoff + 1, total):
        p = results.get(i)
        if p and puzzle_hash(p) not in seen_hashes:
            seen_hashes.add(puzzle_hash(p))
            puzzles.append(p)
            regenerated += 1
        else:
            puzzles.append(existing[i])

    print(f'---')
    print(f'Kept {cutoff + 1}, regenerated {regenerated} of {total} puzzles')
    save_puzzles(puzzles)


if __name__ == '__main__':
    if '--patch' in sys.argv:
        patch()
    elif '--regenerate-future' in sys.argv:
        regenerate_future()
    else:
        main()
