import "server-only";

// Bug fix: previously, "today" for authorization decisions (photo required?
// monthly meter open?) was taken from a client-supplied `readingDate` field
// and computed using the server process's default timezone (Vercel's Node
// runtime defaults to UTC). Two separate problems: (1) trusting a
// client-supplied value for an authorization decision at all — nothing
// stopped a client from sending a fabricated date to open/close the
// monthly gate; (2) even a server-computed "today" would be wrong for a
// few hours around midnight, since the facility is in Cairo but the
// server's clock is UTC. Both are fixed by always deriving "today" here,
// from the server's real clock, explicitly in the facility's timezone.

const FACILITY_TIMEZONE = "Africa/Cairo";

function partsInFacilityTz(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: FACILITY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD, which is convenient to split directly.
  const [year, month, day] = formatter.format(date).split("-").map(Number);
  return { year, month, day };
}

/** The facility's current calendar date, as 'YYYY-MM-DD', independent of the server process's own timezone. */
export function getFacilityTodayIso(): string {
  const { year, month, day } = partsInFacilityTz(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The facility's current day-of-month (1-31). */
export function getFacilityDayOfMonth(): number {
  return partsInFacilityTz(new Date()).day;
}

export function isFacilityFirstOfMonth(): boolean {
  return getFacilityDayOfMonth() === 1;
}
