import type { NextRequest } from 'next/server';
import { ok, withApi, AppError } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { adoptPetSchema } from '@/lib/validation';
import {
  getPetForUser,
  petSummary,
  getCooldowns,
  getDailyCareStatus,
  adoptPet,
  getPetActivities,
} from '@/services/pet/pet.service';

/** GET /api/pet — the player's pet, with decay already applied. */
export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const pet = await getPetForUser(user.id);

    if (!pet) return ok({ pet: null, hasPet: false });

    const [dailyCare, activities] = await Promise.all([
      getDailyCareStatus(user.id, pet.id),
      getPetActivities(pet.id, 10),
    ]);

    return ok({
      hasPet: true,
      pet: petSummary(pet),
      cooldowns: getCooldowns(pet),
      dailyCare,
      activities,
    });
  });
}

/** POST /api/pet — adopt the starter pet. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const input = adoptPetSchema.parse(await request.json());

    const pet = await adoptPet(user.id, input.name, input.speciesId);
    return ok({ pet: petSummary(pet), message: `${pet.name} has joined you!` });
  });
}
