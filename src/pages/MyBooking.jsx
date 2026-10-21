import React, { useEffect, useMemo, useState } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, resortCalendarClassNames } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Hash,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import LeaveReviewDialog from "@/components/mybookings/LeaveReviewDialog.jsx";
import { addDays, format } from "date-fns";
import { calendarDaysUntil, getBookingEndDateTime as getBookingEndTime, getBookingStartDateTime } from "@/lib/bookingTimes";
import { bookingSchedulesOverlap, tourCrossesMidnight } from "@/lib/bookingSchedule";
import { createPageUrl } from "@/utils";
import { resolveAssetUrl } from "@/lib/assetUrls";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  confirmed: "border-primary/20 bg-primary/10 text-primary",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  completed: "border-border bg-muted text-muted-foreground",
  archived: "border-border bg-muted text-muted-foreground",
};

const paymentColors = {
  unpaid: "bg-destructive/10 text-destructive",
  pending_verification: "bg-warning/10 text-warning",
  paid: "bg-primary/10 text-primary",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

const getDisplayPaymentStatus = (booking) => {
  return booking?.status === "rejected" ? "declined" : booking?.payment_status || "unpaid";
};

const formatStatusLabel = (value) => (value || "unpaid").replace(/_/g, " ");

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const tourTimeLabels = {
  day_tour: { start: "8:00 AM", end: "6:00 PM" },
  night_tour: { start: "6:00 PM", end: "6:00 AM (next day)" },
  "22_hours": { start: "6:00 PM", end: "4:00 PM (next day)" },
};

const paymentTypeLabels = {
  downpayment: "Downpayment",
  full_payment: "Full Payment",
};

const statusFilters = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const formatMoneyWithCents = (value) => `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CANCELLATION_NOTICE_DAYS = 7;
const RESCHEDULE_CUTOFF_DAYS = 7;
const ADDITIONAL_GUEST_RATE = 150;
const getPackageTotal = (packageRecord, tourType, guestCount) => {
  if (!packageRecord) return 0;
  const priceField = tourType === "night_tour" ? "night_tour_price" : tourType === "22_hours" ? "twenty_two_hour_price" : "day_tour_price";
  const basePrice = Number(packageRecord[priceField] ?? packageRecord.price ?? 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  const includedGuests = Math.max(1, Math.trunc(Number(packageRecord.max_guests) || 1));
  return Number((basePrice + Math.max(0, Number(guestCount || 0) - includedGuests) * ADDITIONAL_GUEST_RATE).toFixed(2));
};

const formatDate = (value) => {
  if (!value) {
    return "No date";
  }

  try {
    const dateKey = String(value).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${dateKey}T00:00:00.000Z`));
    }
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
};

const canLeaveReview = (booking) => {
  if (!booking || booking.status !== "completed") {
    return false;
  }

  const endTime = getBookingEndTime(booking);
  if (!endTime) {
    return false;
  }

  return Date.now() >= endTime.getTime();
};

const getDismissedReviewStorageKey = (email) => `kasa-ilaya-dismissed-reviews:${email || "guest"}`;

const canCancelBooking = (booking) => {
  return (
    ["pending", "confirmed"].includes(booking?.status) &&
    getCancellationLockedReason(booking) === ""
  );
};

const getCancellationLockedReason = (booking) => {
  if (!booking || ["cancelled", "completed", "archived"].includes(booking.status)) {
    return "";
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    return "Only active bookings can be cancelled online.";
  }

  const daysUntilBooking = calendarDaysUntil(booking.booking_date);
  if (daysUntilBooking === null) {
    return "This booking date cannot be checked for cancellation.";
  }

  if (daysUntilBooking <= 0) {
    return "Reservations on today or past dates cannot be cancelled online.";
  }

  if (daysUntilBooking <= CANCELLATION_NOTICE_DAYS) {
    return getRescheduleDeadlineReason(booking)
      ? "Cancellation is closed within 7 calendar days, and the reschedule deadline has passed."
      : "Cancellation is closed within 7 calendar days. You may request a reschedule until 7 days before the tour begins.";
  }

  return "";
};

const getRebookingLockedReason = (booking) => {
  if (!booking) {
    return "Select a booking first.";
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    return "Only active bookings can request rescheduling.";
  }

  if ((booking.rebooking_status || "none") === "pending") {
    return "This booking already has a pending rebooking request.";
  }

  if (Number(booking.rebooking_count || 0) >= 1) {
    return "This booking has already used its one allowed rebooking.";
  }

  if (getRescheduleDeadlineReason(booking)) {
    return getRescheduleDeadlineReason(booking);
  }

  return "";
};

const getRescheduleDeadlineReason = (booking) => {
  const startTime = getBookingStartDateTime(booking);
  if (!startTime) return "This booking's reschedule deadline cannot be checked.";
  const cutoff = startTime.getTime() - RESCHEDULE_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() >= cutoff ? "Rescheduling is unavailable starting 7 days before the tour begins." : "";
};

const canRequestRebooking = (booking) => getRebookingLockedReason(booking) === "";

const dateInputValue = (date) => format(date, "yyyy-MM-dd");
const createDateFromKey = (value) => (value ? new Date(`${value}T00:00:00`) : undefined);

export default function MyBookings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [unavailableReceiptUrl, setUnavailableReceiptUrl] = useState("");
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [bookingToRebook, setBookingToRebook] = useState(null);
  const [rebookingForm, setRebookingForm] = useState({ requested_date: "", package_id: "", note: "" });
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [isRequestingRebooking, setIsRequestingRebooking] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [dismissedReviewBookingIds, setDismissedReviewBookingIds] = useState([]);
  const [submittedReviewBookingIds, setSubmittedReviewBookingIds] = useState([]);
  const [hasLoadedDismissedReviewState, setHasLoadedDismissedReviewState] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {
      baseClient.auth.redirectToLogin(window.location.href);
    }).finally(() => setIsLoadingUser(false));
  }, []);

  useEffect(() => {
    if (!user?.email || typeof window === "undefined") {
      setDismissedReviewBookingIds([]);
      setHasLoadedDismissedReviewState(false);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(getDismissedReviewStorageKey(user.email));
      const parsed = stored ? JSON.parse(stored) : [];
      setDismissedReviewBookingIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDismissedReviewBookingIds([]);
    } finally {
      setHasLoadedDismissedReviewState(true);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      getDismissedReviewStorageKey(user.email),
      JSON.stringify(dismissedReviewBookingIds)
    );
  }, [dismissedReviewBookingIds, user?.email]);

  const { data: bookings = [], isLoading, isError, error: bookingsError, refetch: refetchBookings } = useQuery({
    queryKey: ["my-bookings", user?.email],
    queryFn: () => baseClient.entities.Booking.filter({ customer_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["my-booking-reviews", user?.email],
    queryFn: () => baseClient.entities.Review.filter({ guest_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const { data: rebookingAvailability = { booking_dates: [], manual_schedule_dates: [] }, isLoading: isLoadingRebookingAvailability, isError: isRebookingAvailabilityError } = useQuery({
    queryKey: ["rebooking-availability", bookingToRebook?.id],
    queryFn: () => baseClient.entities.Booking.availability(bookingToRebook.id),
    enabled: !!bookingToRebook,
    refetchInterval: 15000,
  });

  const { data: activePackages = [], isLoading: isLoadingReschedulePackages } = useQuery({
    queryKey: ["active-packages-for-reschedule"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: true }, "name"),
    enabled: !!bookingToRebook,
  });

  const rebookingAvailabilityBookings = rebookingAvailability.booking_dates || [];

  const reviewedBookingIds = new Set(reviews.map((review) => review.booking_id));
  const blockedReviewBookingIds = new Set([...submittedReviewBookingIds, ...reviews.map((review) => review.booking_id)]);

  const eligibleReviewBookings = useMemo(
    () => bookings.filter(
      (booking) =>
        canLeaveReview(booking) &&
        !blockedReviewBookingIds.has(booking.id) &&
        !dismissedReviewBookingIds.includes(booking.id)
    ),
    [bookings, blockedReviewBookingIds, dismissedReviewBookingIds]
  );

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesSearch = !query || [
        booking.booking_reference,
        booking.package_name,
        booking.tour_type,
        booking.payment_status,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [bookings, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const upcoming = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status)).length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const paid = bookings.filter((booking) => booking.payment_status === "paid").length;
    const totalSpend = bookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

    return {
      total: bookings.length,
      upcoming,
      completed,
      paid,
      totalSpend,
    };
  }, [bookings]);

  const rebookingManualScheduleDates = useMemo(
    () => new Set(rebookingAvailability.manual_schedule_dates || []),
    [rebookingAvailability.manual_schedule_dates]
  );

  const rebookingOccupiedDates = useMemo(() => {
    const occupied = new Set(rebookingManualScheduleDates);
    rebookingAvailabilityBookings.forEach((booking) => {
      if (!booking.booking_date) return;
      occupied.add(booking.booking_date);
      if (booking.tour_type === "22_hours") {
        occupied.add(format(addDays(createDateFromKey(booking.booking_date), 1), "yyyy-MM-dd"));
      }
    });
    return occupied;
  }, [rebookingAvailabilityBookings, rebookingManualScheduleDates]);

  const rebookingReservedDates = useMemo(() => {
    if (!bookingToRebook) {
      return [];
    }

    return [...rebookingOccupiedDates]
      .map((date) => createDateFromKey(date))
      .filter(Boolean);
  }, [bookingToRebook, rebookingOccupiedDates]);

  const rebookingManualDates = useMemo(
    () => [...rebookingManualScheduleDates].map(createDateFromKey).filter(Boolean),
    [rebookingManualScheduleDates]
  );

  const selectedRebookingDate = createDateFromKey(rebookingForm.requested_date);
  const isCheckingRebookingDate = isLoadingRebookingAvailability;
  const currentRebookingPackageId = bookingToRebook?.package_id || "__current_package__";
  const rebookingPackages = useMemo(() => {
    if (!bookingToRebook) return activePackages;
    if (activePackages.some((packageRecord) => String(packageRecord.id) === String(bookingToRebook.package_id))) return activePackages;
    return [{ id: currentRebookingPackageId, name: bookingToRebook.package_name || "Current package", max_guests: bookingToRebook.included_guest_count || 1 }, ...activePackages];
  }, [activePackages, bookingToRebook, currentRebookingPackageId]);
  const selectedRebookingPackage = rebookingPackages.find((packageRecord) => String(packageRecord.id) === String(rebookingForm.package_id)) || null;
  const hasNewRebookingPackage = Boolean(rebookingForm.package_id)
    && String(rebookingForm.package_id) !== String(currentRebookingPackageId);
  const quotedRebookingTotal = hasNewRebookingPackage
    ? getPackageTotal(selectedRebookingPackage, bookingToRebook?.tour_type, bookingToRebook?.guest_count)
    : Number(bookingToRebook?.total_amount || 0);
  const selectedRebookingTotal = Math.max(Number(bookingToRebook?.total_amount || 0), quotedRebookingTotal);
  const verifiedBookingPayment = bookingToRebook?.payment_status === "paid"
    ? Number(bookingToRebook?.payment_amount_due || bookingToRebook?.reservation_fee_amount || 0)
    : 0;
  const rebookingAdditionalPayment = hasNewRebookingPackage
    ? Math.max(0, Number((selectedRebookingTotal - verifiedBookingPayment).toFixed(2)))
    : 0;

  const getRebookingConflictBookings = (date, booking = bookingToRebook) => {
    if (!date || !booking) return [];
    const dateKey = dateInputValue(date);
    return rebookingAvailabilityBookings.filter((existingBooking) =>
      bookingSchedulesOverlap(dateKey, booking.tour_type, existingBooking.booking_date, existingBooking.tour_type)
    );
  };

  const getRebookingDateIssue = (date, booking = bookingToRebook) => {
    if (!date || !booking) {
      return "";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestRebookingDate = addDays(today, 1);

    const dateKey = dateInputValue(date);

    if (date < earliestRebookingDate) {
      return "Please choose a future date for rebooking.";
    }

    if (dateKey === booking.booking_date) {
      return "This is your current reservation date. Please choose a different date.";
    }

    const nextDateKey = format(addDays(date, 1), "yyyy-MM-dd");
    if (rebookingManualScheduleDates.has(dateKey) || (tourCrossesMidnight(booking.tour_type) && rebookingManualScheduleDates.has(nextDateKey))) {
      return "This date is blocked by a resort schedule or event.";
    }

    if (getRebookingConflictBookings(date, booking).length > 0) {
      return "The selected schedule is unavailable. Please choose another date or time.";
    }

    return "";
  };

  const selectedRebookingConflicts = getRebookingConflictBookings(selectedRebookingDate);
  const selectedRebookingManualConflict = Boolean(selectedRebookingDate && bookingToRebook && (
    rebookingManualScheduleDates.has(dateInputValue(selectedRebookingDate))
    || (tourCrossesMidnight(bookingToRebook.tour_type) && rebookingManualScheduleDates.has(format(addDays(selectedRebookingDate, 1), "yyyy-MM-dd")))
  ));

  const isRebookingDateDisabled = (date) => Boolean(getRebookingDateIssue(date));

  const rebookingDateStatus = useMemo(() => {
    if (!bookingToRebook || !rebookingForm.requested_date) {
      return {
        tone: "muted",
        message: "Select a preferred date to check if the schedule is available.",
      };
    }

    if (isCheckingRebookingDate) {
      return {
        tone: "checking",
        message: "Checking schedule availability...",
      };
    }

    if (isRebookingAvailabilityError) {
      return {
        tone: "blocked",
        message: "Unable to load schedule availability. Please try again.",
      };
    }

    const issue = getRebookingDateIssue(selectedRebookingDate, bookingToRebook);

    if (issue) {
      return {
        tone: "blocked",
        message: issue,
      };
    }

    return {
      tone: "available",
      message: "This schedule is available. Submit it for resort approval.",
    };
  }, [bookingToRebook, isCheckingRebookingDate, isRebookingAvailabilityError, rebookingForm.requested_date, selectedRebookingDate, rebookingAvailabilityBookings, rebookingManualScheduleDates, rebookingOccupiedDates]);

  useEffect(() => {
    if (isLoadingReviews || !hasLoadedDismissedReviewState || !eligibleReviewBookings.length || reviewBooking) {
      return;
    }

    setReviewBooking(eligibleReviewBookings[0]);
  }, [eligibleReviewBookings, hasLoadedDismissedReviewState, isLoadingReviews, reviewBooking]);

  useEffect(() => {
    if (!reviewBooking?.id || isLoadingReviews) {
      return;
    }

    if (blockedReviewBookingIds.has(reviewBooking.id)) {
      setReviewBooking(null);
    }
  }, [blockedReviewBookingIds, isLoadingReviews, reviewBooking]);

  const handleReviewDismiss = () => {
    if (reviewBooking?.id) {
      setDismissedReviewBookingIds((prev) => (
        prev.includes(reviewBooking.id) ? prev : [...prev, reviewBooking.id]
      ));
    }

    setReviewBooking(null);
  };

  const handleReviewOpen = (booking) => {
    setDismissedReviewBookingIds((prev) => prev.filter((id) => id !== booking.id));
    setReviewBooking(booking);
  };

  const handleReviewSubmitted = () => {
    if (!reviewBooking?.id) {
      setReviewBooking(null);
      return;
    }

    const submittedBookingId = reviewBooking.id;

    setDismissedReviewBookingIds((prev) => prev.filter((id) => id !== submittedBookingId));
    setSubmittedReviewBookingIds((prev) => (
      prev.includes(submittedBookingId) ? prev : [...prev, submittedBookingId]
    ));

    queryClient.setQueryData(["my-booking-reviews", user?.email], (currentReviews = []) => {
      if (currentReviews.some((review) => review.booking_id === submittedBookingId)) {
        return currentReviews;
      }

      return [
        {
          id: `submitted-${submittedBookingId}`,
          booking_id: submittedBookingId,
          guest_email: user?.email,
        },
        ...currentReviews,
      ];
    });

    setReviewBooking(null);
    queryClient.invalidateQueries({ queryKey: ["my-booking-reviews"] });
    queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
  };

  const requestCancelBooking = (booking) => {
    if (!canCancelBooking(booking)) {
      toast.error(getCancellationLockedReason(booking) || "This booking can no longer be cancelled.");
      return;
    }

    setBookingToCancel(booking);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) {
      return;
    }

    if (!canCancelBooking(bookingToCancel)) {
      toast.error(getCancellationLockedReason(bookingToCancel) || "This booking can no longer be cancelled.");
      setBookingToCancel(null);
      return;
    }

    setIsCancellingBooking(true);

    try {
      await baseClient.entities.Booking.cancel(bookingToCancel.id);

      toast.success("Booking cancelled successfully.");
      setBookingToCancel(null);
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to cancel booking.");
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const requestRebooking = (booking) => {
    const lockedReason = getRebookingLockedReason(booking);
    if (lockedReason) {
      toast.error(lockedReason);
      return;
    }

    setBookingToRebook(booking);
    setRebookingForm({ requested_date: "", package_id: "", note: "" });
  };

  const handleRebookingRequest = async () => {
    if (!bookingToRebook) {
      return;
    }

    const lockedReason = getRebookingLockedReason(bookingToRebook);
    if (lockedReason) {
      toast.error(lockedReason);
      setBookingToRebook(null);
      return;
    }

    const requestedDate = rebookingForm.requested_date;
    if (!requestedDate) {
      toast.error("Please choose your new reservation date.");
      return;
    }

    if (hasNewRebookingPackage && !selectedRebookingPackage) {
      toast.error("Please choose an available package, or keep your current package.");
      return;
    }

    if (requestedDate === bookingToRebook.booking_date) {
      toast.error("Please choose a different date from your current booking.");
      return;
    }

    if (isCheckingRebookingDate) {
      toast.error("Please wait while the schedule availability is checked.");
      return;
    }

    const dateIssue = getRebookingDateIssue(createDateFromKey(requestedDate), bookingToRebook);
    if (dateIssue) {
      toast.error(dateIssue);
      return;
    }

    setIsRequestingRebooking(true);

    try {
      const updatedBooking = await baseClient.entities.Booking.requestReschedule(
        bookingToRebook.id,
        requestedDate,
        hasNewRebookingPackage ? rebookingForm.package_id : "",
        rebookingForm.note
      );

      toast.success("Reschedule request sent to the resort for review.");
      setBookingToRebook(null);
      setSelectedBooking(null);
      setRescheduleSuccess(updatedBooking);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["rebooking-availability"] }),
      ]);
    } catch (error) {
      const message = error?.message || "Something went wrong while rescheduling. Your existing reservation was not changed.";
      const requestReference = error?.request_id ? ` (Reference: ${error.request_id})` : "";
      toast.error(`${message}${requestReference}`);
    } finally {
      setIsRequestingRebooking(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <section className="border-b border-border bg-card">
        <div className="w-full app-content-container px-2 py-6 sm:px-3 lg:px-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Guest reservations
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">My Bookings</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Track reservation status, payment progress, rebooking requests, cancellation options, and post-stay reviews from one place.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to={createPageUrl("Packages")}>
                Browse Packages
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total bookings", value: summary.total, helper: "All reservations", icon: Package, tone: "text-foreground" },
              { label: "Upcoming", value: summary.upcoming, helper: "Pending or confirmed", icon: CalendarCheck, tone: "text-primary" },
              { label: "Completed", value: summary.completed, helper: "Finished stays", icon: CheckCircle2, tone: "text-success" },
              { label: "Total booked value", value: formatMoney(summary.totalSpend), helper: `${summary.paid} paid`, icon: CreditCard, tone: "text-secondary" },
            ].map(({ label, value, helper, icon: Icon, tone }) => (
              <div key={label} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full app-content-container px-2 py-6 sm:px-3 lg:px-4">
        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, package, tour, or payment status"
              className="h-11 w-full rounded-md border border-input bg-background px-3 pl-10 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={statusFilter === item.value ? "default" : "outline"}
                onClick={() => setStatusFilter(item.value)}
                className="shrink-0"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoadingUser || isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/20 py-16 text-center">
            <CardContent>
              <h3 className="font-display text-xl font-bold text-foreground">Could not load your bookings</h3>
              <p className="mt-2 text-muted-foreground">{bookingsError?.message || "The booking service could not be reached. Please try again."}</p>
              <Button type="button" className="mt-6" onClick={() => refetchBookings()}>Try again</Button>
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent>
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-display text-xl font-bold text-foreground">No Bookings Yet</h3>
              <p className="mt-2 text-muted-foreground">You have not made any reservations yet.</p>
              <Button asChild className="mt-6 gap-2">
                <Link to={createPageUrl("Packages")}>
                  View Packages
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredBookings.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <CardContent>
              <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
              <h3 className="font-display text-xl font-bold text-foreground">No bookings match your filters</h3>
              <p className="mt-2 text-muted-foreground">Try another status or search term.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {filteredBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden border-border/80 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                <CardContent className="p-0">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-2xl font-bold text-foreground">{booking.package_name || "Resort Package"}</h3>
                            <Badge className={statusColors[booking.status] || statusColors.pending} variant="outline">
                              {booking.status === "confirmed" ? "Approved" : booking.status === "rejected" ? "Declined" : (booking.status || "pending").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Reservation for {booking.guest_count || 0} guest{Number(booking.guest_count || 0) === 1 ? "" : "s"}.
                          </p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-sm text-muted-foreground">Total amount</p>
                          <p className="text-2xl font-bold text-secondary">{formatMoney(booking.total_amount)}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" />
                          {booking.booking_reference || booking.id}
                        </span>
                        <span className="flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-primary" />
                          {formatDate(booking.booking_date)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          {tourLabels[booking.tour_type] || booking.tour_type || "Tour"}
                        </span>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {booking.guest_count || 0} guests
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-3 border-t border-border bg-muted/25 p-5 lg:w-full lg:border-l lg:border-t-0">
                      <Badge className={`${paymentColors[getDisplayPaymentStatus(booking)] || paymentColors.unpaid} min-h-9 justify-center py-1.5`}>
                        {formatStatusLabel(getDisplayPaymentStatus(booking))}
                      </Badge>
                      {(booking.rebooking_status || "none") !== "none" ? (
                        <Badge variant="outline" className="justify-center py-1.5">
                          Reschedule {formatStatusLabel(booking.rebooking_status)}
                        </Badge>
                      ) : null}
                      {booking.rebooking_status === "approved" && Number(booking.rebooking_additional_payment_amount || 0) > 0 ? (
                        <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                          Package change balance: {formatMoneyWithCents(booking.rebooking_additional_payment_amount)}
                        </p>
                      ) : null}
                      <Button variant="outline" className="gap-2" onClick={() => setSelectedBooking(booking)}>
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      {canRequestRebooking(booking) ? (
                        <Button variant="outline" className="gap-2" onClick={() => requestRebooking(booking)}>
                          <CalendarPlus className="h-4 w-4" />
                          Request Reschedule
                        </Button>
                      ) : null}
                      {canCancelBooking(booking) ? (
                        <Button variant="destructive" className="gap-2" onClick={() => requestCancelBooking(booking)}>
                          <XCircle className="h-4 w-4" />
                          Cancel Booking
                        </Button>
                      ) : null}
                      {booking.payment_status === "paid" && canCancelBooking(booking) ? (
                        <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs leading-5 text-warning">
                          Payment is non-refundable.
                        </p>
                      ) : null}
                      {getCancellationLockedReason(booking) ? (
                        <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs leading-5 text-warning">
                          {getCancellationLockedReason(booking)}
                        </p>
                      ) : null}
                      {getRescheduleDeadlineReason(booking) ? (
                        <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs leading-5 text-warning">
                          {getRescheduleDeadlineReason(booking)}
                        </p>
                      ) : null}
                      {!isLoadingReviews && canLeaveReview(booking) && !blockedReviewBookingIds.has(booking.id) && !reviewedBookingIds.has(booking.id) ? (
                        <Button
                          variant="outline"
                          className="gap-2 border-secondary/40 text-secondary hover:bg-secondary/10"
                          onClick={() => handleReviewOpen(booking)}
                        >
                          <Star className="h-4 w-4" />
                          Leave Review
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {reviewBooking && (
        <LeaveReviewDialog
          booking={reviewBooking}
          open={!!reviewBooking}
          onClose={handleReviewDismiss}
          onSubmitted={handleReviewSubmitted}
        />
      )}

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="font-display text-xl font-bold text-foreground">{selectedBooking.package_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedBooking.booking_reference}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Detail label="Status">
                  <Badge className={statusColors[selectedBooking.status]} variant="outline">{selectedBooking.status === "confirmed" ? "Approved" : selectedBooking.status === "rejected" ? "Declined" : selectedBooking.status}</Badge>
                </Detail>
                <Detail label="Payment">
                  <Badge className={`${paymentColors[getDisplayPaymentStatus(selectedBooking)] || paymentColors.unpaid} max-w-full whitespace-normal break-words`}>
                    {formatStatusLabel(getDisplayPaymentStatus(selectedBooking))}
                  </Badge>
                </Detail>
                <Detail label="Date">{formatDate(selectedBooking.booking_date)}</Detail>
                <Detail label="Tour">{tourLabels[selectedBooking.tour_type] || selectedBooking.tour_type}</Detail>
                <Detail label="Guests">{selectedBooking.guest_count}</Detail>
                <Detail label="Fixed pax included">{selectedBooking.included_guest_count || 1}</Detail>
                <Detail label="Total Amount"><span className="font-bold text-secondary">{formatMoney(selectedBooking.total_amount)}</span></Detail>
                <Detail label="Reservation Fee"><span className="font-bold text-primary">{formatMoney(selectedBooking.reservation_fee_amount)}</span></Detail>
                <Detail label="Payment Type">{paymentTypeLabels[selectedBooking.payment_type] || "Downpayment"}</Detail>
                <Detail label="Amount Submitted"><span className="font-bold text-primary">{formatMoney(selectedBooking.payment_amount_due || selectedBooking.reservation_fee_amount)}</span></Detail>
                <Detail label="Mode of Payment">{selectedBooking.payment_mode || selectedBooking.payment_qr_code_label || "Not selected"}</Detail>
                <Detail label="Payment Number">{selectedBooking.payment_number || "Not provided"}</Detail>
                <Detail label="Payment Reference Number">{selectedBooking.payment_reference_number || "Not provided"}</Detail>
                {(selectedBooking.rebooking_status || "none") !== "none" ? (
                  <>
                    <Detail label="Reschedule Status">{formatStatusLabel(selectedBooking.rebooking_status)}</Detail>
                    <Detail label="Previous Date">{formatDate(selectedBooking.rebooking_original_date || selectedBooking.booking_date)}</Detail>
                    <Detail label="New Date">{formatDate(selectedBooking.rebooking_requested_date)}</Detail>
                    {selectedBooking.rebooking_requested_package_name ? <Detail label="Requested Package">{selectedBooking.rebooking_requested_package_name}</Detail> : null}
                    {Number(selectedBooking.rebooking_additional_payment_amount || 0) > 0 && selectedBooking.rebooking_status !== "declined" ? <Detail label="Package balance payable at resort"><span className="font-semibold text-warning">{formatMoneyWithCents(selectedBooking.rebooking_additional_payment_amount)}{selectedBooking.rebooking_status === "approved" ? " due" : " if approved"}</span></Detail> : null}
                    <Detail label="Reschedule Count">{selectedBooking.rebooking_count || 0}</Detail>
                  </>
                ) : null}
              </div>

              {selectedBooking.rebooking_reason ? (
                <div>
                  <span className="text-sm text-muted-foreground">Rebooking Reason</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.rebooking_reason}</p>
                </div>
              ) : null}

              {selectedBooking.rejection_reason ? (
                <div>
                  <span className="text-sm text-muted-foreground">Decline reason</span>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6">{selectedBooking.rejection_reason}</p>
                </div>
              ) : null}

              {selectedBooking.rebooking_resolution_note ? (
                <div>
                  <span className="text-sm text-muted-foreground">Rebooking Decision Note</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.rebooking_resolution_note}</p>
                </div>
              ) : null}

              {selectedBooking.receipt_url ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Payment Proof</span>
                  {unavailableReceiptUrl === resolveAssetUrl(selectedBooking.receipt_url) ? (
                    <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="status">
                      This payment proof image is no longer available. Please contact the resort for help.
                    </p>
                  ) : (
                    <a href={resolveAssetUrl(selectedBooking.receipt_url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-muted/20">
                      <img
                        src={resolveAssetUrl(selectedBooking.receipt_url)}
                        alt="Payment proof"
                        onError={() => setUnavailableReceiptUrl(resolveAssetUrl(selectedBooking.receipt_url))}
                        className="max-h-[42vh] w-full bg-white object-contain sm:max-h-72"
                      />
                    </a>
                  )}
                </div>
              ) : null}

              {selectedBooking.special_requests ? (
                <div>
                  <span className="text-sm text-muted-foreground">Special Requests</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.special_requests}</p>
                </div>
              ) : null}

              {getCancellationLockedReason(selectedBooking) ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  {getCancellationLockedReason(selectedBooking)}
                </div>
              ) : null}
              {getRescheduleDeadlineReason(selectedBooking) ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  {getRescheduleDeadlineReason(selectedBooking)}
                </div>
              ) : null}
              {selectedBooking.payment_status === "paid" && canCancelBooking(selectedBooking) ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  Payment is non-refundable.
                </div>
              ) : null}

              {canRequestRebooking(selectedBooking) || canCancelBooking(selectedBooking) ? (
                <DialogFooter className="sm:justify-between">
                  {canRequestRebooking(selectedBooking) ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 sm:w-auto"
                      onClick={() => requestRebooking(selectedBooking)}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Request Reschedule
                    </Button>
                  ) : null}
                  {canCancelBooking(selectedBooking) ? (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => requestCancelBooking(selectedBooking)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                  ) : null}
                </DialogFooter>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!bookingToRebook}
        onOpenChange={(open) => {
          if (!open && !isRequestingRebooking) {
            setBookingToRebook(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto pb-0 sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reschedule Reservation</DialogTitle>
          </DialogHeader>
          {bookingToRebook ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-sm font-semibold text-muted-foreground">Current Reservation</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <Detail label="Booking ID"><span className="break-all font-mono">{bookingToRebook.id}</span></Detail>
                  <Detail label="Booking reference"><span className="break-all font-mono">{bookingToRebook.booking_reference || "Not available"}</span></Detail>
                  <Detail label="Package / venue">{bookingToRebook.package_name || "Resort reservation"}</Detail>
                  <Detail label="Current date">{formatDate(bookingToRebook.booking_date)}</Detail>
                  <Detail label="Start time">{tourTimeLabels[bookingToRebook.tour_type]?.start || "Not available"}</Detail>
                  <Detail label="End time">{tourTimeLabels[bookingToRebook.tour_type]?.end || "Not available"}</Detail>
                  <Detail label="Guests">{bookingToRebook.guest_count || 0}</Detail>
                  <Detail label="Payment status">{formatStatusLabel(getDisplayPaymentStatus(bookingToRebook))}</Detail>
                  <Detail label="Reservation status">{formatStatusLabel(bookingToRebook.status)}</Detail>
                </div>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-warning">
                <p className="font-semibold">Reschedule Policy</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>One reschedule request is allowed per active reservation, subject to resort approval and schedule availability.</li>
                  <li>Submit reschedule requests more than 7 days before the tour begins. Requests are closed during the final 7 days.</li>
                  <li>Choosing a different package is optional. The request can reschedule your booking with its current package.</li>
                  <li>If you choose another package, the remaining amount after your verified payment is due at the resort after approval. A lower package does not create a refund.</li>
                  <li>The original booking remains active until the resort approves the request.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reschedule-package">New package <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select
                  value={rebookingForm.package_id}
                  onValueChange={(packageId) => setRebookingForm((current) => ({ ...current, package_id: packageId === "__keep_current_package__" ? "" : packageId }))}
                  disabled={isLoadingReschedulePackages || isRequestingRebooking}
                >
                  <SelectTrigger id="reschedule-package">
                    <SelectValue placeholder={isLoadingReschedulePackages ? "Loading packages..." : `Keep current package${bookingToRebook?.package_name ? ` · ${bookingToRebook.package_name}` : ""}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep_current_package__">Keep current package</SelectItem>
                    {rebookingPackages.map((packageRecord) => {
                      const isCurrent = String(packageRecord.id) === String(currentRebookingPackageId);
                      const total = isCurrent ? Number(bookingToRebook.total_amount || 0) : getPackageTotal(packageRecord, bookingToRebook.tour_type, bookingToRebook.guest_count);
                      return (
                        <SelectItem key={packageRecord.id} value={String(packageRecord.id)} disabled={!isCurrent && total <= 0}>
                          {packageRecord.name} · {total > 0 ? formatMoney(total) : "Not available for this tour"}{isCurrent ? " (current)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="rebooking-date">New date</Label>
                <div className="mx-auto w-full max-w-[32rem] overflow-hidden rounded-xl border border-border bg-background p-2 sm:p-4">
                  <Calendar
                    id="rebooking-date"
                    mode="single"
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 3}
                    selected={selectedRebookingDate}
                    onSelect={(date) => {
                      setRebookingForm((current) => ({
                        ...current,
                        requested_date: date ? dateInputValue(date) : "",
                      }));
                    }}
                    disabled={isRebookingDateDisabled}
                    fromDate={addDays(new Date(), 1)}
                    modifiers={{
                      reserved: rebookingReservedDates,
                      manual: rebookingManualDates,
                      current: bookingToRebook.booking_date ? [createDateFromKey(bookingToRebook.booking_date)] : [],
                    }}
                    modifiersClassNames={{
                      reserved: "bg-destructive/15 text-destructive font-semibold ring-1 ring-inset ring-destructive/40 line-through",
                      manual: "bg-warning/10 text-warning font-semibold ring-1 ring-inset ring-warning/30 line-through",
                      current: "bg-primary/10 text-primary font-semibold ring-1 ring-inset ring-primary/30",
                    }}
                    classNames={resortCalendarClassNames}
                    className="mx-auto w-full p-0"
                  />
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-destructive/20 ring-1 ring-destructive/40" />
                    Reserved
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-warning/10 ring-1 ring-warning/30" />
                    Resort schedule
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-primary/10 ring-1 ring-primary/30" />
                    Current date
                  </span>
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    rebookingDateStatus.tone === "available"
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : rebookingDateStatus.tone === "blocked"
                        ? "border-destructive/25 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {rebookingDateStatus.message}
                </div>
                {(selectedRebookingManualConflict || selectedRebookingConflicts.length > 0) && (
                  <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm">
                    <p className="font-semibold text-destructive">Why this tour is unavailable</p>
                    {selectedRebookingManualConflict && (
                      <p className="text-xs text-muted-foreground">The selected tour overlaps a resort schedule or manual event.</p>
                    )}
                    {selectedRebookingConflicts.map((conflict) => (
                      <p key={`${conflict.id || conflict.booking_date}-${conflict.tour_type}`} className="text-xs text-muted-foreground">
                        {conflict.booking_date === dateInputValue(selectedRebookingDate)
                          ? `A ${tourLabels[conflict.tour_type] || conflict.tour_type} reservation is already scheduled for this date (${tourTimeLabels[conflict.tour_type]?.start || ""}${tourTimeLabels[conflict.tour_type] ? `–${tourTimeLabels[conflict.tour_type].end}` : ""}). This blocks the ${tourLabels[bookingToRebook?.tour_type] || "selected tour"} option.`
                          : `The ${tourLabels[conflict.tour_type] || conflict.tour_type} reservation starting ${formatDate(conflict.booking_date)} (${tourTimeLabels[conflict.tour_type]?.start || ""}${tourTimeLabels[conflict.tour_type] ? `–${tourTimeLabels[conflict.tour_type].end}` : ""}) overlaps your selected ${tourLabels[bookingToRebook?.tour_type] || "tour"} schedule.`}
                      </p>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reschedule-request-note">Reason or note (optional)</Label>
                  <Textarea
                    id="reschedule-request-note"
                    value={rebookingForm.note}
                    onChange={(event) => setRebookingForm((current) => ({ ...current, note: event.target.value }))}
                    maxLength={500}
                    rows={3}
                    placeholder="Add context for the resort team"
                  />
                </div>
              </div>

              {bookingToRebook ? (
                <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-foreground">Current schedule</p>
                    <p className="mt-1 text-muted-foreground">{formatDate(bookingToRebook.booking_date)} · {tourTimeLabels[bookingToRebook.tour_type]?.start} - {tourTimeLabels[bookingToRebook.tour_type]?.end}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">New schedule</p>
                    <p className="mt-1 text-muted-foreground">{selectedRebookingDate ? `${format(selectedRebookingDate, "MMM d, yyyy")} · ${tourTimeLabels[bookingToRebook.tour_type]?.start} - ${tourTimeLabels[bookingToRebook.tour_type]?.end}` : "Choose a date above"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-foreground"><span className="text-muted-foreground">Package:</span> {hasNewRebookingPackage ? selectedRebookingPackage?.name : `${bookingToRebook.package_name || "Current package"} (unchanged)`}</p>
                    {hasNewRebookingPackage ? (
                      <>
                        <p className="mt-1 text-foreground"><span className="text-muted-foreground">New package total:</span> {formatMoneyWithCents(selectedRebookingTotal)}</p>
                        <p className={`mt-1 font-semibold ${rebookingAdditionalPayment > 0 ? "text-warning" : "text-primary"}`}>
                          {rebookingAdditionalPayment > 0 ? `Remaining balance payable at the resort: ${formatMoneyWithCents(rebookingAdditionalPayment)}` : "No remaining package balance"}
                        </p>
                      </>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">Current payment status: {formatStatusLabel(getDisplayPaymentStatus(bookingToRebook))}.</p>
                  </div>
                </div>
              ) : null}

              <DialogFooter className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-4">
                <Button variant="outline" onClick={() => setBookingToRebook(null)} disabled={isRequestingRebooking}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRebookingRequest}
                  disabled={isRequestingRebooking || (hasNewRebookingPackage && (!selectedRebookingPackage || isLoadingReschedulePackages)) || rebookingDateStatus.tone !== "available"}
                  className="gap-2"
                >
                  {isRequestingRebooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  {isRequestingRebooking ? "Sending request..." : "Send Reschedule Request"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleSuccess} onOpenChange={(open) => !open && setRescheduleSuccess(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reschedule request submitted</DialogTitle>
          </DialogHeader>
          {rescheduleSuccess ? (
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <Detail label="Booking ID"><span className="break-all font-mono">{rescheduleSuccess.id}</span></Detail>
              <Detail label="Booking reference"><span className="break-all font-mono">{rescheduleSuccess.booking_reference || "Not available"}</span></Detail>
              <Detail label="Current date">{formatDate(rescheduleSuccess.booking_date)}</Detail>
              <Detail label="Requested date">{formatDate(rescheduleSuccess.rebooking_requested_date)}</Detail>
              <Detail label="Request status">Awaiting resort review</Detail>
              {rescheduleSuccess.rebooking_requested_package_name ? <Detail label="Requested package">{rescheduleSuccess.rebooking_requested_package_name}</Detail> : null}
              {Number(rescheduleSuccess.rebooking_additional_payment_amount || 0) > 0 ? <Detail label="Remaining balance payable at resort if approved">{formatMoneyWithCents(rescheduleSuccess.rebooking_additional_payment_amount)}</Detail> : null}
              <Detail label="Payment status">{formatStatusLabel(getDisplayPaymentStatus(rescheduleSuccess))}</Detail>
            </div>
          ) : null}
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={() => setRescheduleSuccess(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!bookingToCancel}
        onOpenChange={(open) => {
          if (!open && !isCancellingBooking) {
            setBookingToCancel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {bookingToCancel?.payment_status === "paid" ? (
                <span className="mb-2 block">Your booking can be cancelled, but payments are non-refundable according to the resort's cancellation policy.</span>
              ) : null}
              <span className="block">Are you sure you want to cancel this reservation?</span>
              <span className="mt-3 block space-y-1">
                <span className="block">Reference: {bookingToCancel?.booking_reference || "Not available"}</span>
                <span className="block">Date: {formatDate(bookingToCancel?.booking_date)}</span>
                <span className="block">Package: {bookingToCancel?.package_name || "Not available"}</span>
                <span className="block">Amount: {formatMoney(bookingToCancel?.total_amount)}</span>
              </span>
              {bookingToCancel?.payment_status === "paid" ? (
                <span className="mt-3 block font-medium text-destructive">
                  Your payment of {formatMoneyWithCents(bookingToCancel?.payment_amount_due || bookingToCancel?.total_amount)} is non-refundable and will not be refunded if you cancel.
                </span>
              ) : null}
              <span className="mt-3 block">This action cannot be undone from your account.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingBooking}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancellingBooking}
              onClick={(event) => {
                event.preventDefault();
                handleCancelBooking();
              }}
            >
              {isCancellingBooking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Booking"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
      <span className="text-muted-foreground">{label}</span>
      <p className="mt-1 break-words font-medium text-foreground">{children}</p>
    </div>
  );
}
