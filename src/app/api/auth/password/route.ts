import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requestPasswordReset, resetPassword } from '@/services/user/user.service';
import { isDevelopment } from '@/lib/env';

/** POST — request a reset link. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    await enforceRateLimit('passwordReset', ip);

    const { email } = forgotPasswordSchema.parse(await request.json());
    const token = await requestPasswordReset(email);

    if (token) {
      console.info(`[auth] password reset link for ${email}: /reset-password?token=${token}`);
    }

    // The SAME response whether or not the account exists. Any difference here —
    // a different message, a different status, even a measurably different latency —
    // turns this endpoint into a "does this person have an account?" oracle.
    return ok({
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(isDevelopment && token ? { devResetToken: token } : {}),
    });
  });
}

/** PUT — complete the reset with a token. */
export async function PUT(request: NextRequest) {
  return withApi(async () => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    await enforceRateLimit('passwordReset', ip);

    const input = resetPasswordSchema.parse(await request.json());
    await resetPassword(input.token, input.password);

    return ok({ message: 'Password updated. You can now sign in.' });
  });
}
