/**
 * A self-contained Sudoku engine: generate a puzzle with a guaranteed-unique
 * solution, and validate a submitted grid against it.
 *
 * Everything here is a pure function of its inputs (given a seedable RNG), which is
 * what lets the *server* own the solution. The client is handed only the puzzle; the
 * completed solution never leaves the server until the player has earned it, so a
 * player reading their own network traffic learns nothing they didn't already have to
 * solve.
 *
 * A grid is a length-81 array of digits 0-9, row-major. 0 means empty.
 */

export type Grid = number[];

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** How many of the 81 cells are pre-filled, by difficulty. Fewer givens = harder. */
const GIVENS: Record<Difficulty, number> = {
  EASY: 42,
  MEDIUM: 34,
  HARD: 28,
};

const SIZE = 9;
const CELLS = 81;

// --- Seedable RNG -----------------------------------------------------------

/**
 * mulberry32 — a tiny, fast, deterministic PRNG. Determinism matters: a given seed
 * always produces the same puzzle, so a puzzle can be regenerated from the seed
 * stored on the game session rather than persisting the whole 81-cell grid.
 */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(array: T[], rng: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// --- Constraints ------------------------------------------------------------

function isSafe(grid: Grid, index: number, value: number): boolean {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row * SIZE + i] === value) return false; // row
    if (grid[i * SIZE + col] === value) return false; // column
  }

  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (grid[(boxRow + r) * SIZE + (boxCol + c)] === value) return false; // box
    }
  }

  return true;
}

// --- Solving ----------------------------------------------------------------

/** Fill a grid in place with a valid solution. Randomised so generation varies. */
function fillGrid(grid: Grid, rng: () => number): boolean {
  const index = grid.indexOf(0);
  if (index === -1) return true; // full

  for (const value of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
    if (isSafe(grid, index, value)) {
      grid[index] = value;
      if (fillGrid(grid, rng)) return true;
      grid[index] = 0;
    }
  }

  return false;
}

/**
 * Count solutions, stopping at `limit`. Uniqueness only needs to know whether there
 * is more than one, so we bail at 2 — counting them all would be pointlessly slow.
 */
function countSolutions(grid: Grid, limit = 2): number {
  const index = grid.indexOf(0);
  if (index === -1) return 1;

  let count = 0;
  for (let value = 1; value <= SIZE; value += 1) {
    if (isSafe(grid, index, value)) {
      grid[index] = value;
      count += countSolutions(grid, limit);
      grid[index] = 0;
      if (count >= limit) return count;
    }
  }

  return count;
}

// --- Generation -------------------------------------------------------------

export interface GeneratedPuzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
}

/**
 * Generate a puzzle whose solution is provably unique.
 *
 * Cells are removed one at a time; after each removal we confirm the puzzle still has
 * exactly one solution, and put the cell back if it doesn't. Uniqueness is what makes
 * server-side validation fair — a player can't submit a different-but-also-valid grid
 * and be told they're wrong.
 */
export function generatePuzzle(difficulty: Difficulty, seed?: number): GeneratedPuzzle {
  // Capped to a signed 32-bit range (2^31 - 1) so the seed persists cleanly in a
  // Postgres INT4 column. mulberry32 treats it as unsigned either way, so 31 bits of
  // entropy is plenty of puzzle variety.
  const actualSeed = seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = createRng(actualSeed);

  const solution: Grid = new Array(CELLS).fill(0);
  fillGrid(solution, rng);

  const puzzle = [...solution];
  const targetGivens = GIVENS[difficulty];
  let filled = CELLS;

  // Try to remove cells in a random order until we hit the target given-count.
  for (const index of shuffled([...Array(CELLS).keys()], rng)) {
    if (filled <= targetGivens) break;
    if (puzzle[index] === 0) continue;

    const backup = puzzle[index]!;
    puzzle[index] = 0;

    // Removing this cell must not open a second solution.
    const probe = [...puzzle];
    if (countSolutions(probe) !== 1) {
      puzzle[index] = backup; // undo — this cell is load-bearing for uniqueness
    } else {
      filled -= 1;
    }
  }

  return { puzzle, solution, difficulty, seed: actualSeed };
}

/** Regenerate the exact same puzzle from a stored seed + difficulty. */
export function puzzleFromSeed(difficulty: Difficulty, seed: number): GeneratedPuzzle {
  return generatePuzzle(difficulty, seed);
}

// --- Validation -------------------------------------------------------------

export interface ValidationResult {
  isComplete: boolean;
  isCorrect: boolean;
  /** Indices where the submitted value contradicts the solution. */
  wrongCells: number[];
  /** Number of the 81 cells still empty. */
  emptyCells: number;
}

/**
 * Compare a submitted grid to the solution.
 *
 * Because the puzzle has a unique solution, "matches the solution" and "is a valid
 * Sudoku" are the same statement — so a single cell-by-cell compare is a complete and
 * correct check, with no need to re-derive constraints.
 */
export function validateSubmission(submitted: Grid, solution: Grid): ValidationResult {
  const wrongCells: number[] = [];
  let emptyCells = 0;

  for (let i = 0; i < CELLS; i += 1) {
    const value = submitted[i] ?? 0;
    if (value === 0) {
      emptyCells += 1;
    } else if (value !== solution[i]) {
      wrongCells.push(i);
    }
  }

  return {
    isComplete: emptyCells === 0,
    isCorrect: emptyCells === 0 && wrongCells.length === 0,
    wrongCells,
    emptyCells,
  };
}

/** Cheap structural sanity check on a client-submitted grid before trusting its shape. */
export function isWellFormedGrid(grid: unknown): grid is Grid {
  return (
    Array.isArray(grid) &&
    grid.length === CELLS &&
    grid.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9)
  );
}
