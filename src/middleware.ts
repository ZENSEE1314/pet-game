import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PLAYER_PREFIXES = [
  '/dashboard',
  '/pet',
  '/inventory',
  '/shop',
  '/games',
  '/collection',
  '/missions',
  '/achievements',
  '/leaderboards',
  '/rewards',
  '/claims',
  '/wallet',
  '/notifications',
  '/profile',
  '/settings',
  '/referrals',
  '/promo',
];

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Edge gate. This is a convenience so an unauthorised user never downloads the
 * page — it is NOT the security boundary. Every route handler and server action
 * independently calls `requireUser()` / `requireRole()`, which re-reads the
 * account status from Postgres. Middleware alone would be trivially bypassed by
 * calling the API directly.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  const isAuthed = Boolean(session?.user);
  const isPlayerRoute = PLAYER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isStaffRoute = pathname.startsWith('/staff');
  const isAdminRoute = pathname.startsWith('/admin');

  if (isAuthed && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  if (!isAuthed && (isPlayerRoute || isStaffRoute || isAdminRoute)) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isStaffRoute && !['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  if (isAdminRoute && !['ADMIN', 'SUPER_ADMIN'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico|manifest.webmanifest|sw.js).*)'],
};
