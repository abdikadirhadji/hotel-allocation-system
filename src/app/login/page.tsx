import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const [session, adminCount] = await Promise.all([
    auth(),
    prisma.adminUser.count(),
  ]);

  if (session?.user?.id && session.user.isActive) {
    redirect("/");
  }

  if (adminCount === 0) {
    redirect("/setup/admin");
  }

  return <LoginForm />;
}
