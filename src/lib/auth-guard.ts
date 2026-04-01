import { redirect } from "next/navigation";

import { auth } from "@/auth";

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id || !session.user.isActive) {
    redirect("/login");
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAdminSession();

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return session;
}
