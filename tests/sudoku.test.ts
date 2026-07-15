import { describe, it, expect } from 'vitest';
import {
  generatePuzzle,
  puzzleFromSeed,
  validateSubmission,
  isWellFormedGrid,
  type Grid,
} from '@/lib/sudoku';

/**
 * The Sudoku engine is what makes the mini-game fair: a puzzle with a unique solution
 * means "matches the solution" and "is valid" are the same statement, so server-side
 * validation can't reject a legitimately-different correct grid (there isn't one).
 */

function isValidSolution(grid: Grid): boolean {
  const groupOk = (indices: number[]) => {
    const values = indices.map((i) => grid[i]);
    return new Set(values).size === 9 && values.every((v) => v! >= 1 && v! <= 9);
  };

  for (let r = 0; r < 9; r += 1) {
    if (!groupOk(Array.from({ length: 9 }, (_, c) => r * 9 + c))) return false;
  }
  for (let c = 0; c < 9; c += 1) {
    if (!groupOk(Array.from({ length: 9 }, (_, r) => r * 9 + c))) return false;
  }
  for (let br = 0; br < 3; br += 1) {
    for (let bc = 0; bc < 3; bc += 1) {
      const cells: number[] = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) cells.push((br * 3 + r) * 9 + (bc * 3 + c));
      }
      if (!groupOk(cells)) return false;
    }
  }
  return true;
}

describe('sudoku generation', () => {
  it('should produce a valid, complete solution', () => {
    const { solution } = generatePuzzle('EASY', 12345);
    expect(isValidSolution(solution)).toBe(true);
  });

  it('should leave more clues on easy than on hard', () => {
    const easyGivens = generatePuzzle('EASY', 7).puzzle.filter((c) => c !== 0).length;
    const hardGivens = generatePuzzle('HARD', 7).puzzle.filter((c) => c !== 0).length;
    expect(easyGivens).toBeGreaterThan(hardGivens);
  });

  it('should keep every given cell consistent with the solution', () => {
    const { puzzle, solution } = generatePuzzle('MEDIUM', 99);
    puzzle.forEach((value, index) => {
      if (value !== 0) expect(value).toBe(solution[index]);
    });
  });

  it('should be deterministic for a given seed', () => {
    const a = puzzleFromSeed('HARD', 4242);
    const b = puzzleFromSeed('HARD', 4242);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });

  it('should produce different puzzles for different seeds', () => {
    const a = generatePuzzle('MEDIUM', 1);
    const b = generatePuzzle('MEDIUM', 2);
    expect(a.puzzle).not.toEqual(b.puzzle);
  });
});

describe('sudoku validation', () => {
  it('should accept the exact solution as correct and complete', () => {
    const { solution } = generatePuzzle('EASY', 55);
    const result = validateSubmission(solution, solution);
    expect(result.isCorrect).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.wrongCells).toHaveLength(0);
  });

  it('should report an incomplete grid as not correct', () => {
    const { puzzle, solution } = generatePuzzle('EASY', 55);
    const result = validateSubmission(puzzle, solution);
    expect(result.isComplete).toBe(false);
    expect(result.isCorrect).toBe(false);
    expect(result.emptyCells).toBeGreaterThan(0);
  });

  it('should flag exactly the cells that contradict the solution', () => {
    const { solution } = generatePuzzle('EASY', 77);
    const submitted = [...solution];
    // Corrupt two cells into deliberately wrong (but non-zero) values.
    submitted[0] = submitted[0] === 1 ? 2 : 1;
    submitted[80] = submitted[80] === 9 ? 8 : 9;

    const result = validateSubmission(submitted, solution);
    expect(result.wrongCells.sort((a, b) => a - b)).toEqual([0, 80]);
    expect(result.isCorrect).toBe(false);
  });

  it('should not count blanks as wrong, only as empty', () => {
    const { solution } = generatePuzzle('EASY', 88);
    const submitted = [...solution];
    submitted[10] = 0;
    const result = validateSubmission(submitted, solution);
    expect(result.wrongCells).toHaveLength(0);
    expect(result.emptyCells).toBe(1);
    expect(result.isCorrect).toBe(false);
  });
});

describe('grid shape guard', () => {
  it('should accept a well-formed 81-cell grid', () => {
    expect(isWellFormedGrid(new Array(81).fill(0))).toBe(true);
  });

  it('should reject wrong lengths and out-of-range values', () => {
    expect(isWellFormedGrid(new Array(80).fill(0))).toBe(false);
    expect(isWellFormedGrid([...new Array(80).fill(0), 10])).toBe(false);
    expect(isWellFormedGrid('not a grid')).toBe(false);
    expect(isWellFormedGrid([...new Array(80).fill(0), -1])).toBe(false);
  });
});
