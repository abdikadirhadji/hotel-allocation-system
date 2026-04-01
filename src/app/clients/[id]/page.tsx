import Link from "next/link";
import { notFound } from "next/navigation";

import { getAgreementStatusLabel, getBookingStateLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getRemainingBadgeClass, getRemainingLabel } from "@/lib/status";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      agreements: {
        include: { hotel: true, bookings: true },
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        include: { hotel: true, agreement: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  const activeBookings = client.bookings.filter((booking) => booking.state !== "CANCELLED");
  const totalAllocated = client.agreements.reduce((sum, agreement) => sum + agreement.totalRooms, 0);
  const totalBooked = activeBookings.reduce((sum, booking) => sum + booking.rooms, 0);
  const totalRemaining = totalAllocated - totalBooked;
  const utilization = totalAllocated > 0 ? Math.round((totalBooked / totalAllocated) * 100) : 0;
  const activeAgreements = client.agreements.filter((agreement) => agreement.status === "ACTIVE").length;
  const criticalAgreements = client.agreements.filter((agreement) => {
    const reserved = agreement.bookings
      .filter((booking) => booking.state !== "CANCELLED")
      .reduce((sum, booking) => sum + booking.rooms, 0);
    return agreement.totalRooms - reserved <= 5;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">{client.name}</h2>
          <p className="text-sm text-slate-500">الدولة: {client.country ?? "-"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/clients" className="btn-secondary">
            العودة إلى العملاء
          </Link>
          <Link href={`/contracts?q=${encodeURIComponent(client.name)}`} className="btn-secondary">
            اتفاقيات العميل
          </Link>
          <Link href={`/bookings?q=${encodeURIComponent(client.name)}`} className="btn-secondary">
            حجوزات العميل
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
        <div className="metric-card"><strong>إجمالي التخصيص:</strong> {totalAllocated}</div>
        <div className="metric-card"><strong>إجمالي المحجوز:</strong> {totalBooked}</div>
        <div className="metric-card"><strong>المتبقي:</strong> {totalRemaining}</div>
        <div className="metric-card"><strong>نسبة الاستهلاك:</strong> {utilization}%</div>
        <div className="metric-card"><strong>الاتفاقيات النشطة:</strong> {activeAgreements}</div>
        <div className="metric-card"><strong>اتفاقيات حرجة:</strong> {criticalAgreements}</div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">ملخص الحالة</h3>
          <span className={getRemainingBadgeClass(totalRemaining)}>{getRemainingLabel(totalRemaining)}</span>
        </div>
        <p className="text-sm text-slate-600">
          هذا العميل لديه {client.agreements.length} اتفاقية و {client.bookings.length} حجز مسجل في النظام.
        </p>
      </div>

      <div className="card overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">الاتفاقيات</h3>
          <Link href={`/contracts?q=${encodeURIComponent(client.name)}`} className="btn-secondary">
            فتح صفحة الاتفاقيات
          </Link>
        </div>
        <table className="text-xs">
          <thead>
            <tr>
              <th>رقم الاتفاقية</th>
              <th>الفندق</th>
              <th>الحالة</th>
              <th>التخصيص</th>
              <th>المحجوز</th>
              <th>المتبقي</th>
              <th>الفترة</th>
            </tr>
          </thead>
          <tbody>
            {client.agreements.length === 0 ? (
              <tr>
                <td colSpan={7}>لا توجد اتفاقيات لهذا العميل</td>
              </tr>
            ) : (
              client.agreements.map((agreement) => {
                const reserved = agreement.bookings
                  .filter((booking) => booking.state !== "CANCELLED")
                  .reduce((sum, booking) => sum + booking.rooms, 0);
                const remaining = agreement.totalRooms - reserved;

                return (
                  <tr key={agreement.id}>
                    <td>{agreement.contractNo}</td>
                    <td>{agreement.hotel.name}</td>
                    <td>{getAgreementStatusLabel(agreement.status)}</td>
                    <td>{agreement.totalRooms}</td>
                    <td>{reserved}</td>
                    <td>
                      <span className={getRemainingBadgeClass(remaining)}>
                        {remaining}
                      </span>
                    </td>
                    <td>
                      {agreement.startDate.toISOString().slice(0, 10)} - {agreement.endDate.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">آخر الحجوزات</h3>
          <Link href={`/bookings?q=${encodeURIComponent(client.name)}`} className="btn-secondary">
            فتح صفحة الحجوزات
          </Link>
        </div>
        <table className="text-xs">
          <thead>
            <tr>
              <th>رقم الحجز</th>
              <th>رقم الاتفاقية</th>
              <th>الفندق</th>
              <th>الحالة</th>
              <th>الغرف</th>
              <th>الدخول</th>
              <th>الخروج</th>
            </tr>
          </thead>
          <tbody>
            {client.bookings.length === 0 ? (
              <tr>
                <td colSpan={7}>لا توجد حجوزات لهذا العميل</td>
              </tr>
            ) : (
              client.bookings.slice(0, 10).map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.bookingNo}</td>
                  <td>{booking.agreement?.contractNo ?? "-"}</td>
                  <td>{booking.hotel.name}</td>
                  <td>{getBookingStateLabel(booking.state)}</td>
                  <td>{booking.rooms}</td>
                  <td>{booking.checkInDate.toISOString().slice(0, 10)}</td>
                  <td>{booking.checkOutDate.toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
