export function getBookingStateLabel(state: string) {
  switch (state) {
    case "CONFIRMED":
      return "مؤكد";
    case "CHECKED_IN":
      return "تم الدخول";
    case "CHECKED_OUT":
      return "تم الخروج";
    case "CANCELLED":
      return "ملغي";
    default:
      return state;
  }
}

export function getAgreementStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "نشط";
    case "PAUSED":
      return "موقوف";
    case "CLOSED":
      return "مغلق";
    default:
      return status;
  }
}
