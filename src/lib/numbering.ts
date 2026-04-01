import { prisma } from "@/lib/prisma";

function buildCode(prefix: string, year: number, sequence: number) {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

async function getNextSequence(model: "agreement" | "booking", prefix: string, year: number) {
  const startsWith = `${prefix}-${year}-`;
  const records =
    model === "agreement"
      ? await prisma.agreement.findMany({
          where: { contractNo: { startsWith } },
          select: { contractNo: true },
          orderBy: { contractNo: "desc" },
          take: 50,
        })
      : await prisma.booking.findMany({
          where: { bookingNo: { startsWith } },
          select: { bookingNo: true },
          orderBy: { bookingNo: "desc" },
          take: 50,
        });

  const values = records.map((record) => {
    const code = "contractNo" in record ? record.contractNo : record.bookingNo;
    const seq = Number(code.split("-").pop());
    return Number.isFinite(seq) ? seq : 0;
  });

  return (Math.max(0, ...values) || 0) + 1;
}

export async function getNextAgreementNumber(date = new Date()) {
  const year = date.getFullYear();
  const next = await getNextSequence("agreement", "AGR", year);
  return buildCode("AGR", year, next);
}

export async function getNextBookingNumber(date = new Date()) {
  const year = date.getFullYear();
  const next = await getNextSequence("booking", "BKG", year);
  return buildCode("BKG", year, next);
}
