import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, withApi } from '@/lib/api';
import { verifyEmail } from '@/services/user/user.service';

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const { token } = schema.parse(await request.json());
    const result = await verifyEmail(token);
    return ok({ email: result.email, message: 'Email verified. Welcome to PetQuest!' });
  });
}
