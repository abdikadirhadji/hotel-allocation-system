import { prisma } from "./prisma";

type DashboardParams = {
  clientId?: string;
  from: Date;
  to: Date;
};

export async function getDailyDashboard({ clientId, from, to }: DashboardParams) {
  const agreements = await prisma.agreement.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      startDate: { lte: to },
      endDate: { gte: from },
    },
    include: { client: true, hotel: true },
    orderBy: [{ client: { name: "asc" } }, { hotel: { name: "asc" } }],
  });

  const bookings = await prisma.booking.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      checkInDate: { lte: to },
      checkOutDate: { gte: from },
    },
  });

  const days: Date[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  return agreements.map((agreement) => {
    const agreementBookings = bookings.filter(
      (b) =>
        b.clientId === agreement.clientId &&
        b.hotelId === agreement.hotelId &&
        b.checkInDate <= agreement.endDate &&
        b.checkOutDate >= agreement.startDate,
    );

    const periodAllocated = agreement.totalRooms;
    const periodBooked = agreementBookings.reduce((sum, b) => sum + b.rooms, 0);
    const periodRemaining = periodAllocated - periodBooked;
    const periodOccupancy =
      periodAllocated > 0 ? Math.round((periodBooked / periodAllocated) * 100) : 0;

    const rows = days.map((day) => {
      const dailyActive = agreementBookings
        .filter(
          (b) =>
            b.checkInDate <= day &&
            b.checkOutDate >= day,
        )
        .reduce((sum, b) => sum + b.rooms, 0);

      const occupancy =
        periodAllocated > 0 ? Math.round((dailyActive / periodAllocated) * 100) : 0;

      return {
        date: new Date(day),
        allocated: periodAllocated,
        active: dailyActive,
        booked: periodBooked,
        remaining: periodRemaining,
        occupancy,
      };
    });

    return {
      agreementId: agreement.id,
      agreementNo: agreement.contractNo,
      clientName: agreement.client.name,
      hotelName: agreement.hotel.name,
      periodAllocated,
      periodBooked,
      periodRemaining,
      periodOccupancy,
      startDate: agreement.startDate,
      endDate: agreement.endDate,
      rows,
    };
  });
}
