const TOUR_WINDOWS = {
  day_tour: { start: "08:00", end: "18:00" },
  night_tour: { start: "18:00", end: "06:00", crossesMidnight: true },
  "22_hours": { start: "18:00", end: "16:00", crossesMidnight: true },
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
