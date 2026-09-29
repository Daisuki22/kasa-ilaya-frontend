const TOUR_WINDOWS = {
  day_tour: { start: "08:00", end: "18:00" },
  night_tour: { start: "18:00", end: "06:00", crossesMidnight: true },
  "22_hours": { start: "18:00", end: "16:00", crossesMidnight: true },
};

export const getResortDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const calendarDaysUntil = (targetDate, todayDate = getResortDateKey()) => {
  const targetKey = String(targetDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetKey) || !/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) return null;
  const target = new Date(`${targetKey}T00:00:00.000Z`).getTime();
  const today = new Date(`${todayDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(target) || Number.isNaN(today) || new Date(target).toISOString().slice(0, 10) !== targetKey) return null;
  return Math.round((target - today) / 86400000);
};

export const getBookingStartDateTime = (booking) => {
  const dateKey = String(booking?.booking_date || "").slice(0, 10);
  const window = TOUR_WINDOWS[booking?.tour_type];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !window) return null;
  const startDateTime = new Date(`${dateKey}T${window.start}:00+08:00`);
  return Number.isNaN(startDateTime.getTime()) ? null : startDateTime;
};

export const getBookingEndDateTime = (booking) => {
  const dateKey = String(booking?.booking_date || "").slice(0, 10);
  const window = TOUR_WINDOWS[booking?.tour_type];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !window) return null;

  let endDateKey = dateKey;
  if (window.crossesMidnight) {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    endDateKey = date.toISOString().slice(0, 10);
  }

  const endDateTime = new Date(`${endDateKey}T${window.end}:00+08:00`);
  return Number.isNaN(endDateTime.getTime()) ? null : endDateTime;
};

export const isBookingExpired = (booking, now = Date.now()) => {
  if (booking?.status !== "pending") return false;
  const endDateTime = getBookingEndDateTime(booking);
  return Boolean(endDateTime && endDateTime.getTime() <= now);
};
