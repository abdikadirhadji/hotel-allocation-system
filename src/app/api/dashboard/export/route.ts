import { getDailyDashboard } from "@/lib/dashboard";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const clientId = searchParams.get("clientId") || undefined;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const dashboard = await getDailyDashboard({
    clientId,
    from: new Date(from),
    to: new Date(to),
  });

  const rows: Array<Record<string, string | number>> = [];
  dashboard.forEach((group) => {
    group.rows.forEach((r) => {
      rows.push({
        "رقم الاتفاقية": group.agreementNo,
        العميل: group.clientName,
        الفندق: group.hotelName,
        التاريخ: r.date.toISOString().slice(0, 10),
        "إجمالي تخصيص الفترة": group.periodAllocated,
        "إجمالي محجوز الفترة": group.periodBooked,
        "المتبقي من الفترة": group.periodRemaining,
        "الغرف النشطة يوميا": r.active,
        "نسبة نشاط اليوم من إجمالي الفترة": `${r.occupancy}%`,
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "dashboard");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="dashboard.xlsx"',
    },
  });
}
