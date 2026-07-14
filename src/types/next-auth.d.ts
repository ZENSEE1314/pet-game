import type { Role, AccountStatus } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: AccountStatus;
    } & DefaultSession['user'];
  }

  interface User {
    role?: Role;
    status?: AccountStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
  }
}

export {};
