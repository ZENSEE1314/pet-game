import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { updateProfileSchema } from '@/lib/validation';
import { getFullProfile, updateProfile } from '@/services/user/user.service';
import { getLevelProgress, unlocksForLevel, nextUnlock } from '@/services/level/level.service';
import { countUnlocked } from '@/services/achievement/achievement.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();

    const [profile, level, achievements] = await Promise.all([
      getFullProfile(user.id),
      getLevelProgress(user.id),
      countUnlocked(user.id),
    ]);

    return ok({
      ...profile,
      permissions: user.permissions,
      levelProgress: level,
      unlocks: unlocksForLevel(level.level),
      nextUnlock: nextUnlock(level.level),
      achievementsUnlocked: achievements,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await request.json());

    // Note what cannot be patched here: role, status, level, xp, balances. Those are
    // absent from the schema, so even a hand-crafted request cannot reach them.
    const profile = await updateProfile(user.id, {
      ...input,
      avatarUrl: input.avatarUrl === '' ? null : input.avatarUrl,
    });

    return ok({ profile });
  });
}
