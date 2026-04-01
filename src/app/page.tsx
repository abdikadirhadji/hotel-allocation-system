import { getFlashMessage } from "@/lib/flash";
import { getDailyDashboard } from "@/lib/dashboard";
import { getNextAgreementNumber, getNextBookingNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: Promise<{
    clientId?: string;
    from?: string;
    to?: string;
    windowStart?: string;
    message?: string;
    type?: string;
  }>;
};

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("ar", {
    weekday: "short",
  }).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

type DashboardCell = {
  key: string;
  date?: Date;
  allocated?: number;
  active?: number;
  remaining?: number;
  occupancy?: number;
  empty?: boolean;
};

async function seedSampleData() {
  "use server";

  await prisma.booking.deleteMany();
  await prisma.agreement.deleteMany();
  await prisma.client.deleteMany();
  await prisma.hotel.deleteMany();

  const clients = await prisma.client.createManyAndReturn({
    data: [
      { name: "وكالة نور - الجزائر", country: "الجزائر" },
      { name: "شركة نوريس - اسبانيا", country: "اسبانيا" },
    ],
  });

  const hotels = await prisma.hotel.createManyAndReturn({
    data: [
      { name: "MASAR AL-MISK HOTEL", city: "مكة" },
      { name: "SAMA ALMISK HOTEL", city: "مكة" },
    ],
  });

  const agreementOne = await prisma.agreement.create({
    data: {
      contractNo: await getNextAgreementNumber(new Date("2026-03-01")),
      clientId: clients[0].id,
      hotelId: hotels[0].id,
      totalRooms: 55,
      availableRooms: 55,
      status: "ACTIVE",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      notes: "إجمالي 55 غرفة للفترة بالكامل",
    },
  });

  const agreementTwo = await prisma.agreement.create({
    data: {
      contractNo: "AGR-2026-0002",
      clientId: clients[1].id,
      hotelId: hotels[1].id,
      totalRooms: 30,
      availableRooms: 30,
      status: "ACTIVE",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
    },
  });

  await prisma.booking.createMany({
    data: [
      {
        bookingNo: await getNextBookingNumber(new Date("2026-03-05")),
        agreementId: agreementOne.id,
        clientId: clients[0].id,
        hotelId: hotels[0].id,
        companyName: "وكالة نور - الجزائر",
        state: "CONFIRMED",
        rooms: 20,
        checkInDate: new Date("2026-03-31"),
        checkOutDate: new Date("2026-04-06"),
      },
      {
        bookingNo: "BKG-2026-0002",
        agreementId: agreementOne.id,
        clientId: clients[0].id,
        hotelId: hotels[0].id,
        companyName: "وكالة نور - الجزائر",
        state: "CONFIRMED",
        rooms: 15,
        checkInDate: new Date("2026-04-07"),
        checkOutDate: new Date("2026-04-13"),
      },
      {
        bookingNo: "BKG-2026-0003",
        agreementId: agreementTwo.id,
        clientId: clients[1].id,
        hotelId: hotels[1].id,
        companyName: "شركة نوريس - اسبانيا",
        state: "CHECKED_IN",
        rooms: 22,
        checkInDate: new Date("2026-03-03"),
        checkOutDate: new Date("2026-03-08"),
      },
    ],
  });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/hotels");
  revalidatePath("/contracts");
  revalidatePath("/bookings");
  redirect("/?type=success&message=seed_loaded");
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const now = new Date();
  const from = params?.from ? new Date(params.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = params?.to ? new Date(params.to) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
  const totalDaysInRange = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const pageSize = 7;
  const rawWindowStart = Number(params?.windowStart ?? 0);
  const windowStart = Math.min(Math.max(0, rawWindowStart), Math.max(0, totalDaysInRange - pageSize));
  const windowEnd = Math.min(windowStart + pageSize, totalDaysInRange);

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const dashboard = await getDailyDashboard({
    clientId: params?.clientId || undefined,
    from,
    to,
  });
  const totalAllocated = dashboard.reduce((sum, group) => sum + group.periodAllocated, 0);
  const totalBooked = dashboard.reduce((sum, group) => sum + group.periodBooked, 0);
  const totalRemaining = dashboard.reduce((sum, group) => sum + group.periodRemaining, 0);
  const totalOccupancy = totalAllocated > 0 ? Math.round((totalBooked / totalAllocated) * 100) : 0;
  const totalAgreements = dashboard.length;
  const warningDays = dashboard.reduce(
    (sum, group) => sum + (group.periodRemaining <= 5 ? 1 : 0),
    0,
  );
  const overbookedDays = dashboard.reduce(
    (sum, group) => sum + (group.periodRemaining < 0 ? 1 : 0),
    0,
  );
  const buildWindowHref = (nextWindowStart: number) => {
    const search = new URLSearchParams();
    search.set("from", from.toISOString().slice(0, 10));
    search.set("to", to.toISOString().slice(0, 10));
    if (params?.clientId) search.set("clientId", params.clientId);
    if (nextWindowStart > 0) search.set("windowStart", String(nextWindowStart));
    return `/?${search.toString()}`;
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="page-title">لوحة المتابعة اليومية</h2>
          <div className="flex flex-wrap gap-2">
            <form action={seedSampleData}>
              <button className="btn-primary">تحميل بيانات تجريبية</button>
            </form>
            <a
              href={`/api/dashboard/export?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}${params?.clientId ? `&clientId=${params.clientId}` : ""}`}
              className="btn-secondary"
            >
              تصدير إلى Excel
            </a>
          </div>
        </div>
        {params?.message ? (
          <div className={`${params.type === "error" ? "alert-error" : "alert-success"} mb-3`}>
            {getFlashMessage(params.message)}
          </div>
        ) : null}
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            name="clientId"
            defaultValue={params?.clientId ?? ""}
            className="field"
          >
            <option value="">كل العملاء</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="field"
          />
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="field"
          />
          <button className="btn-primary">
            تحديث الجدول
          </button>
        </form>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="metric-card">
            <strong>الفترة المختارة:</strong> {formatFullDate(from)} - {formatFullDate(to)}
          </div>
          <div className="metric-card">
            <strong>عدد الأيام المعروضة:</strong>{" "}
            {windowStart + 1} - {windowEnd} من {totalDaysInRange}
          </div>
          <div className="metric-card">
            <strong>العميل المحدد:</strong> {clients.find((c) => c.id === params?.clientId)?.name ?? "كل العملاء"}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-700">
            نافذة الأيام الحالية: {windowStart + 1} - {windowEnd}
          </div>
          <div className="flex gap-2">
            <a
              href={buildWindowHref(Math.max(0, windowStart - pageSize))}
              className={`btn-secondary ${windowStart === 0 ? "pointer-events-none opacity-50" : ""}`}
            >
              الايام السابقة
            </a>
            <a
              href={buildWindowHref(Math.min(windowStart + pageSize, Math.max(0, totalDaysInRange - pageSize)))}
              className={`btn-secondary ${windowEnd >= totalDaysInRange ? "pointer-events-none opacity-50" : ""}`}
            >
              الايام التالية
            </a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="metric-card"><strong>إجمالي التخصيص للفترة:</strong> {totalAllocated}</div>
          <div className="metric-card"><strong>إجمالي المحجوز من الفترة:</strong> {totalBooked}</div>
          <div className="metric-card"><strong>المتبقي من إجمالي الفترة:</strong> {totalRemaining}</div>
          <div className="metric-card"><strong>نسبة استهلاك التخصيص:</strong> {totalOccupancy}%</div>
          <div className="metric-card"><strong>عدد الاتفاقيات:</strong> {totalAgreements}</div>
          <div className="metric-card"><strong>اتفاقيات حرجة/تجاوز:</strong> {warningDays} / {overbookedDays}</div>
        </div>
      </section>

      {dashboard.map((group) => (
        <section key={group.agreementId} className="card p-0">
          {(() => {
            const visibleRows = group.rows.slice(windowStart, windowEnd);
            const paddedRows: DashboardCell[] = Array.from({ length: pageSize }, (_, index) => {
              const row = visibleRows[index];
              if (!row) {
                return {
                  key: `${group.agreementId}-empty-${index}`,
                  empty: true,
                };
              }
              return {
                key: `${group.agreementId}-${row.date.toISOString()}`,
                date: row.date,
                allocated: row.allocated,
                active: row.active,
                remaining: row.remaining,
                occupancy: row.occupancy,
              };
            });
            const visibleActiveTotal = visibleRows.reduce((sum, row) => sum + row.active, 0);
            const visibleRemainingMin = group.periodRemaining;
            const visibleActiveMax =
              visibleRows.length > 0 ? Math.max(...visibleRows.map((row) => row.active)) : 0;
            return (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
                  <span className="dashboard-chip">العميل: {group.clientName}</span>
                  <span className="dashboard-chip">الفندق: {group.hotelName}</span>
                  <span className="dashboard-chip">رقم الاتفاقية: {group.agreementNo}</span>
                  <span className="dashboard-chip">
                    من {formatFullDate(group.startDate)} إلى {formatFullDate(group.endDate)}
                  </span>
                  <span className="dashboard-chip">الأيام الظاهرة: {visibleRows.length}</span>
                  <span className="dashboard-chip">إجمالي محجوز الفترة: {group.periodBooked}</span>
                  <span className="dashboard-chip">المتبقي من الفترة: {group.periodRemaining}</span>
                  <span className="dashboard-chip">أعلى نشاط يومي: {visibleActiveMax}</span>
                </div>
                <div className="overflow-x-auto" dir="ltr">
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <tr>
                        {paddedRows.map((cell) => (
                          <th key={cell.key} className="dashboard-cell">
                            {cell.empty || !cell.date ? (
                              <div className="text-slate-300">-</div>
                            ) : (
                              <>
                                <div>{formatDay(cell.date)}</div>
                                <div className="mt-1 text-[10px] text-slate-500">{formatWeekday(cell.date)}</div>
                                <div className="mt-1 text-[10px] text-slate-400">{cell.date.getFullYear()}</div>
                              </>
                            )}
                          </th>
                        ))}
                        <th className="dashboard-sticky dashboard-cell" dir="rtl">
                          المؤشر
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-sky-50">
                        {paddedRows.map((cell) => (
                          <td className="dashboard-cell" key={`${cell.key}-q`}>
                            {cell.empty ? "-" : cell.allocated}
                          </td>
                        ))}
                        <td className="dashboard-sticky dashboard-cell bg-sky-100" dir="rtl">
                          إجمالي تخصيص الفترة
                        </td>
                      </tr>
                      <tr className="bg-rose-50">
                        {paddedRows.map((cell) => (
                          <td
                            className={`dashboard-cell font-semibold ${
                              !cell.empty && (cell.active ?? 0) > (cell.allocated ?? 0)
                                ? "bg-rose-200 text-rose-800"
                                : ""
                            }`}
                            key={`${cell.key}-b`}
                          >
                            {cell.empty ? "-" : cell.active}
                          </td>
                        ))}
                        <td className="dashboard-sticky dashboard-cell bg-rose-100" dir="rtl">
                          الغرف النشطة يوميا
                        </td>
                      </tr>
                      <tr className="bg-emerald-50">
                        {paddedRows.map((cell) => (
                          <td
                            className={`dashboard-cell font-semibold ${
                              !cell.empty && (cell.remaining ?? 0) < 0 ? "bg-rose-200 text-rose-800" : ""
                            }`}
                            key={`${cell.key}-r`}
                          >
                            {cell.empty ? "-" : cell.remaining}
                          </td>
                        ))}
                        <td className="dashboard-sticky dashboard-cell bg-emerald-100" dir="rtl">
                          المتبقي من الفترة
                        </td>
                      </tr>
                      <tr className="bg-amber-50">
                        {paddedRows.map((cell) => (
                          <td
                            className={`dashboard-cell ${
                              !cell.empty && (cell.occupancy ?? 0) >= 100
                                ? "bg-amber-200 font-bold text-amber-900"
                                : ""
                            }`}
                            key={`${cell.key}-o`}
                          >
                            {cell.empty ? "-" : `${cell.occupancy}%`}
                          </td>
                        ))}
                        <td className="dashboard-sticky dashboard-cell bg-amber-100" dir="rtl">
                          نسبة نشاط اليوم من إجمالي الفترة
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-3 text-sm lg:grid-cols-4">
                  <div className="metric-card">
                    <strong>إجمالي تخصيص الفترة:</strong> {group.periodAllocated}
                  </div>
                  <div className="metric-card">
                    <strong>إجمالي محجوز الفترة:</strong> {group.periodBooked}
                  </div>
                  <div className="metric-card">
                    <strong>المتبقي من الفترة:</strong> {visibleRemainingMin}
                  </div>
                  <div className="metric-card">
                    <strong>إجمالي النشاط في النافذة:</strong> {visibleActiveTotal}
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      ))}
      {dashboard.length === 0 && (
        <div className="card text-center text-sm text-slate-600">
          لا توجد بيانات للفترة المحددة.
        </div>
      )}
    </div>
  );
}
