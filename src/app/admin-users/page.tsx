import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { hashPassword, isStrongPassword } from "@/lib/password";
import { requireSuperAdmin } from "@/lib/auth-guard";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
  }>;
};

async function createAdmin(formData: FormData) {
  "use server";

  await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ADMIN");

  if (!name || !email || !isStrongPassword(password)) {
    redirect("/admin-users?type=error&message=admin_create_failed");
  }

  try {
    await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
        isActive: true,
      },
    });
  } catch {
    redirect("/admin-users?type=error&message=admin_create_failed");
  }

  revalidatePath("/admin-users");
  redirect("/admin-users?type=success&message=admin_created");
}

async function toggleAdminStatus(formData: FormData) {
  "use server";

  const session = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id || session.user.id === id) {
    redirect("/admin-users?type=error&message=admin_update_failed");
  }

  try {
    await prisma.adminUser.update({
      where: { id },
      data: { isActive: !isActive },
    });
  } catch {
    redirect("/admin-users?type=error&message=admin_update_failed");
  }

  revalidatePath("/admin-users");
  redirect("/admin-users?type=success&message=admin_updated");
}

async function resetAdminPassword(formData: FormData) {
  "use server";

  await requireSuperAdmin();

  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!id || !isStrongPassword(newPassword)) {
    redirect("/admin-users?type=error&message=admin_update_failed");
  }

  try {
    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  } catch {
    redirect("/admin-users?type=error&message=admin_update_failed");
  }

  revalidatePath("/admin-users");
  redirect("/admin-users?type=success&message=admin_password_reset");
}

function getMessage(message?: string) {
  switch (message) {
    case "admin_created":
      return "تم إنشاء المشرف بنجاح";
    case "admin_updated":
      return "تم تحديث حالة المشرف بنجاح";
    case "admin_password_reset":
      return "تم تغيير كلمة المرور بنجاح";
    case "admin_create_failed":
      return "تعذر إنشاء المشرف. تحقق من البيانات وقد يكون البريد مستخدما";
    case "admin_update_failed":
      return "تعذر تنفيذ العملية على المشرف";
    default:
      return "";
  }
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireSuperAdmin();
  const params = await searchParams;
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title">إدارة المشرفين</h2>
        <div className="dashboard-chip">الحساب الحالي: {session.user.name}</div>
      </div>

      {params?.message ? (
        <div className={params.type === "error" ? "alert-error" : "alert-success"}>
          {getMessage(params.message)}
        </div>
      ) : null}

      <form action={createAdmin} className="card grid grid-cols-1 gap-2 md:grid-cols-4">
        <input name="name" placeholder="اسم المشرف" className="field" required />
        <input type="email" name="email" placeholder="البريد الإلكتروني" className="field" required />
        <input type="password" name="password" placeholder="كلمة المرور" className="field" required />
        <select name="role" className="field">
          <option value="ADMIN">مشرف</option>
          <option value="SUPER_ADMIN">مشرف عام</option>
        </select>
        <button className="btn-primary md:col-span-4">إضافة مشرف جديد</button>
      </form>

      <div className="card overflow-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>آخر دخول</th>
              <th>تاريخ الإنشاء</th>
              <th>إدارة الحساب</th>
              <th>إعادة ضبط كلمة المرور</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>{admin.role === "SUPER_ADMIN" ? "مشرف عام" : "مشرف"}</td>
                <td>
                  <span className={admin.isActive ? "badge-success" : "badge-danger"}>
                    {admin.isActive ? "نشط" : "معطل"}
                  </span>
                </td>
                <td>{admin.lastLoginAt ? admin.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
                <td>{admin.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  <form action={toggleAdminStatus} className="flex justify-center">
                    <input type="hidden" name="id" value={admin.id} />
                    <input type="hidden" name="isActive" value={String(admin.isActive)} />
                    <button
                      className={admin.isActive ? "btn-warning" : "btn-secondary"}
                      disabled={session.user.id === admin.id}
                    >
                      {admin.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                  </form>
                </td>
                <td>
                  <form action={resetAdminPassword} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={admin.id} />
                    <input
                      type="password"
                      name="newPassword"
                      placeholder="كلمة مرور جديدة"
                      className="field h-9"
                      required
                    />
                    <button className="btn-secondary">تحديث كلمة المرور</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
