import { prisma } from "@/lib/prisma";
import { getFlashMessage } from "@/lib/flash";
import { getAgreementStatusLabel } from "@/lib/labels";
import { getNextAgreementNumber } from "@/lib/numbering";
import { getRemainingBadgeClass, getRemainingLabel } from "@/lib/status";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
    q?: string;
    status?: string;
    page?: string;
    edit?: string;
  }>;
};

async function createContract(formData: FormData) {
  "use server";
  const contractNo = String(formData.get("contractNo") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const hotelId = String(formData.get("hotelId") ?? "");
  const totalRooms = Number(formData.get("totalRooms") ?? 0);
  const availableRoomsRaw = Number(formData.get("availableRooms") ?? 0);
  const status = String(formData.get("status") ?? "ACTIVE");
  const allowOverbooking = String(formData.get("allowOverbooking") ?? "") === "on";
  const notes = String(formData.get("notes") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!contractNo || !clientId || !hotelId || !startDate || !endDate || totalRooms <= 0) {
    redirect("/contracts?type=error&message=contract_required");
  }
  if (new Date(startDate) > new Date(endDate)) {
    redirect("/contracts?type=error&message=contract_bad_dates");
  }
  if (availableRoomsRaw < 0) {
    redirect("/contracts?type=error&message=contract_bad_available");
  }

  try {
    await prisma.agreement.create({
      data: {
        contractNo,
        clientId,
        hotelId,
        totalRooms,
        availableRooms: availableRoomsRaw > 0 ? availableRoomsRaw : null,
        status,
        allowOverbooking,
        notes: notes || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
  } catch {
    redirect("/contracts?type=error&message=contract_create_failed");
  }
  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts?type=success&message=contract_created");
}

async function deleteContract(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/contracts?type=error&message=contract_delete_failed");
  try {
    await prisma.agreement.delete({ where: { id } });
  } catch {
    redirect("/contracts?type=error&message=contract_delete_failed");
  }
  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts?type=success&message=contract_deleted");
}

async function updateContract(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const contractNo = String(formData.get("contractNo") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const hotelId = String(formData.get("hotelId") ?? "");
  const totalRooms = Number(formData.get("totalRooms") ?? 0);
  const availableRoomsRaw = Number(formData.get("availableRooms") ?? 0);
  const status = String(formData.get("status") ?? "ACTIVE");
  const allowOverbooking = String(formData.get("allowOverbooking") ?? "") === "on";
  const notes = String(formData.get("notes") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!id || !contractNo || !clientId || !hotelId || !startDate || !endDate || totalRooms <= 0) {
    redirect("/contracts?type=error&message=contract_update_failed");
  }
  if (new Date(startDate) > new Date(endDate) || availableRoomsRaw < 0) {
    redirect("/contracts?type=error&message=contract_update_failed");
  }

  try {
    await prisma.agreement.update({
      where: { id },
      data: {
        contractNo,
        clientId,
        hotelId,
        totalRooms,
        availableRooms: availableRoomsRaw > 0 ? availableRoomsRaw : null,
        status,
        allowOverbooking,
        notes: notes || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
  } catch {
    redirect("/contracts?type=error&message=contract_update_failed");
  }

  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts?type=success&message=contract_updated");
}

async function cancelContract(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/contracts?type=error&message=contract_update_failed");

  try {
    await prisma.agreement.update({
      where: { id },
      data: { status: "CLOSED" },
    });
  } catch {
    redirect("/contracts?type=error&message=contract_update_failed");
  }

  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts?type=success&message=contract_cancelled");
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const statusFilter = params?.status?.trim() ?? "";
  const page = Math.max(1, Number(params?.page ?? "1") || 1);
  const editId = params?.edit ?? "";
  const pageSize = 10;
  const filter = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { contractNo: { contains: query, mode: "insensitive" as const } },
            { client: { name: { contains: query, mode: "insensitive" as const } } },
            { hotel: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [contracts, totalContracts, clients, hotels, bookings, nextContractNo] = await Promise.all([
    prisma.agreement.findMany({
      where: filter,
      include: { client: true, hotel: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.agreement.count({ where: filter }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.hotel.findMany({ orderBy: { name: "asc" } }),
    prisma.booking.findMany(),
    getNextAgreementNumber(),
  ]);

  const contractStats = contracts.map((a) => {
    const reserved = bookings
      .filter((b) => b.agreementId === a.id && b.state !== "CANCELLED")
      .reduce((sum, b) => sum + b.rooms, 0);
    const remaining = a.totalRooms - reserved;
    const periodDays = Math.max(
      1,
      Math.ceil((a.endDate.getTime() - a.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    return { id: a.id, reserved, remaining, periodDays };
  });
  const totalPages = Math.max(1, Math.ceil(totalContracts / pageSize));
  const createPageLink = (nextPage: number, nextEditId?: string) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (statusFilter) search.set("status", statusFilter);
    if (nextPage > 1) search.set("page", String(nextPage));
    if (nextEditId) search.set("edit", nextEditId);
    const searchString = search.toString();
    return searchString ? `/contracts?${searchString}` : "/contracts";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title">الاتفاقيات</h2>
        <a
          href="/api/contracts/export"
          className="btn-secondary"
        >
          تصدير إلى Excel
        </a>
      </div>
      {params?.message ? (
        <div className={params.type === "error" ? "alert-error" : "alert-success"}>
          {getFlashMessage(params.message)}
        </div>
      ) : null}
      <form className="card grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="بحث برقم الاتفاقية أو العميل أو الفندق"
          className="field md:col-span-2"
        />
        <select name="status" defaultValue={statusFilter} className="field">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="PAUSED">موقوف</option>
          <option value="CLOSED">مغلق</option>
        </select>
        <button className="btn-secondary">تصفية</button>
      </form>
      <form action={createContract} className="card grid grid-cols-1 gap-2 md:grid-cols-8">
        <input
          name="contractNo"
          placeholder="رقم الاتفاقية"
          defaultValue={nextContractNo}
          className="field"
          required
        />
        <select name="clientId" className="field" required>
          <option value="">اختر العميل</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="hotelId" className="field" required>
          <option value="">اختر الفندق</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <input type="number" name="totalRooms" placeholder="إجمالي تخصيص الفترة" className="field" min={1} required />
        <input type="number" name="availableRooms" placeholder="المتاح عند البداية (اختياري)" className="field" />
        <select name="status" className="field">
          <option value="ACTIVE">نشط</option>
          <option value="PAUSED">موقوف</option>
          <option value="CLOSED">مغلق</option>
        </select>
        <input type="date" name="startDate" className="field" required />
        <input type="date" name="endDate" className="field" required />
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
          <input type="checkbox" name="allowOverbooking" />
          السماح بالتجاوز
        </label>
        <input name="notes" placeholder="ملاحظات (اختياري)" className="field md:col-span-3" />
        <button className="btn-primary md:col-span-2">إضافة اتفاقية جديدة</button>
      </form>
      <div className="card overflow-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th>رقم الاتفاقية</th>
            <th>العميل</th>
            <th>الفندق</th>
            <th>حالة الاتفاقية</th>
            <th>إجمالي تخصيص الفترة</th>
            <th>المتاح عند البداية</th>
            <th>المحجوز من الفترة</th>
            <th>المتبقي من الفترة</th>
            <th>مؤشر الحالة</th>
            <th>السماح بالتجاوز</th>
            <th>فترة الاتفاقية</th>
            <th>بداية الاتفاقية</th>
            <th>نهاية الاتفاقية</th>
            <th>ملاحظات</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 ? (
            <tr>
              <td colSpan={16}>لا توجد اتفاقيات مطابقة للبحث الحالي</td>
            </tr>
          ) : (
            contracts.map((a) => {
              const stats = contractStats.find((s) => s.id === a.id);
              const isEditing = editId === a.id;

              return [
                <tr key={a.id}>
                    <td>{a.contractNo}</td>
                    <td>{a.client.name}</td>
                    <td>{a.hotel.name}</td>
                    <td>{getAgreementStatusLabel(a.status)}</td>
                    <td>{a.totalRooms}</td>
                    <td>{a.availableRooms ?? "-"}</td>
                    <td>{stats?.reserved ?? 0}</td>
                    <td>{stats?.remaining ?? 0}</td>
                    <td>
                      <span className={getRemainingBadgeClass(stats?.remaining ?? 0)}>
                        {getRemainingLabel(stats?.remaining ?? 0)}
                      </span>
                    </td>
                    <td>{a.allowOverbooking ? "نعم" : "لا"}</td>
                    <td>{stats?.periodDays ?? 0} يوم</td>
                    <td>{a.startDate.toISOString().slice(0, 10)}</td>
                    <td>{a.endDate.toISOString().slice(0, 10)}</td>
                    <td>{a.notes ?? "-"}</td>
                    <td>{a.createdAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <div className="flex flex-wrap justify-center gap-2">
                        <a href={isEditing ? createPageLink(page) : createPageLink(page, a.id)} className="btn-secondary">
                          {isEditing ? "إغلاق التعديل" : "تعديل"}
                        </a>
                        <form action={cancelContract}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn-warning">إغلاق</button>
                        </form>
                        <form action={deleteContract}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn-danger">حذف</button>
                        </form>
                      </div>
                    </td>
                </tr>,
                isEditing ? (
                  <tr key={`${a.id}-edit`}>
                    <td colSpan={16}>
                      <form action={updateContract} className="grid grid-cols-1 gap-2 p-2 md:grid-cols-8">
                        <input type="hidden" name="id" value={a.id} />
                        <input name="contractNo" defaultValue={a.contractNo} className="field" required />
                        <select name="clientId" defaultValue={a.clientId} className="field" required>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        <select name="hotelId" defaultValue={a.hotelId} className="field" required>
                          {hotels.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </option>
                          ))}
                        </select>
                        <input type="number" name="totalRooms" defaultValue={a.totalRooms} className="field" min={1} required />
                        <input
                          type="number"
                          name="availableRooms"
                          defaultValue={a.availableRooms ?? ""}
                          className="field"
                          min={0}
                        />
                        <select name="status" defaultValue={a.status} className="field">
                          <option value="ACTIVE">نشط</option>
                          <option value="PAUSED">موقوف</option>
                          <option value="CLOSED">مغلق</option>
                        </select>
                        <input type="date" name="startDate" defaultValue={a.startDate.toISOString().slice(0, 10)} className="field" required />
                        <input type="date" name="endDate" defaultValue={a.endDate.toISOString().slice(0, 10)} className="field" required />
                        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
                          <input type="checkbox" name="allowOverbooking" defaultChecked={a.allowOverbooking} />
                          السماح بالتجاوز
                        </label>
                        <input name="notes" defaultValue={a.notes ?? ""} className="field md:col-span-5" />
                        <button className="btn-primary md:col-span-2">حفظ التعديلات</button>
                      </form>
                    </td>
                  </tr>
                ) : null,
              ];
            })
          )}
        </tbody>
      </table>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          الصفحة {page} من {totalPages} - عدد النتائج: {totalContracts}
        </div>
        <div className="flex gap-2">
          <a
            href={page > 1 ? createPageLink(page - 1) : createPageLink(1)}
            className="btn-secondary"
            aria-disabled={page <= 1}
          >
            الصفحة السابقة
          </a>
          <a
            href={page < totalPages ? createPageLink(page + 1) : createPageLink(totalPages)}
            className="btn-secondary"
            aria-disabled={page >= totalPages}
          >
            الصفحة التالية
          </a>
        </div>
      </div>
    </div>
  );
}
