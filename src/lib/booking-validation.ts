import { Agreement } from "@prisma/client";
import { redirect } from "next/navigation";

export function validateAgreementForBooking(
  agreement: Agreement,
  clientId: string,
  hotelId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  if (agreement.clientId !== clientId || agreement.hotelId !== hotelId) {
    redirect("/bookings?type=error&message=booking_wrong_contract");
  }

  if (agreement.status !== "ACTIVE") {
    redirect("/bookings?type=error&message=booking_contract_inactive");
  }

  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (start < agreement.startDate || end > agreement.endDate) {
    redirect("/bookings?type=error&message=booking_outside_contract");
  }
}
