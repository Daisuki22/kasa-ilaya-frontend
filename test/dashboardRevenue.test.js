import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDashboardRevenue,
  formatPHPAmount,
  getRecognizedBookingRevenue,
  getSubmittedBookingPayment,
  toFiniteAmount,
} from "../src/lib/dashboardRevenue.js";

test("sums database decimal strings numerically and uses submitted payment amounts", () => {
  const result = calculateDashboardRevenue([
    { status: "confirmed", payment_status: "paid", total_amount: "20000.00", payment_amount_due: "3000.00", booking_date: "2026-09-10" },
    { status: "completed", payment_status: "paid", reservation_fee_amount: "2250.00", booking_date: "2026-09-11" },
    { status: "pending", payment_status: "pending_verification", total_amount: "10000.00", payment_amount_due: "1500.00", booking_date: "2026-09-12" },
    { status: "cancelled", payment_status: "paid", payment_amount_due: "1200.00", booking_date: "2026-09-13" },
    { status: "archived", payment_status: "paid", payment_amount_due: "100.00", booking_date: "2026-09-14" },
    { status: "confirmed", payment_status: "pending", additional_fee_status: "paid", additional_fee_amount: "500.00", booking_date: "2026-09-15" },
  ], new Date("2026-09-20T12:00:00.000Z"));

  assert.equal(result.totalRevenue, 5750);
  assert.equal(result.paidBookingCount, 2);
  assert.equal(result.monthlyRevenue, 5750);
  assert.equal(result.monthlyPaidBookingCount, 2);
  assert.equal(result.monthlyData[8].revenue, 5750);
  assert.equal(typeof result.monthlyData[8].revenue, "number");
});

test("normalizes invalid amount/date input to safe zero-valued chart data", () => {
  const result = calculateDashboardRevenue([
    { status: "confirmed", payment_status: "paid", payment_amount_due: "bad", reservation_fee_amount: null, booking_date: "not-a-date" },
  ], new Date("2026-09-20T12:00:00.000Z"));

  assert.equal(toFiniteAmount("not-a-number"), 0);
  assert.equal(getSubmittedBookingPayment({ payment_amount_due: "bad", reservation_fee_amount: "500.50" }), 500.5);
  assert.equal(getRecognizedBookingRevenue({ status: "confirmed", payment_status: "pending", additional_fee_status: "paid", additional_fee_amount: "250.25" }), 250.25);
  assert.equal(getRecognizedBookingRevenue({ status: "archived", payment_status: "paid", payment_amount_due: 500 }), 0);
  assert.equal(result.totalRevenue, 0);
  assert.equal(result.monthlyRevenue, 0);
  assert.equal(result.monthlyData.length, 12);
  assert.ok(result.monthlyData.every((item) => Number.isFinite(item.revenue)));
  assert.match(formatPHPAmount(0), /0\.00/u);
});
