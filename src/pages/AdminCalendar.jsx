import React, { useEffect, useMemo, useState } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveAssetUrl } from "@/lib/assetUrls";
import { getBookingStartDateTime, getResortDateKey, isBookingExpired } from "@/lib/bookingTimes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  CheckCheck,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import FullCalendarView from "@/components/admin/FullCalendarView";
import PaginationControls from "@/components/admin/PaginationControls";

const statusColors = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  confirmed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  completed: "border-border bg-background text-foreground",
  expired: "border-destructive/20 bg-destructive/10 text-destructive",
};

const paymentColors = {
  unpaid: "border-destructive/20 bg-destructive/10 text-destructive",
  pending_verification: "border-info/30 bg-info/10 text-primary",
  paid: "border-success/30 bg-success/10 text-success",
  declined: "border-destructive/20 bg-destructive/10 text-destructive",
};

const isOutdatedReceipt = (booking) => booking?.payment_proof_review === "auto_declined"
  && /^Receipt is outdated\./.test(booking.rejection_reason || "");

const paymentStatusLabel = (booking) => booking?.status === "rejected" ? "declined" : (booking?.payment_status || "unpaid").replace(/_/g, " ");
const bookingStatusLabel = (booking) => booking?.status === "rejected"
  ? (isOutdatedReceipt(booking) ? "Declined — Outdated Receipt" : "Declined")
  : booking?.status === "confirmed" ? "approved" : (booking?.status || "pending").replace(/_/g, " ");

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const paymentTypeLabels = {
  downpayment: "Downpayment",
  full_payment: "Full payment",
};

const rejectionReasonSuggestions = [
  {
    label: "Payment amount does not match",
    reason: "The payment amount does not match the required reservation fee. Please contact the resort if you need help confirming the correct amount.",
  },
  {
    label: "Receipt is unclear",
    reason: "We could not clearly verify the payment details in the receipt you submitted. Please contact the resort for assistance with your reservation.",
  },
  {
    label: "Payment details do not match",
    reason: "The payment method or transaction details could not be matched to this reservation. Please contact the resort so we can clarify the payment record.",
  },
  {
    label: "Date is unavailable",
    reason: "We are unable to accommodate this reservation on the requested date. Please contact the resort to ask about other available dates.",
  },
  {
    label: "Incomplete reservation details",
    reason: "Some information needed to review this reservation is missing or unclear. Please contact the resort for assistance and next steps.",
  },
];

const statusOptions = [
  { value: "all", label: "All active" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
];

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const getSubmittedPaymentAmount = (booking) => Number(
  booking?.payment_amount_due || booking?.reservation_fee_amount || 0
);

const getPaymentChannel = (booking) => (
  booking?.payment_mode || booking?.payment_qr_code_label || "Not selected"
);

const formatDate = (value, pattern = "MMM d, yyyy") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, pattern);
};

const normalizeText = (value) => String(value || "").toLowerCase();

function MetricCard({ icon: Icon, label, value, helper, tone = "text-foreground" }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5 sm:p-6 sm:pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, children }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="mt-1 min-w-0 break-words text-sm font-medium text-foreground">{children || "-"}</div>
    </div>
  );
}

function PaymentProof({ src }) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => setUnavailable(false), [src]);
  const imageUrl = resolveAssetUrl(src);
  if (!imageUrl || unavailable) {
    return <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Payment proof unavailable.</p>;
  }
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">Payment Proof</span>
      <a href={imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-white">
        <img src={imageUrl} alt="Payment proof" onError={() => setUnavailable(true)} className="max-h-[42vh] w-full object-contain sm:max-h-72" />
      </a>
      <a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full break-words text-sm text-primary underline-offset-4 hover:underline">
        Open uploaded payment proof
      </a>
    </div>
  );
}

export default function AdminCalendar() {
  const queryClient = useQueryClient();
  const [todayDateKey, setTodayDateKey] = useState(() => getResortDateKey());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [acceptBookingTarget, setAcceptBookingTarget] = useState(null);
  const [isAcceptingBooking, setIsAcceptingBooking] = useState(false);
  const [completeBookingTarget, setCompleteBookingTarget] = useState(null);
  const [isCompletingBooking, setIsCompletingBooking] = useState(false);
  const [archiveBookingTarget, setArchiveBookingTarget] = useState(null);
  const [isArchivingBooking, setIsArchivingBooking] = useState(false);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState([]);
  const [isBulkArchiveDialogOpen, setIsBulkArchiveDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [user, setUser] = useState(null);
  const [selectedRescheduleRequest, setSelectedRescheduleRequest] = useState(null);
  const [rescheduleDecisionNote, setRescheduleDecisionNote] = useState("");
  const [rescheduleDecision, setRescheduleDecision] = useState("");
  const requestedBookingId = new URLSearchParams(window.location.search).get("bookingId");

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextDateKey = getResortDateKey();
      setTodayDateKey((currentDateKey) => currentDateKey === nextDateKey ? currentDateKey : nextDateKey);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const isBookingDateToday = (booking) => String(booking?.booking_date || "").slice(0, 10) === todayDateKey;

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-all-bookings", requestedBookingId],
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const listedBookings = await baseClient.entities.Booking.list("-created_date", 500);
      if (!requestedBookingId || listedBookings.some((booking) => String(booking.id) === requestedBookingId)) {
        return listedBookings;
      }
      const [requestedBooking] = await baseClient.entities.Booking.filter({ id: requestedBookingId }, "-created_date", 1);
      return requestedBooking ? [requestedBooking, ...listedBookings] : listedBookings;
    },
  });

  const closeSelectedBooking = () => {
    setSelectedBooking(null);
    setRejectionReason("");
    const url = new URL(window.location.href);
    url.searchParams.delete("bookingId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    if (!requestedBookingId || isLoading) return;
    const requestedBooking = bookings.find((booking) => String(booking.id) === requestedBookingId);
    if (requestedBooking) {
      setStatusFilter("all");
      setSearchTerm("");
      setSelectedBooking(requestedBooking);
    }
  }, [bookings, isLoading, requestedBookingId]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "archived"),
    [bookings]
  );
  const pendingRescheduleRequests = useMemo(
    () => activeBookings.filter((booking) => {
      if (booking.rebooking_status !== "pending" || !["pending", "confirmed"].includes(booking.status)) return false;
      const bookingStart = getBookingStartDateTime(booking);
      return Boolean(bookingStart && bookingStart.getTime() > Date.now());
    }),
    [activeBookings]
  );

  const filteredBookings = useMemo(() => {
    const term = normalizeText(searchTerm).trim();

    return activeBookings.filter((booking) => {
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const searchable = [
        booking.booking_reference,
        booking.customer_name,
        booking.customer_email,
        booking.customer_phone,
        booking.package_name,
        tourLabels[booking.tour_type],
        booking.status,
        booking.payment_status,
        paymentTypeLabels[booking.payment_type],
        booking.payment_mode,
        booking.payment_qr_code_label,
      ].map(normalizeText).join(" ");

      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [activeBookings, searchTerm, statusFilter]);

  useEffect(() => {
    setQueuePage(1);
  }, [searchTerm, statusFilter]);

  const queueTotalPages = Math.max(1, Math.ceil(filteredBookings.length / queuePageSize));
  const currentQueuePage = Math.min(queuePage, queueTotalPages);
  const visibleBookings = useMemo(
    () => filteredBookings.slice((currentQueuePage - 1) * queuePageSize, currentQueuePage * queuePageSize),
    [filteredBookings, currentQueuePage, queuePageSize]
  );

  const metrics = useMemo(() => {
    const pending = activeBookings.filter((booking) => booking.status === "pending").length;
    const confirmed = activeBookings.filter((booking) => booking.status === "confirmed").length;
    const completed = activeBookings.filter((booking) => booking.status === "completed").length;
    const pendingPayments = activeBookings.filter((booking) => booking.payment_status === "pending_verification").length;
    const expectedRevenue = activeBookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

    return {
      total: activeBookings.length,
      pending,
      confirmed,
      completed,
      pendingPayments,
      expectedRevenue,
    };
  }, [activeBookings]);

  const archiveBooking = async (bookingId) => {
    const booking = bookings.find((item) => String(item.id) === String(bookingId));
    setIsArchivingBooking(true);

    try {
      await baseClient.entities.Booking.update(bookingId, {
        status: "archived",
      });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Booking archived",
        entity_type: "Booking",
        entity_id: bookingId,
        details: `Archived booking ${booking?.booking_reference}`,
      });
      toast.success("Booking archived.");
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      closeSelectedBooking();
      setArchiveBookingTarget(null);
    } catch (error) {
      toast.error(error?.message || "Unable to archive booking.");
    } finally {
      setIsArchivingBooking(false);
    }
  };

  const toggleArchiveSelection = (bookingId) => {
    setSelectedArchiveIds((current) => current.includes(bookingId)
      ? current.filter((id) => id !== bookingId)
      : [...current, bookingId]);
  };

  const toggleAllVisibleArchiveSelection = () => {
    const visibleIds = visibleBookings.map((booking) => booking.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedArchiveIds.includes(id));
    setSelectedArchiveIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const archiveSelectedBookings = async () => {
    const selectedBookings = bookings.filter((booking) => selectedArchiveIds.includes(booking.id) && booking.status !== "archived");
    if (!selectedBookings.length) return;

    setIsArchivingBooking(true);
    const results = await Promise.allSettled(selectedBookings.map(async (booking) => {
      await baseClient.entities.Booking.update(booking.id, { status: "archived" });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Booking archived",
        entity_type: "Booking",
        entity_id: booking.id,
        details: `Archived booking ${booking.booking_reference}`,
      });
      return booking.id;
    }));
    const archivedIds = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failedCount = results.length - archivedIds.length;

    if (archivedIds.length) {
      setSelectedArchiveIds((current) => current.filter((id) => !archivedIds.includes(id)));
      toast.success(`${archivedIds.length} booking${archivedIds.length === 1 ? "" : "s"} archived.`);
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    }
    if (failedCount) toast.error(`${failedCount} booking${failedCount === 1 ? "" : "s"} could not be archived.`);
    setIsArchivingBooking(false);
    setIsBulkArchiveDialogOpen(false);
  };

  const updateStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled") {
      toast.error("Owner and staff cannot cancel bookings. Guests may cancel their own active bookings more than 7 days before the reservation date; paid amounts are non-refundable.");
      return;
    }

    const booking = bookings.find((item) => item.id === bookingId);
    try {
      const updatedBooking = newStatus === "confirmed"
        ? await baseClient.entities.Booking.accept(bookingId)
        : newStatus === "completed"
          ? await baseClient.entities.Booking.complete(bookingId, true)
          : await baseClient.entities.Booking.update(bookingId, { status: newStatus });

      if (newStatus !== "confirmed" && newStatus !== "completed") {
        try {
          await baseClient.entities.ActivityLog.create({
            user_email: user?.email,
            user_name: user?.full_name,
            action: `Booking ${newStatus}`,
            entity_type: "Booking",
            entity_id: bookingId,
            details: `Updated booking ${booking?.booking_reference} to ${newStatus} with payment status ${updatedBooking?.payment_status || booking?.payment_status || "unpaid"}`,
          });
        } catch (activityLogError) {
          if (import.meta.env.DEV) {
            console.warn("Booking activity log could not be recorded", {
              bookingId,
              message: activityLogError?.message,
            });
          }
        }
      }

      if (newStatus === "confirmed") {
        toast.success("Booking approved and payment marked as manually verified.");
      } else if (newStatus === "completed") {
        toast.success("Reservation marked as completed.");
      }

      await queryClient.refetchQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["admin-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["my-bookings"] });
      closeSelectedBooking();
    } catch (error) {
      if (String(error?.status || "").toLowerCase() === "declined") {
        await queryClient.refetchQueries({ queryKey: ["admin-all-bookings"] });
        await queryClient.refetchQueries({ queryKey: ["calendar-bookings"] });
        toast.error(error?.reason || "This receipt was declined and cannot be approved.");
        closeSelectedBooking();
        return;
      }
      toast.error(error?.message || "Unable to update reservation.");
    }
  };

  const confirmAcceptBooking = async () => {
    if (!acceptBookingTarget) return;
    setIsAcceptingBooking(true);
    try {
      await updateStatus(acceptBookingTarget.id, "confirmed");
    } finally {
      setIsAcceptingBooking(false);
      setAcceptBookingTarget(null);
    }
  };

  const confirmCompleteBooking = async () => {
    if (!completeBookingTarget) return;
    setIsCompletingBooking(true);
    try {
      await updateStatus(completeBookingTarget.id, "completed");
    } finally {
      setIsCompletingBooking(false);
      setCompleteBookingTarget(null);
    }
  };

  const rejectSelectedBooking = async () => {
    if (!selectedBooking) return;
    const reason = rejectionReason.trim();
    if (reason.length < 5) {
      toast.error("Enter a rejection reason with at least 5 characters.");
      return;
    }
    try {
      await baseClient.entities.Booking.reject(selectedBooking.id, reason);
      toast.success("Booking rejected. The customer can now see the updated status.");
      setRejectionReason("");
      await queryClient.refetchQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["admin-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["my-bookings"] });
      closeSelectedBooking();
    } catch (error) {
      toast.error(error?.message || "Unable to reject reservation.");
    }
  };

  const resolveRescheduleRequest = async (decision) => {
    if (!selectedRescheduleRequest) return;
    setRescheduleDecision(decision);
    try {
      if (decision === "approved") {
        await baseClient.entities.Booking.reschedule(
          selectedRescheduleRequest.id,
          undefined,
          rescheduleDecisionNote.trim()
        );
      } else {
        await baseClient.entities.Booking.rejectReschedule(
          selectedRescheduleRequest.id,
          rescheduleDecisionNote.trim()
        );
      }
      toast.success(decision === "approved" ? "Reschedule request approved." : "Reschedule request declined.");
      setSelectedRescheduleRequest(null);
      setRescheduleDecisionNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);
    } catch (error) {
      toast.error(error?.message || "Unable to resolve this reschedule request.");
    } finally {
      setRescheduleDecision("");
    }
  };

  return (
    <div className="bg-muted/20">
      <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
            <div>
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                Reservation management
              </Badge>
              <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Manage resort reservations with confidence.
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Review guest bookings, payment verification, arrival dates, and approval actions from one organized workspace.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reservations tracked</p>
                  <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">Needs review</p>
                  <p className="mt-1 font-semibold text-warning">{metrics.pending}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">Payment checks</p>
                  <p className="mt-1 font-semibold text-primary">{metrics.pendingPayments}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Clock3}
            label="Pending"
            value={metrics.pending}
            helper="Awaiting resort review"
            tone="text-warning"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Approved"
            value={metrics.confirmed}
            helper="Approved active bookings"
            tone="text-success"
          />
          <MetricCard
            icon={CheckCheck}
            label="Completed"
            value={metrics.completed}
            helper="Finished guest stays"
            tone="text-muted-foreground"
          />
          <MetricCard
            icon={CreditCard}
            label="Booked Value"
            value={formatMoney(metrics.expectedRevenue)}
            helper="Excludes cancelled bookings"
            tone="text-primary"
          />
        </section>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Reschedule Requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Customer requests wait for approval; the existing reservation stays active until then.</p>
            </div>
            <Badge variant="outline" className={pendingRescheduleRequests.length ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-muted text-muted-foreground"}>
              {pendingRescheduleRequests.length} pending
            </Badge>
          </div>
          {pendingRescheduleRequests.length ? (
            <div className="divide-y divide-border">
              {pendingRescheduleRequests.map((booking) => (
                <div key={booking.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-foreground">{booking.booking_reference || booking.id}</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{booking.customer_name || "Guest"} · {booking.package_name || "Package"}{booking.rebooking_requested_package_name && booking.rebooking_requested_package_name !== booking.package_name ? ` → ${booking.rebooking_requested_package_name}` : ""}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{tourLabels[booking.tour_type] || booking.tour_type || "Tour"}: {formatDate(booking.booking_date)} → {formatDate(booking.rebooking_requested_date)}</p>
                    {booking.rebooking_reason ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Note: {booking.rebooking_reason}</p> : null}
                  </div>
                  <Button variant="outline" className="gap-2 sm:justify-self-end" onClick={() => { setSelectedRescheduleRequest(booking); setRescheduleDecisionNote(""); }}>
                    <CalendarPlus className="h-4 w-4" /> Review Request
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">There are no reschedule requests awaiting review.</p>
          )}
        </section>

        <FullCalendarView embedded />

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Reservation Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredBookings.length} matching of {activeBookings.length} active reservation{activeBookings.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {selectedArchiveIds.length > 0 ? (
                <Button
                  variant="outline"
                  className="gap-2 text-warning"
                  onClick={() => setIsBulkArchiveDialogOpen(true)}
                  disabled={isArchivingBooking}
                >
                  <Archive className="h-4 w-4" /> Archive selected ({selectedArchiveIds.length})
                </Button>
              ) : null}
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search reservations"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[1300px] table-fixed">
                  <colgroup>
                    <col className="w-[52px]" />
                    <col className="w-[150px]" />
                    <col className="w-[136px]" />
                    <col className="w-[120px]" />
                    <col className="w-[210px]" />
                    <col className="w-[125px]" />
                    <col className="w-[150px]" />
                    <col className="w-[165px]" />
                    <col className="w-[165px]" />
                    <col className="w-[169px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all visible reservations for archive"
                          checked={visibleBookings.length > 0 && visibleBookings.every((booking) => selectedArchiveIds.includes(booking.id))}
                          onChange={toggleAllVisibleArchiveSelection}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead className="px-2">Package</TableHead>
                      <TableHead className="text-center">Schedule</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Submitted Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBookings.length ? (
                      visibleBookings.map((booking) => (
                        <TableRow key={booking.id} className="align-top">
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select reservation ${booking.booking_reference || booking.id} for archive`}
                              checked={selectedArchiveIds.includes(booking.id)}
                              onChange={() => toggleArchiveSelection(booking.id)}
                              className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm font-semibold text-foreground">{booking.booking_reference || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(booking.created_date)}</p>
                          </TableCell>
                          <TableCell className="max-w-[136px] overflow-hidden align-top">
                            <div className="w-full min-w-0 py-1">
                              <p className="truncate text-sm font-semibold leading-5 text-foreground">{booking.customer_name || "Guest user"}</p>
                              <p className="truncate text-xs leading-4 text-muted-foreground">{booking.customer_email || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-2">
                            <p className="font-medium text-foreground">{booking.package_name || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{tourLabels[booking.tour_type] || booking.tour_type || "-"}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <p className="font-medium text-foreground">{formatDate(booking.booking_date)}</p>
                            <p className="mt-1 inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {booking.guest_count || 0} guest{Number(booking.guest_count || 0) === 1 ? "" : "s"}
                            </p>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">{formatMoney(booking.total_amount)}</TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold text-primary">{formatMoney(getSubmittedPaymentAmount(booking))}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{paymentTypeLabels[booking.payment_type] || "Downpayment"}</p>
                          </TableCell>
                          <TableCell>
                            {isOutdatedReceipt(booking) ? (
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant="outline" className={`min-h-8 min-w-[128px] justify-center whitespace-nowrap uppercase ${statusColors.rejected}`}>
                                  Declined
                                </Badge>
                                <span className="pl-1 text-[11px] leading-4 text-destructive uppercase">Outdated receipt</span>
                              </div>
                            ) : (
                              <Badge variant="outline" className={`min-h-8 min-w-[128px] justify-center whitespace-nowrap uppercase ${statusColors[booking.status] || statusColors.pending}`}>
                                {isBookingExpired(booking) && !["completed", "cancelled", "rejected"].includes(booking.status) ? "expired" : bookingStatusLabel(booking)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`min-h-8 min-w-[128px] max-w-[128px] justify-center whitespace-normal break-words text-center leading-4 uppercase ${paymentColors[booking.payment_status] || paymentColors.unpaid}`}>
                              {(booking.payment_status || "unpaid").replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="View reservation" onClick={() => setSelectedBooking(booking)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                                {booking.status === "confirmed" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 min-w-[104px] shrink-0 gap-2 whitespace-nowrap border-success/40 bg-success/10 px-3 font-semibold text-success hover:bg-success/20 hover:text-success"
                                    title={isBookingDateToday(booking) ? "Mark as completed" : "Available on the booking date"}
                                    disabled={!isBookingDateToday(booking)}
                                    onClick={() => setCompleteBookingTarget(booking)}
                                  >
                                    <CheckCheck className="h-4 w-4" />
                                    Complete
                                  </Button>
                                )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                title="Archive booking"
                                onClick={() => setArchiveBookingTarget(booking)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="py-16 text-center">
                          <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                          <p className="mt-3 font-medium text-foreground">No reservations found</p>
                          <p className="mt-1 text-sm text-muted-foreground">Try a different status filter or search keyword.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <PaginationControls
            page={currentQueuePage}
            pageSize={queuePageSize}
            total={filteredBookings.length}
            onPageChange={setQueuePage}
            onPageSizeChange={(size) => { setQueuePageSize(size); setQueuePage(1); }}
          />
        </section>

        <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && closeSelectedBooking()}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Reservation Details</DialogTitle>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-primary">{selectedBooking.booking_reference}</p>
                      <h3 className="mt-1 text-xl font-bold text-foreground">{selectedBooking.package_name || "Selected package"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tourLabels[selectedBooking.tour_type] || selectedBooking.tour_type || "Selected tour"} on {formatDate(selectedBooking.booking_date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={statusColors[selectedBooking.status] || statusColors.pending}>
                        {isBookingExpired(selectedBooking) && !["completed", "cancelled", "rejected"].includes(selectedBooking.status) ? "expired" : bookingStatusLabel(selectedBooking)}
                      </Badge>
                      <Badge variant="outline" className={paymentColors[paymentStatusLabel(selectedBooking).replace(/ /g, "_")] || paymentColors.unpaid}>
                        {paymentStatusLabel(selectedBooking)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Customer">{selectedBooking.customer_name || "Guest"}</DetailItem>
                  <DetailItem label="Email">
                    <span className="break-all">{selectedBooking.customer_email || "-"}</span>
                  </DetailItem>
                  <DetailItem label="Phone">{selectedBooking.customer_phone || "-"}</DetailItem>
                  <DetailItem label="Guests">{selectedBooking.guest_count || 0}</DetailItem>
                  <DetailItem label="Total Amount">{formatMoney(selectedBooking.total_amount)}</DetailItem>
                  <DetailItem label="Payment Type">{paymentTypeLabels[selectedBooking.payment_type] || "Downpayment"}</DetailItem>
                  <DetailItem label="Amount Submitted">{formatMoney(getSubmittedPaymentAmount(selectedBooking))}</DetailItem>
                  <DetailItem label="Reservation Fee">{formatMoney(selectedBooking.reservation_fee_amount)}</DetailItem>
                  <DetailItem label="Mode of Payment">{getPaymentChannel(selectedBooking)}</DetailItem>
                  <DetailItem label="Payment Number">{selectedBooking.payment_number || "Not provided"}</DetailItem>
                  <DetailItem label="Payment Reference Number">{selectedBooking.payment_reference_number || "Not provided"}</DetailItem>
                  <DetailItem label="Booked Date">{formatDate(selectedBooking.created_date)}</DetailItem>
                  {selectedBooking.approved_at ? <DetailItem label="Approved At">{formatDate(selectedBooking.approved_at)}</DetailItem> : null}
                  {selectedBooking.rejected_at ? <DetailItem label="Rejected At">{formatDate(selectedBooking.rejected_at)}</DetailItem> : null}
                  <DetailItem label="Stay Date">{formatDate(selectedBooking.booking_date)}</DetailItem>
                </div>

                {selectedBooking.rejection_reason ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                    <span className="font-medium text-destructive">Rejection reason</span>
                    <p className="mt-1 whitespace-pre-wrap">{selectedBooking.rejection_reason}</p>
                  </div>
                ) : null}

                {selectedBooking.receipt_url ? (
                  <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                    <p><span className="text-muted-foreground">OCR provider:</span> {selectedBooking.payment_proof_ocr_provider || "Not detected"}</p>
                    <p><span className="text-muted-foreground">OCR amount:</span> {selectedBooking.payment_proof_ocr_amount ? formatMoney(selectedBooking.payment_proof_ocr_amount) : "Not detected"}</p>
                    <p className="break-all"><span className="text-muted-foreground">OCR reference:</span> {selectedBooking.payment_proof_ocr_reference || "Not detected"}</p>
                    <p><span className="text-muted-foreground">OCR date:</span> {selectedBooking.payment_proof_ocr_date || "Not detected"}</p>
                    <p><span className="text-muted-foreground">OCR confidence:</span> {Number(selectedBooking.payment_proof_ocr_confidence || 0).toFixed(0)}%</p>
                    <p className="text-muted-foreground sm:col-span-2">OCR output is a reading aid only and does not authenticate payment. Admin must verify the original proof and transaction.</p>
                  </div>
                ) : null}

                {selectedBooking.receipt_url ? (
                  <PaymentProof src={selectedBooking.receipt_url} />
                ) : (
                  <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    {selectedBooking.payment_status === "unpaid" ? "No payment proof submitted." : "Payment proof unavailable."}
                  </p>
                )}

                {selectedBooking.special_requests && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-sm font-medium text-muted-foreground">Special Requests</span>
                    <p className="mt-2 text-sm text-foreground">{selectedBooking.special_requests}</p>
                  </div>
                )}

                {selectedBooking.status === "pending" && selectedBooking.payment_status !== "declined" && !isBookingExpired(selectedBooking) && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Button className="w-full gap-2" onClick={() => setAcceptBookingTarget(selectedBooking)}>
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Booking
                    </Button>
                    <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <Label htmlFor="booking-rejection-reason">Rejection reason *</Label>
                      <p className="text-xs text-muted-foreground">Choose a suggested reason, then edit it if you need to add details.</p>
                      <div className="flex flex-wrap gap-2">
                        {rejectionReasonSuggestions.map(({ label, reason }) => (
                          <Button
                            key={label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto whitespace-normal px-2 py-1.5 text-left text-xs"
                            onClick={() => setRejectionReason(reason)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <Textarea id="booking-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={1000} placeholder="Explain why this booking cannot be approved." />
                      <Button type="button" variant="destructive" className="w-full" onClick={rejectSelectedBooking} disabled={rejectionReason.trim().length < 5}>
                        Reject Booking
                      </Button>
                    </div>
                  </div>
                )}
                {selectedBooking.status === "confirmed" && (
                  <div className="border-t border-border pt-4">
                    <Button className="w-full gap-2" onClick={() => setCompleteBookingTarget(selectedBooking)} disabled={!isBookingDateToday(selectedBooking)} title={isBookingDateToday(selectedBooking) ? "Mark as completed" : "Available on the booking date"}>
                      <CheckCheck className="h-4 w-4" />
                      Complete Booking
                    </Button>
                    {!isBookingDateToday(selectedBooking) ? <p className="mt-2 text-center text-xs text-muted-foreground">Available on the booking date.</p> : null}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedRescheduleRequest} onOpenChange={(open) => { if (!open && !rescheduleDecision) setSelectedRescheduleRequest(null); }}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Review Reschedule Request</DialogTitle>
            </DialogHeader>
            {selectedRescheduleRequest ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <DetailItem label="Customer">{selectedRescheduleRequest.customer_name || "Guest"}</DetailItem>
                  <DetailItem label="Booking ID"><span className="break-all font-mono">{selectedRescheduleRequest.id}</span></DetailItem>
                  <DetailItem label="Current date">{formatDate(selectedRescheduleRequest.booking_date)}</DetailItem>
                  <DetailItem label="Requested date">{formatDate(selectedRescheduleRequest.rebooking_requested_date)}</DetailItem>
                  <DetailItem label="Current package / tour">{selectedRescheduleRequest.package_name} · {tourLabels[selectedRescheduleRequest.tour_type] || selectedRescheduleRequest.tour_type}</DetailItem>
                  <DetailItem label="Requested package / tour">{selectedRescheduleRequest.rebooking_requested_package_name || selectedRescheduleRequest.package_name} · {tourLabels[selectedRescheduleRequest.tour_type] || selectedRescheduleRequest.tour_type}</DetailItem>
                  <DetailItem label="Remaining balance payable at resort">{Number(selectedRescheduleRequest.rebooking_additional_payment_amount || 0) > 0 ? `PHP ${Number(selectedRescheduleRequest.rebooking_additional_payment_amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "None"}</DetailItem>
                  <DetailItem label="Request received">{formatDate(selectedRescheduleRequest.rebooking_requested_at, "MMM d, yyyy h:mm a")}</DetailItem>
                </div>
                {selectedRescheduleRequest.rebooking_reason ? (
                  <div className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">Customer note</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedRescheduleRequest.rebooking_reason}</p></div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="reschedule-decision-note">Decision note (optional)</Label>
                  <Textarea id="reschedule-decision-note" value={rescheduleDecisionNote} onChange={(event) => setRescheduleDecisionNote(event.target.value)} maxLength={500} rows={3} />
                </div>
                <p className="text-xs text-muted-foreground">Availability is checked again when approving. The current date remains active unless approval succeeds.</p>
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => setSelectedRescheduleRequest(null)} disabled={!!rescheduleDecision}>Close</Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="destructive" onClick={() => resolveRescheduleRequest("declined")} disabled={!!rescheduleDecision}>
                  {rescheduleDecision === "declined" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
                </Button>
                <Button onClick={() => resolveRescheduleRequest("approved")} disabled={!!rescheduleDecision}>
                  {rescheduleDecision === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve Request"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(acceptBookingTarget)} onOpenChange={(open) => { if (!open && !isAcceptingBooking) setAcceptBookingTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept this booking request?</AlertDialogTitle>
              <AlertDialogDescription>
                Accept {acceptBookingTarget?.booking_reference || "this booking"} for {formatDate(acceptBookingTarget?.booking_date)}? This confirms the reservation and marks its submitted payment as manually verified. You can accept it until the tour checkout time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isAcceptingBooking}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={isAcceptingBooking} onClick={(event) => { event.preventDefault(); void confirmAcceptBooking(); }}>
                {isAcceptingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isAcceptingBooking ? "Accepting…" : "Accept booking"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(completeBookingTarget)} onOpenChange={(open) => { if (!open && !isCompletingBooking) setCompleteBookingTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete this reservation?</AlertDialogTitle>
              <AlertDialogDescription>
                {Number(completeBookingTarget?.rebooking_additional_payment_amount || 0) > 0
                  ? <>This reservation has a remaining package balance of <strong className="text-foreground">PHP {Number(completeBookingTarget.rebooking_additional_payment_amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. Confirm that the guest paid this amount at the resort before marking the reservation complete.</>
                  : <>Mark {completeBookingTarget?.booking_reference || "this reservation"} as completed?</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCompletingBooking}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={isCompletingBooking} onClick={(event) => { event.preventDefault(); void confirmCompleteBooking(); }}>
                {isCompletingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                {isCompletingBooking ? "Completing…" : "Confirm and complete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(archiveBookingTarget)} onOpenChange={(open) => { if (!open && !isArchivingBooking) setArchiveBookingTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to archive booking {archiveBookingTarget?.booking_reference || "this booking"}? It will be removed from the active reservations list and can be viewed in the archive.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isArchivingBooking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isArchivingBooking}
                onClick={(event) => { event.preventDefault(); void archiveBooking(archiveBookingTarget?.id); }}
              >
                {isArchivingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                Archive booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isBulkArchiveDialogOpen} onOpenChange={(open) => { if (!open && !isArchivingBooking) setIsBulkArchiveDialogOpen(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive selected reservations?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to archive {selectedArchiveIds.length} selected reservation{selectedArchiveIds.length === 1 ? "" : "s"}? You can restore them later from the Archive page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isArchivingBooking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isArchivingBooking || selectedArchiveIds.length === 0}
                onClick={(event) => { event.preventDefault(); void archiveSelectedBookings(); }}
              >
                {isArchivingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                Archive selected
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
