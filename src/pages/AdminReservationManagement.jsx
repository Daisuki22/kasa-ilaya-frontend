import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { resolveAssetUrl } from "@/lib/assetUrls";
import { Archive, CalendarPlus, CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import PaginationControls from "@/components/admin/PaginationControls";
import { Search } from "lucide-react";

const rebookingBadgeClasses = {
  none: "border-border bg-muted text-muted-foreground",
  pending: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  declined: "border-destructive/20 bg-destructive/10 text-destructive",
};

const formatStatusLabel = (value) => (value || "none").replace(/_/g, " ");
const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const tourTimeLabels = {
  day_tour: "8:00 AM - 6:00 PM",
  night_tour: "6:00 PM - 6:00 AM next day",
  "22_hours": "6:00 PM - 4:00 PM next day",
};
const canAdminReschedule = (booking) => ["pending", "confirmed"].includes(booking?.status || "");
const todayInputValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const tomorrowInputValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function AdminReservationManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = [user?.role, user?.app_role, user?._app_role].includes("super_admin");
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const autoOpenedPendingModal = useRef(false);
  const [archiveId, setArchiveId] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [acceptingBooking, setAcceptingBooking] = useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ booking_date: "", note: "" });
  const [rescheduling, setRescheduling] = useState(false);
  const [rebookingBooking, setRebookingBooking] = useState(null);
  const [rebookingNote, setRebookingNote] = useState("");
  const [resolvingRebooking, setResolvingRebooking] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [sort, setSort] = useState("-created_date");
  const reservationFilters = {
    page,
    limit: pageSize,
    search: search.trim(),
    status: statusFilter,
    payment_status: paymentStatusFilter,
    date_from: dateFrom,
    date_to: dateTo,
    package_id: packageFilter,
    sort,
  };

  const { data: bookingPage, isLoading, error: bookingPageError } = useQuery({
    queryKey: ["admin-bookings", reservationFilters],
    queryFn: () => baseClient.entities.Booking.adminPage(reservationFilters),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const { data: pendingBookingPage, isLoading: isLoadingPendingBookings } = useQuery({
    queryKey: ["super-admin-pending-bookings"],
    queryFn: () => baseClient.entities.Booking.adminPage({ page: 1, limit: 50, status: "pending", sort: "-created_date" }),
    enabled: isSuperAdmin,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["admin-reservation-package-filters"],
    queryFn: () => baseClient.entities.Package.list("name"),
  });
  const bookings = bookingPage?.data || [];
  const pendingBookings = pendingBookingPage?.data || [];
  const pendingBookingCount = pendingBookingPage?.pagination?.total || 0;
  const pagination = bookingPage?.pagination || { page, limit: pageSize, total: 0, totalPages: 1 };
  const currentPage = pagination.page || page;
  useEffect(() => {
    if (pagination.page && pagination.page !== page) setPage(pagination.page);
  }, [pagination.page, page]);

  useEffect(() => {
    if (!isSuperAdmin || isLoadingPendingBookings || !pendingBookingPage || autoOpenedPendingModal.current) return;
    autoOpenedPendingModal.current = true;
    if (pendingBookingCount > 0) setPendingModalOpen(true);
  }, [isSuperAdmin, isLoadingPendingBookings, pendingBookingPage, pendingBookingCount]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await baseClient.entities.Booking.update(archiveId, { status: "archived" });
      toast.success("Booking archived.");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-pending-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to archive booking.");
    } finally {
      setArchiving(false);
      setArchiveId(null);
    }
  };

  const handleAcceptBooking = async () => {
    if (!reviewBooking) return;
    setAcceptingBooking(true);
    try {
      await baseClient.entities.Booking.accept(reviewBooking.id);
      toast.success("Booking accepted and payment manually verified.");
      setReviewBooking(null);
      setAcceptConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-pending-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);
    } catch (error) {
      toast.error(error?.message || "Unable to accept this booking.");
    } finally {
      setAcceptingBooking(false);
    }
  };

  const openRebookingReview = (booking) => {
    setRebookingBooking(booking);
    setRebookingNote("");
  };

  const openRescheduleDialog = (booking) => {
    setRescheduleBooking(booking);
    setRescheduleForm({
      booking_date: booking.booking_date || todayInputValue(),
      note: "",
    });
  };

  const handleRescheduleBooking = async () => {
    if (!rescheduleBooking) {
      return;
    }

    const newDate = rescheduleForm.booking_date;
    const note = rescheduleForm.note.trim();

    if (!newDate) {
      toast.error("Please choose the new booking date.");
      return;
    }

    if (newDate === rescheduleBooking.booking_date) {
      toast.error("Please choose a different date.");
      return;
    }

    setRescheduling(true);

    try {
      await baseClient.entities.Booking.reschedule(rescheduleBooking.id, newDate, note);

      toast.success("Booking rescheduled.");
      setRescheduleBooking(null);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to reschedule booking.");
    } finally {
      setRescheduling(false);
    }
  };

  const handleResolveRebooking = async (decision) => {
    if (!rebookingBooking) {
      return;
    }

    setResolvingRebooking(decision);

    try {
      if (decision === "approved") {
        await baseClient.entities.Booking.reschedule(
          rebookingBooking.id,
          rebookingBooking.rebooking_requested_date,
          rebookingNote.trim()
        );
      } else {
        await baseClient.entities.Booking.rejectReschedule(
          rebookingBooking.id,
          rebookingNote.trim() || "Declined by resort admin."
        );

        await baseClient.entities.ActivityLog.create({
          user_email: user?.email || null,
          user_name: user?.full_name || user?.name || "Admin",
          action: "Declined Rebooking",
          entity_type: "Booking",
          entity_id: rebookingBooking.id,
          details: `Declined rebooking ${rebookingBooking.booking_reference} from ${rebookingBooking.booking_date} to ${rebookingBooking.rebooking_requested_date}`,
        });
      }

      toast.success(decision === "approved" ? "Rebooking approved and reservation date updated." : "Rebooking request declined.");
      setRebookingBooking(null);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to update rebooking request.");
    } finally {
      setResolvingRebooking("");
    }
  };

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Reservation Management</h1>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search booking, guest, or status..." className="pl-9" aria-label="Search reservations" />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Reservation status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </Label>
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Payment status</span>
          <select value={paymentStatusFilter} onChange={(event) => { setPaymentStatusFilter(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">All payment statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending_verification">Pending verification</option>
            <option value="paid">Paid</option>
          </select>
        </Label>
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Package</span>
          <select value={packageFilter} onChange={(event) => { setPackageFilter(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">All packages</option>
            {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
          </select>
        </Label>
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Sort reservations</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="-created_date">Newest added</option>
            <option value="created_date">Oldest added</option>
            <option value="booking_date">Booking date: earliest</option>
            <option value="-booking_date">Booking date: latest</option>
            <option value="customer_name">Guest name</option>
            <option value="package_name">Package name</option>
            <option value="-total_amount">Amount: highest</option>
            <option value="total_amount">Amount: lowest</option>
            <option value="status">Reservation status</option>
            <option value="payment_status">Payment status</option>
          </select>
        </Label>
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Booking date from</span>
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
        </Label>
        <Label className="space-y-1 text-xs text-muted-foreground">
          <span>Booking date to</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
        </Label>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bookingPageError ? (
            <div className="p-8 text-center text-sm text-destructive">{bookingPageError.message || "Unable to load reservations."}</div>
          ) : (
            <Table className="min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[136px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[160px]" />
                <col className="w-[300px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Date / time</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rebooking</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length ? (
                  bookings.map((booking) => {
                    const rebookingStatus = booking.rebooking_status || "none";
                    const hasRebooking = rebookingStatus !== "none";

                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">{booking.booking_reference}</TableCell>
                        <TableCell className="max-w-[136px] overflow-hidden align-top">
                          <div className="w-full min-w-0 py-1">
                            <p className="truncate text-sm font-semibold leading-5 text-foreground">{booking.customer_name || "Guest user"}</p>
                            <p className="truncate text-xs leading-4 text-muted-foreground">{booking.customer_email || "No email"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="truncate">{booking.package_name}</TableCell>
                        <TableCell>
                          <p className="font-medium">{booking.booking_date}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{tourTimeLabels[booking.tour_type] || booking.tour_type || "Time unavailable"}</p>
                        </TableCell>
                        <TableCell className="font-semibold text-secondary">{formatMoney(booking.total_amount)}</TableCell>
                        <TableCell className="capitalize">{formatStatusLabel(booking.status)}</TableCell>
                        <TableCell>
                          {hasRebooking ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className={rebookingBadgeClasses[rebookingStatus] || rebookingBadgeClasses.none}>
                                {formatStatusLabel(rebookingStatus)}
                              </Badge>
                              {booking.rebooking_requested_date ? (
                                <p className="text-xs text-muted-foreground">
                                  {rebookingStatus === "approved"
                                    ? `From ${booking.rebooking_original_date || "previous date"} to ${booking.booking_date}`
                                    : `To ${booking.rebooking_requested_date}`}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canAdminReschedule(booking) ? (
                              <Button variant="outline" size="sm" className="gap-2" onClick={() => openRescheduleDialog(booking)}>
                                <CalendarPlus className="h-4 w-4" /> Reschedule
                              </Button>
                            ) : null}
                            {booking.status === "pending" ? (
                              <Button variant="outline" size="sm" className="gap-2" onClick={() => setReviewBooking(booking)}>
                                <Eye className="h-4 w-4" /> Review
                              </Button>
                            ) : null}
                            {rebookingStatus === "pending" ? (
                              <Button variant="outline" size="sm" className="gap-2" onClick={() => openRebookingReview(booking)}>
                                <CalendarPlus className="h-4 w-4" /> Review
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" className="gap-2 text-warning" onClick={() => setArchiveId(booking.id)} disabled={booking.status === "archived"}>
                              <Archive className="h-4 w-4" /> Archive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No reservations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!isLoading && !bookingPageError ? <PaginationControls page={currentPage} pageSize={pageSize} total={pagination.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /> : null}
      </Card>

      <Dialog open={isSuperAdmin && pendingModalOpen} onOpenChange={setPendingModalOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Pending Bookings</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {pendingBookingCount} booking{pendingBookingCount === 1 ? "" : "s"} still waiting for review.
              {pendingBookingCount > pendingBookings.length ? ` Showing the latest ${pendingBookings.length}.` : ""}
            </p>
          </DialogHeader>
          {isLoadingPendingBookings ? (
            <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : pendingBookings.length ? (
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {pendingBookings.map((booking) => (
                <div key={booking.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-sm font-semibold">{booking.booking_reference || booking.id}</p>
                    <p className="truncate text-sm font-medium">{booking.customer_name || "Guest"} · {booking.package_name || "Package"}</p>
                    <p className="text-sm text-muted-foreground">{booking.booking_date} · {tourTimeLabels[booking.tour_type] || booking.tour_type || "Tour"}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Pending booking</Badge>
                      {booking.payment_status === "pending_verification" ? (
                        <Badge variant="outline" className="border-info/30 bg-info/10 text-primary">Payment verification</Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={() => { setPendingModalOpen(false); setReviewBooking(booking); }}
                  >
                    <Eye className="h-4 w-4" /> Review booking
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">There are no pending bookings to review.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewBooking} onOpenChange={(open) => !open && !acceptingBooking && setReviewBooking(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Review booking and payment</DialogTitle>
          </DialogHeader>
          {reviewBooking ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">Booking reference</p><p className="font-mono font-semibold">{reviewBooking.booking_reference || reviewBooking.id}</p></div>
                <div><p className="text-xs text-muted-foreground">Guest</p><p className="font-semibold">{reviewBooking.customer_name || "Guest"}</p><p className="break-all text-sm text-muted-foreground">{reviewBooking.customer_email}</p></div>
                <div><p className="text-xs text-muted-foreground">Package and date</p><p className="font-medium">{reviewBooking.package_name || "Package"} · {reviewBooking.booking_date}</p></div>
                <div><p className="text-xs text-muted-foreground">Payment to verify</p><p className="font-semibold">{formatMoney(reviewBooking.payment_amount_due)}</p><p className="text-sm text-muted-foreground">{reviewBooking.payment_mode || reviewBooking.payment_qr_code_label || "Payment method unavailable"}</p></div>
                <div><p className="text-xs text-muted-foreground">Payment number</p><p className="break-all">{reviewBooking.payment_number || "Not extracted"}</p></div>
                <div><p className="text-xs text-muted-foreground">Reference number</p><p className="break-all">{reviewBooking.payment_reference_number || "Not provided"}</p></div>
              </div>
              <div className="rounded-lg border bg-muted/10 p-4 text-sm">
                <p className="font-semibold">Receipt scan summary</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>OCR amount: {reviewBooking.payment_proof_ocr_amount ? formatMoney(reviewBooking.payment_proof_ocr_amount) : "Not detected"}</p>
                  <p>OCR reference: <span className="break-all">{reviewBooking.payment_proof_ocr_reference || "Not detected"}</span></p>
                  <p>OCR date: {reviewBooking.payment_proof_ocr_date || "Not detected"}</p>
                  <p>OCR confidence: {Number(reviewBooking.payment_proof_ocr_confidence || 0).toFixed(0)}%</p>
                </div>
                <p className="mt-2 text-muted-foreground">OCR is only a reading aid. Confirm the original GCash receipt and payment details before accepting.</p>
              </div>
              {reviewBooking.receipt_url ? (
                <a href={resolveAssetUrl(reviewBooking.receipt_url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-white">
                  <img src={resolveAssetUrl(reviewBooking.receipt_url)} alt={`Payment receipt for ${reviewBooking.booking_reference || "booking"}`} className="max-h-[50vh] w-full object-contain" />
                </a>
              ) : (
                <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">No receipt is attached to this booking.</p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewBooking(null)} disabled={acceptingBooking}>Close</Button>
            <Button onClick={() => setAcceptConfirmOpen(true)} disabled={acceptingBooking || reviewBooking?.status !== "pending" || reviewBooking?.payment_status !== "pending_verification" || !reviewBooking?.receipt_url} className="gap-2">
              {acceptingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accept booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={acceptConfirmOpen} onOpenChange={(open) => { if (!acceptingBooking) setAcceptConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this booking request?</AlertDialogTitle>
            <AlertDialogDescription>
              Accept {reviewBooking?.booking_reference || "this booking"} for {reviewBooking?.booking_date || "the selected date"}? This confirms the reservation and marks its submitted payment as manually verified. Requests can be accepted until the tour checkout time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acceptingBooking}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={acceptingBooking} onClick={(event) => { event.preventDefault(); void handleAcceptBooking(); }}>
              {acceptingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {acceptingBooking ? "Accepting…" : "Accept booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archiveId} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the reservation to the archive. You can restore it later from the Archive page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rescheduleBooking}
        onOpenChange={(open) => {
          if (!open && !rescheduling) {
            setRescheduleBooking(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reschedule Booking</DialogTitle>
          </DialogHeader>

          {rescheduleBooking ? (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg border bg-muted/30 p-5 text-sm sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold">{rescheduleBooking.booking_reference}</p>
                  <p className="mt-2 break-words text-sm text-muted-foreground">{rescheduleBooking.customer_name || "Guest user"}</p>
                  <p className="mt-1 break-words text-base font-semibold text-foreground">{rescheduleBooking.package_name}</p>
                </div>
                <div className="rounded-md border bg-background px-4 py-3 sm:min-w-40 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current date</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{rescheduleBooking.booking_date}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin-reschedule-date" className="text-sm font-semibold">New booking date</Label>
                <Input
                  id="admin-reschedule-date"
                  type="date"
                  min={tomorrowInputValue()}
                  value={rescheduleForm.booking_date}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, booking_date: event.target.value }))}
                  className="h-12 min-h-12 text-base font-semibold"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin-reschedule-note" className="text-sm font-semibold">Admin note</Label>
                <Textarea
                  id="admin-reschedule-note"
                  value={rescheduleForm.note}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Optional reason or note"
                  rows={5}
                  className="min-h-32 resize-y text-base leading-7"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" className="h-11 px-6" onClick={() => setRescheduleBooking(null)} disabled={rescheduling}>
              Cancel
            </Button>
            <Button onClick={handleRescheduleBooking} disabled={rescheduling} className="h-11 gap-2 px-6">
              {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Save New Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rebookingBooking} onOpenChange={(open) => !open && setRebookingBooking(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Rebooking</DialogTitle>
          </DialogHeader>

          {rebookingBooking ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Reference</p>
                  <p className="font-mono font-semibold">{rebookingBooking.booking_reference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Guest</p>
                  <p className="font-semibold">{rebookingBooking.customer_name || "Guest user"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Current Date</p>
                  <p className="font-semibold">{rebookingBooking.booking_date}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Requested Date</p>
                  <p className="font-semibold">{rebookingBooking.rebooking_requested_date}</p>
                </div>
              </div>

              <div>
                <Label>Guest reason</Label>
                <p className="mt-2 rounded-lg bg-muted p-3 text-sm leading-6">
                  {rebookingBooking.rebooking_reason || "No reason provided."}
                </p>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning">
                Policy: one approved rebooking per reservation. Requests must be submitted more than 7 days before the reservation starts. Payment stays non-refundable and transfers to the approved new date.
              </div>

              <div>
                <Label htmlFor="rebooking-resolution-note">Decision note</Label>
                <Textarea
                  id="rebooking-resolution-note"
                  value={rebookingNote}
                  onChange={(event) => setRebookingNote(event.target.value)}
                  placeholder="Optional note for the guest"
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setRebookingBooking(null)} disabled={!!resolvingRebooking}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="destructive" className="gap-2" onClick={() => handleResolveRebooking("declined")} disabled={!!resolvingRebooking}>
                {resolvingRebooking === "declined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Decline
              </Button>
              <Button className="gap-2 bg-success text-white hover:bg-success" onClick={() => handleResolveRebooking("approved")} disabled={!!resolvingRebooking}>
                {resolvingRebooking === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
