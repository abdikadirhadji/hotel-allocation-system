import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    include: { client: true, hotel: true, agreement: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = bookings.map((b) => ({
    SN: b.sn,
    State: b.state,
    "رقم الحجز": b.bookingNo,
    "رقم الاتفاقية": b.agreement?.contractNo ?? "",
    "اسم الشركة": b.companyName ?? b.client.name,
    العميل: b.client.name,
    الفندق: b.hotel.name,
    "تاريخ الدخول": b.checkInDate.toISOString().slice(0, 10),
    "تاريخ الخروج": b.checkOutDate.toISOString().slice(0, 10),
    "عدد الغرف": b.rooms,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "bookings");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="bookings.xlsx"',
    },
  });
}
