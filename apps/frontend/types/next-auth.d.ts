// apps/frontend/types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      plan: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    plan: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    plan: string;
  }
}
