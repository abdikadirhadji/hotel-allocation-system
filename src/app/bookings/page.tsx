import { prisma } from "@/lib/prisma";
import { getFlashMessage } from "@/lib/flash";
import { getBookingStateLabel } from "@/lib/labels";
import { getNextBookingNumber } from "@/lib/numbering";
import { getRemainingBadgeClass, getRemainingLabel } from "@/lib/status";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
    q?: string;
    state?: string;
    page?: string;
    edit?: string;
  }>;
};

async function createBooking(formData: FormData) {
  "use server";
  const bookingNo = String(formData.get("bookingNo") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const hotelId = String(formData.get("hotelId") ?? "");
  const agreementId = String(formData.get("agreementId") ?? "");
  const state = String(formData.get("state") ?? "CONFIRMED");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const rooms = Number(formData.get("rooms") ?? 0);
  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");

  if (!bookingNo || !clientId || !hotelId || !checkInDate || !checkOutDate || rooms <= 0) {
    redirect("/bookings?type=error&message=booking_required");
  }
  if (new Date(checkInDate) > new Date(checkOutDate)) {
    redirect("/bookings?type=error&message=booking_bad_dates");
  }

  const contract = agreementId
    ? await prisma.agreement.findUnique({ where: { id: agreementId } })
    : await prisma.agreement.findFirst({
        where: {
          clientId,
          hotelId,
          startDate: { lte: new Date(checkInDate) },
          endDate: { gte: new Date(checkOutDate) },
          status: "ACTIVE",
        },
        orderBy: { createdAt: "desc" },
      });

  if (!contract) {
    redirect("/bookings?type=error&message=booking_create_failed");
  }

  if (contract) {
    const agreementBookings = await prisma.booking.findMany({
      where: {
        agreementId: contract.id,
        state: { not: "CANCELLED" },
      },
    });
    const alreadyBooked = agreementBookings.reduce((sum, b) => sum + b.rooms, 0);
    const futureTotal = alreadyBooked + rooms;
    if (!contract.allowOverbooking && futureTotal > contract.totalRooms) {
      redirect("/bookings?type=error&message=booking_over_limit");
    }
  }

  try {
    await prisma.booking.create({
      data: {
        bookingNo,
        clientId,
        hotelId,
        agreementId: contract.id,
        state: state as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED",
        companyName: companyName || null,
        rooms,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
      },
    });
  } catch {
    redirect("/bookings?type=error&message=booking_create_failed");
  }
  revalidatePath("/bookings");
  revalidatePath("/");
  redirect("/bookings?type=success&message=booking_created");
}

async function deleteBooking(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/bookings?type=error&message=booking_delete_failed");
  try {
    await prisma.booking.delete({ where: { id } });
  } catch {
    redirect("/bookings?type=error&message=booking_delete_failed");
  }
  revalidatePath("/bookings");
  revalidatePath("/");
  redirect("/bookings?type=success&message=booking_deleted");
}

async function updateBooking(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const bookingNo = String(formData.get("bookingNo") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const hotelId = String(formData.get("hotelId") ?? "");
  const agreementId = String(formData.get("agreementId") ?? "");
  const state = String(formData.get("state") ?? "CONFIRMED");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const rooms = Number(formData.get("rooms") ?? 0);
  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");

  if (!id || !bookingNo || !clientId || !hotelId || !checkInDate || !checkOutDate || rooms <= 0) {
    redirect("/bookings?type=error&message=booking_update_failed");
  }
  if (new Date(checkInDate) > new Date(checkOutDate)) {
    redirect("/bookings?type=error&message=booking_update_failed");
  }

  const contract = agreementId
    ? await prisma.agreement.findUnique({ where: { id: agreementId } })
    : await prisma.agreement.findFirst({
        where: {
          clientId,
          hotelId,
          startDate: { lte: new Date(checkInDate) },
          endDate: { gte: new Date(checkOutDate) },
          status: "ACTIVE",
        },
        orderBy: { createdAt: "desc" },
      });

  if (!contract) {
    redirect("/bookings?type=error&message=booking_update_failed");
  }

  const agreementBookings = await prisma.booking.findMany({
    where: {
      agreementId: contract.id,
      state: { not: "CANCELLED" },
      id: { not: id },
    },
  });
  const alreadyBooked = agreementBookings.reduce((sum, booking) => sum + booking.rooms, 0);
  if (!contract.allowOverbooking && alreadyBooked + rooms > contract.totalRooms) {
    redirect("/bookings?type=error&message=booking_over_limit");
  }

  try {
    await prisma.booking.update({
      where: { id },
      data: {
        bookingNo,
        clientId,
        hotelId,
        agreementId: contract.id,
        state: state as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED",
        companyName: companyName || null,
        rooms,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
      },
    });
  } catch {
    redirect("/bookings?type=error&message=booking_update_failed");
  }

  revalidatePath("/bookings");
  revalidatePath("/");
  redirect("/bookings?type=success&message=booking_updated");
}

async function cancelBooking(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/bookings?type=error&message=booking_update_failed");

  try {
    await prisma.booking.update({
      where: { id },
      data: { state: "CANCELLED" },
    });
  } catch {
    redirect("/bookings?type=error&message=booking_update_failed");
  }

  revalidatePath("/bookings");
  revalidatePath("/");
  redirect("/bookings?type=success&message=booking_cancelled");
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const stateFilter = params?.state?.trim() ?? "";
  const page = Math.max(1, Number(params?.page ?? "1") || 1);
  const editId = params?.edit ?? "";
  const pageSize = 10;
  const filter = {
    ...(stateFilter
      ? { state: stateFilter as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" }
      : {}),
    ...(query
      ? {
          OR: [
            { bookingNo: { contains: query, mode: "insensitive" as const } },
            { companyName: { contains: query, mode: "insensitive" as const } },
            { client: { name: { contains: query, mode: "insensitive" as const } } },
            { hotel: { name: { contains: query, mode: "insensitive" as const } } },
            { agreement: { contractNo: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [bookings, totalBookings, clients, hotels, agreements, nextBookingNo, allBookings] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      include: { client: true, hotel: true, agreement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.booking.count({ where: filter }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.hotel.findMany({ orderBy: { name: "asc" } }),
    prisma.agreement.findMany({ orderBy: { createdAt: "desc" } }),
    getNextBookingNumber(),
    prisma.booking.findMany({
      where: { state: { not: "CANCELLED" } },
      include: { agreement: true },
    }),
  ]);

  const totalContracted = agreements.reduce((sum, a) => sum + a.totalRooms, 0);
  const totalBooked = bookings.filter((b) => b.state !== "CANCELLED").reduce((sum, b) => sum + b.rooms, 0);
  const totalRemaining = totalContracted - totalBooked;
  const occupancy = totalContracted > 0 ? Math.round((totalBooked / totalContracted) * 100) : 0;
  const lastDate = bookings.length > 0 ? bookings[0].checkOutDate.toISOString().slice(0, 10) : "-";
  const riskCount = agreements.filter((agreement) => {
    const reserved = allBookings
      .filter((booking) => booking.agreementId === agreement.id && booking.state !== "CANCELLED")
      .reduce((sum, booking) => sum + booking.rooms, 0);
    return agreement.totalRooms - reserved <= 5;
  }).length;
  const agreementRemaining = new Map(
    agreements.map((agreement) => {
      const reserved = allBookings
        .filter((booking) => booking.agreementId === agreement.id && booking.state !== "CANCELLED")
        .reduce((sum, booking) => sum + booking.rooms, 0);
      return [agreement.id, agreement.totalRooms - reserved] as const;
    }),
  );
  const totalPages = Math.max(1, Math.ceil(totalBookings / pageSize));
  const createPageLink = (nextPage: number, nextEditId?: string) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (stateFilter) search.set("state", stateFilter);
    if (nextPage > 1) search.set("page", String(nextPage));
    if (nextEditId) search.set("edit", nextEditId);
    const searchString = search.toString();
    return searchString ? `/bookings?${searchString}` : "/bookings";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title">الحجوزات</h2>
        <a
          href="/api/bookings/export"
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
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div className="metric-card"><strong>إجمالي تخصيص الفترات:</strong> {totalContracted}</div>
        <div className="metric-card"><strong>إجمالي المحجوز من الفترات:</strong> {totalBooked}</div>
        <div className="metric-card"><strong>المتبقي من الفترات:</strong> {totalRemaining}</div>
        <div className="metric-card"><strong>نسبة استهلاك التخصيص:</strong> {occupancy}%</div>
        <div className="metric-card"><strong>اتفاقيات حرجة/متجاوزة:</strong> {riskCount}</div>
        <div className="metric-card md:col-span-5"><strong>آخر تاريخ خروج:</strong> {lastDate}</div>
      </div>
      <form className="card grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="بحث برقم الحجز أو العميل أو الشركة أو الفندق"
          className="field md:col-span-2"
        />
        <select name="state" defaultValue={stateFilter} className="field">
          <option value="">كل الحالات</option>
          <option value="CONFIRMED">مؤكد</option>
          <option value="CHECKED_IN">تم الدخول</option>
          <option value="CHECKED_OUT">تم الخروج</option>
          <option value="CANCELLED">ملغي</option>
        </select>
        <button className="btn-secondary">تصفية</button>
      </form>
      <form action={createBooking} className="card grid grid-cols-1 gap-2 md:grid-cols-8">
        <input
          name="bookingNo"
          placeholder="رقم الحجز"
          defaultValue={nextBookingNo}
          className="field"
          required
        />
        <input name="companyName" placeholder="اسم الشركة (اختياري)" className="field" />
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
        <select name="agreementId" className="field">
          <option value="">اتفاقية (اختياري)</option>
          {agreements.map((a) => (
            <option key={a.id} value={a.id}>{a.contractNo}</option>
          ))}
        </select>
        <select name="state" className="field" required>
          <option value="CONFIRMED">مؤكد</option>
          <option value="CHECKED_IN">تم الدخول</option>
          <option value="CHECKED_OUT">تم الخروج</option>
          <option value="CANCELLED">ملغي</option>
        </select>
        <input type="number" name="rooms" placeholder="عدد الغرف المطلوبة من الفترة" className="field" min={1} required />
        <input type="date" name="checkInDate" className="field" required />
        <input type="date" name="checkOutDate" className="field" required />
        <button className="btn-primary md:col-span-2">إضافة حجز جديد</button>
      </form>

      <div className="card overflow-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th>SN</th>
            <th>State</th>
            <th>رقم الحجز</th>
            <th>رقم الاتفاقية</th>
            <th>اسم الشركة</th>
            <th>العميل</th>
            <th>الفندق</th>
            <th>تاريخ الدخول</th>
            <th>تاريخ الخروج</th>
            <th>عدد الغرف</th>
            <th>حالة الاتفاقية</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={13}>لا توجد حجوزات مطابقة للبحث الحالي</td>
            </tr>
          ) : (
            bookings.map((b) => {
              const remaining = b.agreementId ? agreementRemaining.get(b.agreementId) ?? 0 : 0;
              const isEditing = editId === b.id;

              return [
                <tr key={b.id}>
                    <td>{b.sn}</td>
                    <td>{getBookingStateLabel(b.state)}</td>
                    <td>{b.bookingNo}</td>
                    <td>{b.agreement?.contractNo ?? "-"}</td>
                    <td>{b.companyName ?? b.client.name}</td>
                    <td>{b.client.name}</td>
                    <td>{b.hotel.name}</td>
                    <td>{b.checkInDate.toISOString().slice(0, 10)}</td>
                    <td>{b.checkOutDate.toISOString().slice(0, 10)}</td>
                    <td>{b.rooms}</td>
                    <td>
                      <span className={getRemainingBadgeClass(remaining)}>
                        {getRemainingLabel(remaining)}
                      </span>
                    </td>
                    <td>{b.createdAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <div className="flex flex-wrap justify-center gap-2">
                        <a href={isEditing ? createPageLink(page) : createPageLink(page, b.id)} className="btn-secondary">
                          {isEditing ? "إغلاق التعديل" : "تعديل"}
                        </a>
                        <form action={cancelBooking}>
                          <input type="hidden" name="id" value={b.id} />
                          <button className="btn-warning">إلغاء</button>
                        </form>
                        <form action={deleteBooking}>
                          <input type="hidden" name="id" value={b.id} />
                          <button className="btn-danger">حذف</button>
                        </form>
                      </div>
                    </td>
                </tr>,
                isEditing ? (
                  <tr key={`${b.id}-edit`}>
                    <td colSpan={13}>
                      <form action={updateBooking} className="grid grid-cols-1 gap-2 p-2 md:grid-cols-8">
                        <input type="hidden" name="id" value={b.id} />
                        <input name="bookingNo" defaultValue={b.bookingNo} className="field" required />
                        <input name="companyName" defaultValue={b.companyName ?? ""} className="field" />
                        <select name="clientId" defaultValue={b.clientId} className="field" required>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        <select name="hotelId" defaultValue={b.hotelId} className="field" required>
                          {hotels.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </option>
                          ))}
                        </select>
                        <select name="agreementId" defaultValue={b.agreementId ?? ""} className="field">
                          <option value="">اختيار تلقائي</option>
                          {agreements.map((agreement) => (
                            <option key={agreement.id} value={agreement.id}>
                              {agreement.contractNo}
                            </option>
                          ))}
                        </select>
                        <select name="state" defaultValue={b.state} className="field" required>
                          <option value="CONFIRMED">مؤكد</option>
                          <option value="CHECKED_IN">تم الدخول</option>
                          <option value="CHECKED_OUT">تم الخروج</option>
                          <option value="CANCELLED">ملغي</option>
                        </select>
                        <input type="number" name="rooms" defaultValue={b.rooms} className="field" min={1} required />
                        <input type="date" name="checkInDate" defaultValue={b.checkInDate.toISOString().slice(0, 10)} className="field" required />
                        <input type="date" name="checkOutDate" defaultValue={b.checkOutDate.toISOString().slice(0, 10)} className="field" required />
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
          الصفحة {page} من {totalPages} - عدد النتائج: {totalBookings}
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
