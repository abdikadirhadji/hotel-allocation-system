const messages: Record<string, string> = {
  client_name_required: "اسم العميل مطلوب",
  client_created: "تمت إضافة العميل بنجاح",
  client_create_failed: "تعذر إضافة العميل. قد يكون الاسم موجودا بالفعل",
  client_delete_failed: "لا يمكن حذف العميل لأنه مرتبط باتفاقيات أو حجوزات",
  client_deleted: "تم حذف العميل بنجاح",
  hotel_name_required: "اسم الفندق مطلوب",
  hotel_created: "تمت إضافة الفندق بنجاح",
  hotel_create_failed: "تعذر إضافة الفندق. قد يكون الاسم موجودا بالفعل",
  hotel_delete_failed: "لا يمكن حذف الفندق لأنه مرتبط باتفاقيات أو حجوزات",
  hotel_deleted: "تم حذف الفندق بنجاح",
  contract_required: "يرجى تعبئة جميع الحقول المطلوبة",
  contract_bad_dates: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية",
  contract_bad_available: "عدد الغرف المتاحة لا يمكن أن يكون سالبا",
  contract_created: "تمت إضافة الاتفاقية بنجاح",
  contract_create_failed: "تعذر إضافة الاتفاقية. تحقق من رقم الاتفاقية والبيانات المدخلة",
  contract_delete_failed: "لا يمكن حذف الاتفاقية لأنها مرتبطة بحجوزات",
  contract_deleted: "تم حذف الاتفاقية بنجاح",
  contract_updated: "تم تحديث الاتفاقية بنجاح",
  contract_update_failed: "تعذر تحديث الاتفاقية",
  contract_cancelled: "تم إغلاق الاتفاقية بنجاح",
  booking_required: "يرجى تعبئة جميع الحقول المطلوبة",
  booking_bad_dates: "تاريخ الدخول يجب أن يكون قبل تاريخ الخروج",
  booking_over_limit: "لا يمكن تجاوز عدد الغرف المتفق عليها لهذه الاتفاقية",
  booking_created: "تمت إضافة الحجز بنجاح",
  booking_create_failed: "تعذر إضافة الحجز. تحقق من رقم الحجز والبيانات المدخلة",
  booking_delete_failed: "تعذر حذف الحجز",
  booking_deleted: "تم حذف الحجز بنجاح",
  booking_updated: "تم تحديث الحجز بنجاح",
  booking_update_failed: "تعذر تحديث الحجز",
  booking_cancelled: "تم إلغاء الحجز بنجاح",
  seed_loaded: "تم تحميل البيانات التجريبية بنجاح",
};

export function getFlashMessage(code?: string) {
  if (!code) return "";
  return messages[code] ?? "";
}
