import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth-guard";
import { getFlashMessage } from "@/lib/flash";
import { hashPassword, isStrongPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

async function changeOwnPassword(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isStrongPassword(newPassword) || newPassword !== confirmPassword) {
    redirect("/account?type=error&message=password_change_failed");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
  });

  if (!admin) {
    redirect("/account?type=error&message=password_change_failed");
  }

  const validCurrentPassword = await verifyPassword(currentPassword, admin.passwordHash);
  if (!validCurrentPassword) {
    redirect("/account?type=error&message=password_change_failed");
  }

  await prisma.adminUser.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  revalidatePath("/account");
  redirect("/account?type=success&message=password_changed");
}

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
  }>;
};

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await requireAdminSession();
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">حسابي</h2>
        <p className="mt-2 text-sm text-slate-500">
          يمكنك من هنا تغيير كلمة المرور الخاصة بحسابك الحالي.
        </p>
      </div>

      {params?.message ? (
        <div className={params.type === "error" ? "alert-error" : "alert-success"}>
          {getFlashMessage(params.message)}
        </div>
      ) : null}

      <div className="card space-y-2 text-sm">
        <div><strong>الاسم:</strong> {session.user.name}</div>
        <div><strong>البريد الإلكتروني:</strong> {session.user.email}</div>
        <div><strong>الدور:</strong> {session.user.role === "SUPER_ADMIN" ? "مشرف عام" : "مشرف"}</div>
      </div>

      <form action={changeOwnPassword} className="card mx-auto max-w-xl space-y-3">
        <input
          type="password"
          name="currentPassword"
          placeholder="كلمة المرور الحالية"
          className="field"
          required
        />
        <input
          type="password"
          name="newPassword"
          placeholder="كلمة المرور الجديدة"
          className="field"
          required
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="تأكيد كلمة المرور الجديدة"
          className="field"
          required
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل.
        </div>
        <button className="btn-primary w-full">تحديث كلمة المرور</button>
      </form>
    </div>
  );
}
