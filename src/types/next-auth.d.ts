import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "SUPER_ADMIN" | "ADMIN";
      isActive: boolean;
    };
  }

  interface User {
    role: "SUPER_ADMIN" | "ADMIN";
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "SUPER_ADMIN" | "ADMIN";
    isActive?: boolean;
  }
}
