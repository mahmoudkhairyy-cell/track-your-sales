import { ARABIC_MONTHS, CAIRO_TZ, YEAR_MONTH_RE, type WeekKey } from "@/lib/constants";
import type { WorkingDays } from "@/db/schema";

export function cairoISODate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("تعذر حساب تاريخ القاهرة");
  }
  return `${year}-${month}-${day}`;
}

export function cairoYearMonth(date = new Date()): string {
  return cairoISODate(date).slice(0, 7);
}

export function isValidYearMonth(value: string): boolean {
  return YEAR_MONTH_RE.test(value);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function monthLabelAr(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${ARABIC_MONTHS[month - 1]} ${year}`;
}

export function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDateRange(yearMonth: string): { start: string; end: string } {
  const last = daysInMonth(yearMonth);
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(last).padStart(2, "0")}`,
  };
}

export function weekdayFromISO(iso: string): WeekKey {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TZ,
    weekday: "short",
  }).format(utc);
  const map: Record<string, WeekKey> = {
    Sat: "sat",
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };
  const key = map[weekday];
  if (!key) {
    throw new Error("تعذر حساب يوم الأسبوع");
  }
  return key;
}

export function listMonthDates(yearMonth: string): string[] {
  const last = daysInMonth(yearMonth);
  const dates: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    dates.push(`${yearMonth}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

export function isWorkingDate(
  iso: string,
  workingDays: WorkingDays,
  holidays: Set<string>,
): boolean {
  if (holidays.has(iso)) return false;
  return Boolean(workingDays[weekdayFromISO(iso)]);
}

export function workingDatesInMonth(
  yearMonth: string,
  workingDays: WorkingDays,
  holidays: string[],
): string[] {
  const holidaySet = new Set(holidays);
  return listMonthDates(yearMonth).filter((iso) => isWorkingDate(iso, workingDays, holidaySet));
}

export function elapsedWorkingDates(
  yearMonth: string,
  workingDays: WorkingDays,
  holidays: string[],
  todayISO: string,
): string[] {
  return workingDatesInMonth(yearMonth, workingDays, holidays).filter((iso) => iso <= todayISO);
}

export function remainingWorkingDates(
  yearMonth: string,
  workingDays: WorkingDays,
  holidays: string[],
  todayISO: string,
): string[] {
  return workingDatesInMonth(yearMonth, workingDays, holidays).filter((iso) => iso >= todayISO);
}

export function formatTimeCairo(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: CAIRO_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatDateAr(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${ARABIC_MONTHS[month - 1]} ${year}`;
}
