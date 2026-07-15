import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { submitSudokuSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { submitSudoku } from '@/services/game/sudoku.service';
import { getBalances } from '@/services/currency/transaction.service';

/**
 * POST /api/games/sudoku/submit — check a solution.
 *
 * The grid is a claim; the server compares it to the solution it alone holds. A wrong
 * submission returns which of the player's own cells conflict (standard Sudoku help),
 * leaves the game active, and awards nothing. A correct one draws a puzzle piece.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('gameSubmit', user.id);

    const input = submitSudokuSchema.parse(await request.json());

    const result = await submitSudoku({
      userId: user.id,
      gameId: input.gameId,
      signature: input.signature,
      grid: input.grid,
    });

    // Balances only move on a solve (piece/hatch rewards); return them so the UI can
    // refresh gem/point pills in the win moment.
    const balances = result.solved ? await getBalances(user.id) : undefined;

    return ok({ ...result, balances });
  });
}
