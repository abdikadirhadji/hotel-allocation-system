import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const [contracts, bookings] = await Promise.all([
    prisma.agreement.findMany({
      include: { client: true, hotel: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.findMany(),
  ]);

  const rows = contracts.map((a) => {
    const reserved = bookings
      .filter(
        (b) =>
          b.clientId === a.clientId &&
          b.hotelId === a.hotelId &&
          b.checkInDate <= a.endDate &&
          b.checkOutDate >= a.startDate,
      )
      .reduce((sum, b) => sum + b.rooms, 0);
    const remaining = a.totalRooms - reserved;
    const periodDays = Math.max(
      1,
      Math.ceil((a.endDate.getTime() - a.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    return {
      "رقم الاتفاقية": a.contractNo,
      العميل: a.client.name,
      الفندق: a.hotel.name,
      "حالة الاتفاقية": a.status,
      "إجمالي تخصيص الفترة": a.totalRooms,
      "المتاح عند البداية": a.availableRooms ?? "",
      "المحجوز من الفترة": reserved,
      "المتبقي من الفترة": remaining,
      "فترة الاتفاقية (يوم)": periodDays,
      "بداية الاتفاقية": a.startDate.toISOString().slice(0, 10),
      "نهاية الاتفاقية": a.endDate.toISOString().slice(0, 10),
      "السماح بالتجاوز": a.allowOverbooking ? "نعم" : "لا",
      ملاحظات: a.notes ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "contracts");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="contracts.xlsx"',
    },
  });
}
