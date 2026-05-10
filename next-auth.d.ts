/** NextAuth.js module augmentation — extends Session, User, and JWT with the `role` field. */
import NextAuth, { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
  }
}
