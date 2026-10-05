const TOUR_WINDOWS = {
  day_tour: { start: 8 * 60, end: 18 * 60 },
  night_tour: { start: 18 * 60, end: 6 * 60 },
  "22_hours": { start: 18 * 60, end: 16 * 60 },
};

const DAY_IN_MINUTES = 24 * 60;

const getTourInterval = (dateKey, tourType) => {
  const window = TOUR_WINDOWS[tourType];
  if (!window || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return null;

  const start = Date.parse(`${dateKey}T00:00:00Z`) / 60000 + window.start;
  const end = Date.parse(`${dateKey}T00:00:00Z`) / 60000 + window.end;
  return { start, end: end <= start ? end + DAY_IN_MINUTES : end };
};

export const bookingSchedulesOverlap = (dateA, tourA, dateB, tourB) => {
  const intervalA = getTourInterval(dateA, tourA);
  const intervalB = getTourInterval(dateB, tourB);
  if (!intervalA || !intervalB) return true;

  return intervalA.start < intervalB.end && intervalB.start < intervalA.end;
};

export const tourCrossesMidnight = (tourType) => ["night_tour", "22_hours"].includes(tourType);
