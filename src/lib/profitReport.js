const toOptionalAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

export const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const toReportDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const dateKey = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/u)?.[1] || "";
    if (isValidDateKey(dateKey)) return dateKey;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const filterReportBookings = (bookings, startDate, endDate, packageFilter = "All") => {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || startDate > endDate) return [];
  return bookings.filter((booking) => {
    const bookingDate = toReportDateKey(booking.booking_date);
    return bookingDate >= startDate && bookingDate <= endDate &&
      (packageFilter === "All" || booking.package_name === packageFilter);
  });
};

export const calculateProfitReport = (bookings) => {
  const reportableBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const verifiedBookingPayments = reportableBookings.filter((booking) => booking.payment_status === "paid");
  const collectedBookingRevenue = verifiedBookingPayments.reduce((sum, booking) => (
    sum + (toOptionalAmount(booking.payment_amount_due) ?? toOptionalAmount(booking.reservation_fee_amount) ?? 0)
  ), 0);
  const paidAdditionalFees = reportableBookings
    .filter((booking) => booking.additional_fee_status === "paid")
    .reduce((sum, booking) => sum + (toOptionalAmount(booking.additional_fee_amount) ?? 0), 0);

  const revenueRows = [
    { label: "Room / Villa Bookings", amount: collectedBookingRevenue },
    { label: "Event / Venue Rentals", amount: null },
    { label: "Food & Beverage Sales", amount: null },
    { label: "Other Income (Amenities, Add-ons, etc.)", amount: paidAdditionalFees },
  ];
  const directCostRows = [
    { label: "Food & Beverage Cost", amount: null },
    { label: "Event Supplies & Materials", amount: null },
    { label: "Housekeeping / Amenities Supplies", amount: null },
  ];
  const operatingExpenseRows = [
    { label: "Salaries & Wages", amount: null },
    { label: "Utilities (Electricity, Water, Internet)", amount: null },
    { label: "Maintenance & Repairs", amount: null },
    { label: "Marketing & Advertising", amount: null },
    { label: "Permits, Licenses & Insurance", amount: null },
    { label: "Depreciation", amount: null },
    { label: "Miscellaneous Expenses", amount: null },
  ];

  return {
    revenueRows,
    directCostRows,
    operatingExpenseRows,
    totalSales: revenueRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    totalDirectCosts: null,
    grossProfit: null,
    totalOperatingExpenses: null,
    netProfit: null,
  };
};
