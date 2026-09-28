const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toOptionalAmount = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

export const toFiniteAmount = (value) => toOptionalAmount(value) ?? 0;

export const getSubmittedBookingPayment = (booking) => (
  toOptionalAmount(booking?.payment_amount_due) ??
  toOptionalAmount(booking?.reservation_fee_amount) ??
  0
);

export const isRevenueEligibleBooking = (booking) => (
  booking?.payment_status === "paid" &&
  !["cancelled", "archived"].includes(booking?.status)
);

export const getRecognizedBookingRevenue = (booking) => {
  if (["cancelled", "archived"].includes(booking?.status)) return 0;
  const bookingPayment = booking?.payment_status === "paid" ? getSubmittedBookingPayment(booking) : 0;
  const additionalFees = booking?.additional_fee_status === "paid"
    ? toFiniteAmount(booking.additional_fee_amount)
    : 0;
  return bookingPayment + additionalFees;
};

export const formatPHPAmount = (value) => currencyFormatter.format(toFiniteAmount(value));

const parseBookingTimestamp = (value) => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const calculateDashboardRevenue = (bookings = [], now = new Date()) => {
  const rows = Array.isArray(bookings) ? bookings : [];
  const eligibleBookings = rows.filter((booking) => (
    !["cancelled", "archived"].includes(booking?.status) && getRecognizedBookingRevenue(booking) > 0
  ));
  const paidBookings = rows.filter(isRevenueEligibleBooking);
  const currentMonthBookings = eligibleBookings.filter((booking) => {
    const bookingDate = parseBookingTimestamp(booking.booking_date);
    return bookingDate && bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear();
  });

  const monthlyData = monthNames.map((month, monthIndex) => {
    const monthBookings = eligibleBookings.filter((booking) => {
      const bookingDate = parseBookingTimestamp(booking.booking_date);
      return bookingDate && bookingDate.getMonth() === monthIndex && bookingDate.getFullYear() === now.getFullYear();
    });

    return {
      month,
      revenue: monthBookings.reduce((sum, booking) => sum + getRecognizedBookingRevenue(booking), 0),
      bookings: monthBookings.filter(isRevenueEligibleBooking).length,
    };
  });

  return {
    totalRevenue: eligibleBookings.reduce((sum, booking) => sum + getRecognizedBookingRevenue(booking), 0),
    paidBookingCount: paidBookings.length,
    monthlyRevenue: currentMonthBookings.reduce((sum, booking) => sum + getRecognizedBookingRevenue(booking), 0),
    monthlyPaidBookingCount: currentMonthBookings.filter(isRevenueEligibleBooking).length,
    monthlyData,
  };
};
