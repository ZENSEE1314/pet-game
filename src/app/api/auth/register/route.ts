import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { registerUser } from '@/services/user/user.service';
import { isDevelopment } from '@/lib/env';

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const ip = clientIp(request);
    await enforceRateLimit('register', ip);

    const body = await request.json();
    const input = registerSchema.parse(body);

    const result = await registerUser({
      email: input.email,
      password: input.password,
      username: input.username,
      displayName: input.displayName,
      phone: input.phone || undefined,
      country: input.country || undefined,
      timezone: input.timezone,
      referralCode: input.referralCode || undefined,
      ip,
    });

    // Email delivery is stubbed in the MVP: the token goes to the server log so a
    // developer can complete the flow locally. It is returned in the response body
    // ONLY in development — shipping it to a production client would let anyone
    // verify anyone else's address.
    console.info(
      `[auth] verification link for ${result.email}: /verify-email?token=${result.verificationToken}`,
    );

    return ok({
      userId: result.userId,
      email: result.email,
      message: 'Account created. Check your email to verify your address.',
      ...(isDevelopment ? { devVerificationToken: result.verificationToken } : {}),
    });
  });
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}
