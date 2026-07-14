import type { NextAuthConfig } from 'next-auth';
import type { Role, AccountStatus } from '@prisma/client';

/**
 * Edge-safe half of the auth config.
 *
 * This file must never import Prisma, bcrypt, or anything with a Node built-in
 * dependency, because `middleware.ts` runs it on the edge runtime. The Node-only
 * pieces (Prisma adapter, credentials provider, password verification) live in
 * `./index.ts`, which spreads this config.
 */
export const authConfig = {
  // JWT rather than DB sessions: no session read per request, and it works on
  // the edge. Suspension is re-checked against the DB in `requireUser()` on every
  // protected request, so a JWT can't outlive a ban.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/verify-email',
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: Role }).role ?? 'PLAYER';
        token.status = (user as { status?: AccountStatus }).status ?? 'ACTIVE';
      }
      // `update()` from the client after a role/profile change refreshes the token
      // without forcing a re-login.
      if (trigger === 'update' && session) {
        const patch = session as { role?: Role; status?: AccountStatus };
        if (patch.role) token.role = patch.role;
        if (patch.status) token.status = patch.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? 'PLAYER';
        session.user.status = (token.status as AccountStatus) ?? 'ACTIVE';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
