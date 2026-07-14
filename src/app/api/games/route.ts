import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getGameLobby } from '@/services/game/game.service';

/** GET /api/games — lobby: games, energy, attempts, high scores. */
export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const lobby = await getGameLobby(user.id);
    return ok(lobby);
  });
}
