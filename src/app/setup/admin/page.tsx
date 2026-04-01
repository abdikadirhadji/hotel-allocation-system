import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { hashPassword, isStrongPassword } from "@/lib/password";

async function createBootstrapAdmin(formData: FormData) {
  "use server";

  const existingAdmins = await prisma.adminUser.count();
  if (existingAdmins > 0) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !isStrongPassword(password)) {
    redirect("/setup/admin?error=invalid_bootstrap_data");
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
  } catch {
    redirect("/setup/admin?error=bootstrap_failed");
  }

  revalidatePath("/login");
  redirect("/login");
}

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SetupAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const adminCount = await prisma.adminUser.count();

  if (adminCount > 0) {
    redirect("/login");
  }

  return (
    <form action={createBootstrapAdmin} className="card mx-auto max-w-xl space-y-4">
      <div className="text-center">
        <h1 className="page-title">تهيئة أول مشرف</h1>
        <p className="mt-2 text-sm text-slate-500">
          هذه الخطوة تظهر مرة واحدة فقط لإنشاء المشرف العام الأول للنظام
        </p>
      </div>

      {params?.error ? (
        <div className="alert-error">
          تعذر إنشاء المشرف الأول. تأكد من صحة البريد الإلكتروني وأن كلمة المرور لا تقل عن 8 أحرف.
        </div>
      ) : null}

      <input name="name" placeholder="اسم المشرف" className="field" required />
      <input type="email" name="email" placeholder="البريد الإلكتروني" className="field" required />
      <input type="password" name="password" placeholder="كلمة المرور" className="field" required />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        سيتم إنشاء هذا الحساب كـ مشرف عام ويمكنه لاحقا إضافة أو تعطيل أي مشرف آخر.
      </div>

      <button className="btn-primary w-full">إنشاء المشرف العام الأول</button>
    </form>
  );
}
