import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProfitReport,
  filterReportBookings,
  isValidDateKey,
  toReportDateKey,
} from "../src/lib/profitReport.js";

test("validates and normalizes report date keys without timezone shifting SQL dates", () => {
  assert.equal(isValidDateKey("2026-09-28"), true);
  assert.equal(isValidDateKey("2026-02-30"), false);
  assert.equal(toReportDateKey("2026-09-28"), "2026-09-28");
  assert.equal(toReportDateKey("2026-09-28T16:00:00.000Z"), "2026-09-28");
});

test("filters bookings inclusively and rejects an invalid reporting range", () => {
  const bookings = [
    { id: "before", booking_date: "2026-09-27", package_name: "Villa" },
    { id: "start", booking_date: "2026-09-28", package_name: "Villa" },
    { id: "end", booking_date: "2026-09-30", package_name: "Villa" },
    { id: "other-package", booking_date: "2026-09-29", package_name: "Event" },
  ];

  assert.deepEqual(
    filterReportBookings(bookings, "2026-09-28", "2026-09-30", "Villa").map((booking) => booking.id),
    ["start", "end"]
  );
  assert.deepEqual(filterReportBookings(bookings, "2026-09-30", "2026-09-28"), []);
  assert.deepEqual(filterReportBookings(bookings, "invalid", "2026-09-30"), []);
});

test("calculates only verified collection data and leaves untracked profit categories unavailable", () => {
  const report = calculateProfitReport([
    { status: "confirmed", payment_status: "paid", payment_amount_due: "1500.00", total_amount: "10000.00", additional_fee_status: "paid", additional_fee_amount: "250.00" },
    { status: "completed", payment_status: "pending_verification", payment_amount_due: "2250.00", total_amount: "15000.00" },
    { status: "cancelled", payment_status: "paid", payment_amount_due: "3000.00", total_amount: "9000.00" },
    { status: "confirmed", payment_status: "paid", reservation_fee_amount: "1200.00", total_amount: "8000.00" },
  ]);

  assert.equal(report.revenueRows[0].amount, 2700);
  assert.equal(report.revenueRows[1].amount, null);
  assert.equal(report.revenueRows[3].amount, 250);
  assert.equal(report.totalSales, 2950);
  assert.equal(report.totalDirectCosts, null);
  assert.equal(report.grossProfit, null);
  assert.equal(report.totalOperatingExpenses, null);
  assert.equal(report.netProfit, null);
});
