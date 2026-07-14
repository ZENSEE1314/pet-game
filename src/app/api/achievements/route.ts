import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { listAchievements } from '@/services/achievement/achievement.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const achievements = await listAchievements(user.id);

    return ok({
      achievements,
      unlockedCount: achievements.filter((a) => a.isUnlocked).length,
      total: achievements.length,
    });
  });
}
