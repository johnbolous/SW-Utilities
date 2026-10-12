// Pure date helpers shared by client and server code — no "server-only" here.

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isFirstOfMonth(date: Date = new Date()): boolean {
  return date.getDate() === 1;
}

/** "1st of the month" gate for photo capture — applies to every reading
 * category on that date, regardless of the individual meter's own
 * daily/monthly frequency (see spec §5). */
export function isPhotoRequiredToday(date: Date = new Date()): boolean {
  return isFirstOfMonth(date);
}
