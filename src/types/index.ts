import type { Role } from "@prisma/client";

export type UserRole = Role;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string | null;
  profileSections?: string[] | null;
  authMethod?: "password" | "demo";
}

export type ApiResponse<T> = { data: T } | { error: string };

// Augment next-auth types globally
declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
  interface User {
    role: UserRole;
    authMethod?: "password" | "demo";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    id: string;
    authMethod?: "password" | "demo";
  }
}
