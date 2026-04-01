export function getRemainingBadgeClass(remaining: number) {
  if (remaining < 0) return "badge-danger";
  if (remaining <= 5) return "badge-warning";
  return "badge-success";
}

export function getRemainingLabel(remaining: number) {
  if (remaining < 0) return "تجاوز";
  if (remaining <= 5) return "حرج";
  return "سليم";
}
