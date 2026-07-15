import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { startSudokuSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { startSudoku, getActiveSudoku, getSudokuStats } from '@/services/game/sudoku.service';

/** GET /api/games/sudoku — stats + any in-progress puzzle to resume. */
export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const [stats, active] = await Promise.all([
      getSudokuStats(user.id),
      getActiveSudoku(user.id),
    ]);
    return ok({ stats, active });
  });
}

/**
 * POST /api/games/sudoku — issue a new puzzle.
 *
 * Energy and the daily attempt are spent here, at issue time, so every puzzle costs
 * something whether or not it gets solved. The response never includes the solution.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('gameStart', user.id);

    const { difficulty } = startSudokuSchema.parse(await request.json());
    const result = await startSudoku(user.id, difficulty);

    return ok(result);
  });
}
