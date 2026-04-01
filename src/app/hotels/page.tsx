import { ActionConfirmForm } from "@/components/ActionConfirmForm";
import { prisma } from "@/lib/prisma";
import { getFlashMessage } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
  }>;
};

async function createHotel(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name) redirect("/hotels?type=error&message=hotel_name_required");
  try {
    await prisma.hotel.create({ data: { name, city: city || null } });
  } catch {
    redirect("/hotels?type=error&message=hotel_create_failed");
  }
  revalidatePath("/hotels");
  redirect("/hotels?type=success&message=hotel_created");
}

async function deleteHotel(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/hotels?type=error&message=hotel_delete_failed");
  try {
    await prisma.hotel.update({
      where: { id },
      data: { isActive: false },
    });
  } catch {
    redirect("/hotels?type=error&message=hotel_delete_failed");
  }
  revalidatePath("/hotels");
  redirect("/hotels?type=success&message=hotel_deleted");
}

export default async function HotelsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hotels = await prisma.hotel.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <h2 className="page-title">الفنادق</h2>
      {params?.message ? (
        <div className={params.type === "error" ? "alert-error" : "alert-success"}>
          {getFlashMessage(params.message)}
        </div>
      ) : null}
      <form action={createHotel} className="card grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          name="name"
          placeholder="اسم الفندق"
          className="field"
          required
        />
        <input name="city" placeholder="المدينة (اختياري)" className="field" />
        <button className="btn-primary">
          إضافة فندق جديد
        </button>
      </form>
      <div className="card overflow-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th>اسم الفندق</th>
            <th>المدينة</th>
            <th>الحالة</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {hotels.map((hotel) => (
            <tr key={hotel.id}>
              <td>{hotel.name}</td>
              <td>{hotel.city ?? "-"}</td>
              <td>
                <span className={hotel.isActive ? "badge-success" : "badge-warning"}>
                  {hotel.isActive ? "نشط" : "مؤرشف"}
                </span>
              </td>
              <td>{hotel.createdAt.toISOString().slice(0, 10)}</td>
              <td>
                <ActionConfirmForm
                  action={deleteHotel}
                  buttonClassName="btn-danger"
                  buttonLabel="أرشفة"
                  modalTitle="أرشفة الفندق"
                  modalDescription="سيبقى الفندق محفوظا في السجلات السابقة ولكن لن يستخدم في الإدخال الجديد."
                  confirmLabel="تأكيد الأرشفة"
                  hiddenFields={[{ name: "id", value: hotel.id }]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
