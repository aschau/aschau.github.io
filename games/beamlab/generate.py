"""Beamlab Puzzle Generator
Generates valid, verified puzzles by placing a solution first,
then deriving the puzzle from it.

Usage: python generate.py [count]
  count: number of puzzles to generate (default: 1)
Outputs to generated_puzzles.json
"""

import json, random, sys, time, hashlib
from pathlib import Path
from validate import solve as validate_solve, solve_with_gem

GRID = 6
FWD = {'right': 'up', 'left': 'down', 'up': 'right', 'down': 'left'}
BCK = {'right': 'down', 'left': 'up', 'up': 'left', 'down': 'right'}
DR = {'up': -1, 'down': 1, 'left': 0, 'right': 0}
DC = {'up': 0, 'down': 0, 'left': -1, 'right': 1}
ENTRY = {'left': 'right', 'right': 'left', 'top': 'down', 'bottom': 'up'}
EDGES = ['left', 'right', 'top', 'bottom']
OPPOSITE = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}


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


def hits_all(grid, source, targets):
    exits, _ = simulate(grid, source)
    return all((t['edge'], t['pos']) in exits for t in targets)


def make_empty_grid():
    return [[None] * GRID for _ in range(GRID)]



def generate_mirror_puzzle(difficulty='medium'):
    """Generate a single-target mirror-only puzzle by placing a solution first.

    Strategy:
    1. Pick a random source edge+position
    2. Place 2-5 mirrors randomly on the grid
    3. Trace the beam to see where it exits
    4. If it exits the grid (not back through source), that exit = target
    5. Add some random walls that don't block the solution path
    6. Verify with solver and set par = min + 1
    """
    diff_config = {
        'medium':  {'mirrors': (3, 5), 'walls': (3, 5), 'min_required': 3},
        'hard':    {'mirrors': (4, 5), 'walls': (4, 6), 'min_required': 3},
        'expert':  {'mirrors': (4, 6), 'walls': (4, 6), 'min_required': 3},
    }
    cfg = diff_config[difficulty]
    mirror_range = cfg['mirrors']
    wall_range = cfg['walls']

    for attempt in range(1000):
        grid = make_empty_grid()

        # Pick source
        src_edge = random.choice(EDGES)
        src_pos = random.randint(0, GRID - 1)
        source = {'edge': src_edge, 'pos': src_pos}

        # Place mirrors
        num_mirrors = random.randint(*mirror_range)
        mirror_cells = []
        occupied = set()

        for _ in range(num_mirrors):
            for _try in range(50):
                r, c = random.randint(0, GRID - 1), random.randint(0, GRID - 1)
                if (r, c) not in occupied:
                    mtype = random.choice(['fwd', 'bck'])
                    grid[r][c] = mtype
                    occupied.add((r, c))
                    mirror_cells.append((r, c, mtype))
                    break

        # Trace beam
        exits, beam_path = simulate(grid, source)

        if not exits:
            continue

        # Check beam uses enough of the grid (spans at least 4 of 6 rows and cols)
        if beam_path:
            rows = {r for r, c in beam_path}
            cols = {c for r, c in beam_path}
            if len(rows) < 4 or len(cols) < 4:
                continue

        # Pick a valid target (not the source edge+pos)
        valid_targets = [(e, p) for e, p in exits if not (e == src_edge and p == src_pos)]
        if not valid_targets:
            continue

        # Prefer targets on opposite or perpendicular edges for longer paths
        opposite_targets = [(e, p) for e, p in valid_targets if e == OPPOSITE[src_edge]]
        perp_targets = [(e, p) for e, p in valid_targets if e != src_edge and e != OPPOSITE[src_edge]]
        if opposite_targets:
            target_edge, target_pos = random.choice(opposite_targets)
        elif perp_targets:
            target_edge, target_pos = random.choice(perp_targets)
        else:
            target_edge, target_pos = random.choice(valid_targets)

        targets = [{'edge': target_edge, 'pos': target_pos}]

        # Clear mirrors from grid, add walls
        for r, c, _ in mirror_cells:
            grid[r][c] = None

        # Place walls: mix of blocking walls (on direct source-target line)
        # and strategic walls (adjacent to beam path to constrain options)
        walls = []
        num_walls = random.randint(*wall_range)

        # Find direct line cells (where beam would go without mirrors)
        sr, sc, sd = get_entry(source)
        direct_line = set()
        r, c = sr, sc
        for _ in range(GRID):
            if 0 <= r < GRID and 0 <= c < GRID:
                direct_line.add((r, c))
                r += DR[sd]
                c += DC[sd]

        # Also trace from target inward
        tr, tc, td = get_entry(targets[0])
        r, c = tr, tc
        for _ in range(GRID):
            if 0 <= r < GRID and 0 <= c < GRID:
                direct_line.add((r, c))
                r += DR[td]
                c += DC[td]

        # Place some walls on direct lines (blocking) and some near beam path (strategic)
        blocking_candidates = [(r, c) for r, c in direct_line
                               if (r, c) not in occupied and (r, c) not in beam_path]
        nearby_candidates = []
        for br, bc in beam_path:
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = br + dr, bc + dc
                if (0 <= nr < GRID and 0 <= nc < GRID and
                    (nr, nc) not in occupied and (nr, nc) not in beam_path and
                    (nr, nc) not in direct_line):
                    nearby_candidates.append((nr, nc))

        random.shuffle(blocking_candidates)
        random.shuffle(nearby_candidates)
        all_wall_candidates = blocking_candidates + nearby_candidates

        for wc in all_wall_candidates[:num_walls]:
            r, c = wc
            if (r, c) not in occupied:
                grid[r][c] = 'wall'
                walls.append({'r': r, 'c': c})
                occupied.add((r, c))

        # Clear grid for verification
        clean_grid = make_empty_grid()
        for w in walls:
            clean_grid[w['r']][w['c']] = 'wall'

        # Verify: place solution mirrors and check
        for r, c, mtype in mirror_cells:
            clean_grid[r][c] = mtype
        if not hits_all(clean_grid, source, targets):
            continue  # walls blocked the solution

        # Build a temporary puzzle dict for the validator
        inv_temp = {'fwd': len(mirror_cells) + 2, 'bck': len(mirror_cells) + 2}
        temp_puzzle = {
            'source': source, 'targets': targets, 'walls': walls,
            'par': 99, 'inventory': inv_temp
        }

        # Use validator's solver for consistency
        min_pieces = validate_solve(temp_puzzle)

        if min_pieces <= 0 or min_pieces > 6:
            continue

        if min_pieces < cfg['min_required']:
            continue

        par = min_pieces + 1
        inv = {'fwd': par, 'bck': par}

        gem = place_gem(beam_path, occupied, walls)

        puzzle = {
            'source': source, 'targets': targets, 'walls': walls,
            'par': par, 'inventory': inv, 'difficulty': difficulty,
            '_min': min_pieces
        }
        if gem:
            puzzle['gem'] = gem
            # Verify gem is reachable within par + 2
            gem_min = solve_with_gem(puzzle, par + 2)
            if gem_min == -1:
                del puzzle['gem']  # gem unreachable, remove it

        return puzzle

    return None


def place_gem(beam_path, occupied, walls):
    """Place a gem adjacent to the beam path but not on it or on walls."""
    wall_set = {(w['r'], w['c']) for w in walls}
    candidates = set()
    for r, c in beam_path:
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if (0 <= nr < GRID and 0 <= nc < GRID and
                (nr, nc) not in beam_path and
                (nr, nc) not in occupied and
                (nr, nc) not in wall_set):
                candidates.add((nr, nc))
    if not candidates:
        return None
    r, c = random.choice(sorted(candidates))
    return {'r': r, 'c': c}


def generate_splitter_puzzle(difficulty='hard'):
    """Generate a multi-target puzzle requiring splitters."""
    diff_config = {
        'hard':   {'mirrors': (2, 4), 'walls': (2, 4), 'min_required': 3},
        'expert': {'mirrors': (3, 5), 'walls': (3, 6), 'min_required': 4},
    }
    cfg = diff_config[difficulty]

    for attempt in range(1000):
        grid = make_empty_grid()

        # Pick source
        src_edge = random.choice(EDGES)
        src_pos = random.randint(0, GRID - 1)
        source = {'edge': src_edge, 'pos': src_pos}

        occupied = set()

        # Place a splitter on the beam path
        # First trace the beam with no pieces to find the path
        sr, sc, sd = get_entry(source)
        beam_line = []
        r, c, d = sr, sc, sd
        for _ in range(GRID):
            if 0 <= r < GRID and 0 <= c < GRID:
                beam_line.append((r, c))
                r += DR[d]
                c += DC[d]
            else:
                break

        if len(beam_line) < 3:
            continue

        # Place splitter somewhere on the beam line (not first or last)
        split_idx = random.randint(1, len(beam_line) - 2)
        split_r, split_c = beam_line[split_idx]
        grid[split_r][split_c] = 'split'
        occupied.add((split_r, split_c))

        # Place some mirrors for the reflected beam path
        num_mirrors = random.randint(*cfg['mirrors'])
        mirror_cells = [(split_r, split_c, 'split')]

        for _ in range(num_mirrors):
            for _try in range(50):
                r, c = random.randint(0, GRID - 1), random.randint(0, GRID - 1)
                if (r, c) not in occupied:
                    mtype = random.choice(['fwd', 'bck'])
                    grid[r][c] = mtype
                    occupied.add((r, c))
                    mirror_cells.append((r, c, mtype))
                    break

        # Trace and find exits
        exits, beam_path = simulate(grid, source)

        # Check beam spread
        if beam_path:
            rows = {r for r, c in beam_path}
            cols = {c for r, c in beam_path}
            if len(rows) < GRID * 0.6 or len(cols) < GRID * 0.6:
                continue

        valid_targets = [(e, p) for e, p in exits if not (e == src_edge and p == src_pos)]

        if len(valid_targets) < 2:
            continue

        # Pick 2 targets
        chosen = random.sample(valid_targets, 2)
        targets = [{'edge': e, 'pos': p} for e, p in chosen]

        # Clear pieces, add walls
        for r, c, _ in mirror_cells:
            grid[r][c] = None

        walls = []
        num_walls = random.randint(*cfg['walls'])
        for _ in range(num_walls):
            for _try in range(50):
                r, c = random.randint(0, GRID - 1), random.randint(0, GRID - 1)
                if (r, c) not in occupied and (r, c) not in beam_path:
                    grid[r][c] = 'wall'
                    walls.append({'r': r, 'c': c})
                    occupied.add((r, c))
                    break

        # Verify solution still works with walls
        clean_grid = make_empty_grid()
        for w in walls:
            clean_grid[w['r']][w['c']] = 'wall'
        for r, c, mtype in mirror_cells:
            clean_grid[r][c] = mtype
        if not hits_all(clean_grid, source, targets):
            continue

        inv_temp = {'fwd': len(mirror_cells) + 2, 'bck': len(mirror_cells) + 2, 'split': 2}
        temp_puzzle = {
            'source': source, 'targets': targets, 'walls': walls,
            'par': 99, 'inventory': inv_temp
        }

        min_pieces = validate_solve(temp_puzzle)
        if min_pieces <= 0 or min_pieces > 7:
            continue

        if min_pieces < cfg['min_required']:
            continue

        par = min_pieces + 1
        inv = {'fwd': par, 'bck': par, 'split': 2}

        gem = place_gem(beam_path, occupied, walls)

        puzzle = {
            'source': source, 'targets': targets, 'walls': walls,
            'par': par, 'inventory': inv, 'difficulty': difficulty,
            '_min': min_pieces
        }
        if gem:
            puzzle['gem'] = gem
            gem_min = solve_with_gem(puzzle, par + 2)
            if gem_min == -1:
                del puzzle['gem']
        return puzzle

    return None



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

    print(f'Generating {count} puzzle(s)...')
    print('---')

    puzzles = []
    seen_hashes = set()
    difficulties = ['expert']
    max_attempts = count * 3  # allow retries for duplicates/failures
    attempts = 0

    t0 = time.time()
    while len(puzzles) < count and attempts < max_attempts:
        attempts += 1
        diff = random.choice(difficulties)
        t1 = time.time()

        # 50% mirror-only, 50% splitter
        if random.random() < 0.5:
            puzzle = generate_mirror_puzzle(diff)
        else:
            puzzle = generate_splitter_puzzle(diff)

        elapsed = time.time() - t1

        if puzzle:
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
            print(f'  Puzzle {len(puzzles)}: par={puzzle["par"]}, min={min_p}, '
                  f'targets={targets}, splits={splits}, walls={len(puzzle["walls"])}, '
                  f'gem={has_gem}, id={h} [{elapsed:.2f}s]')
        else:
            print(f'  Attempt {attempts}: FAILED ({diff}) [{elapsed:.2f}s]')
        sys.stdout.flush()

    total = time.time() - t0
    print(f'---')
    print(f'Generated {len(puzzles)}/{count} puzzles ({total:.1f}s)')

    # Save JSON (for validator)
    json_path = Path(__file__).parent / 'puzzles.json'
    json_path.write_text(json.dumps(puzzles, indent=2))
    print(f'Saved JSON to {json_path}')

    # Save JS (for game — inline data, works on file://)
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


if __name__ == '__main__':
    main()
