import { format } from "date-fns";

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(.*)$/;

export const parseSafeDate = (value) => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(DATE_PREFIX);

  if (!match) {
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const [, yearText, monthText, dayText, suffix] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(0);
  calendarDate.setFullYear(year, month - 1, day);
  calendarDate.setHours(0, 0, 0, 0);

  if (
    year < 1 ||
    calendarDate.getFullYear() !== year ||
    calendarDate.getMonth() !== month - 1 ||
    calendarDate.getDate() !== day
  ) {
    return null;
  }

  if (suffix) {
    const normalizedDateTime = suffix.startsWith(" ")
      ? `${yearText}-${monthText}-${dayText}T${suffix.trim()}`
      : `${yearText}-${monthText}-${dayText}${suffix}`;
    if (!Number.isFinite(new Date(normalizedDateTime).getTime())) {
      return null;
    }
  }

  return calendarDate;
};

export const safeFormatDate = (value, pattern, fallback = "Date unavailable") => {
  const date = parseSafeDate(value);
  return date ? format(date, pattern) : fallback;
};

export const normalizeDateOnly = (value) => {
  const date = parseSafeDate(value);
  return date ? format(date, "yyyy-MM-dd") : value;
};
