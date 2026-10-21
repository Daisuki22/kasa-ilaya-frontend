import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, Loader2, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import PaginationControls from "@/components/admin/PaginationControls";
import PasswordInput from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const roleBadgeClass = {
  super_admin: "bg-primary/10 text-primary border-primary/30",
  admin: "bg-accent/20 text-accent-foreground border-accent/30",
  guest: "bg-muted text-muted-foreground border-border",
};

const roleLabel = {
  super_admin: "Super Admin",
  admin: "Admin",
  guest: "Guest",
};

const recoveryDeclineSuggestions = [
  {
    label: "Couldn't verify identity",
    comment: "We couldn't verify your identity using the contact details on your account. Please contact the resort to verify your details before submitting a new request.",
  },
  {
    label: "Details don't match",
    comment: "The information provided doesn't match the details on your account. Please check your name and phone number, then contact the resort if you need help.",
  },
  {
    label: "More information needed",
    comment: "We need more information to verify this request. Please contact the resort with details that can help confirm you own the account.",
  },
];

const formatBirthDate = (value) => {
  const dateValue = value ? String(value).slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return "Not provided";

  const [year, month, day] = dateValue.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM d, yyyy");
};

export default function AdminUserPermissions() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const [accountCategory, setAccountCategory] = useState("guest");
  const [createAccountRole, setCreateAccountRole] = useState("");
  const [createAccountForm, setCreateAccountForm] = useState({ full_name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [recoveryPage, setRecoveryPage] = useState(1);
  const [savingKey, setSavingKey] = useState("");
  const [recoveryReviewTarget, setRecoveryReviewTarget] = useState(null);
  const [recoveryDecision, setRecoveryDecision] = useState("approve");
  const [recoveryIdentityVerified, setRecoveryIdentityVerified] = useState(false);
  const [recoveryReviewNote, setRecoveryReviewNote] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState([]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const isSuperAdmin = currentUser?.role === "super_admin"
    || currentUser?.app_role === "super_admin"
    || currentUser?._app_role === "super_admin";
  const canReviewAccountRecovery = isSuperAdmin
    || currentUser?.role === "admin"
    || currentUser?.app_role === "admin"
    || currentUser?._app_role === "admin";

  useEffect(() => {
    baseClient.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-user-permissions"],
    queryFn: () => baseClient.entities.User.list("full_name", 1000),
  });
  const { data: recoveryRequests = [], isLoading: isLoadingRecoveryRequests } = useQuery({
    queryKey: ["admin-account-recovery-requests"],
    queryFn: () => baseClient.auth.listAccountRecoveryRequests(),
    enabled: canReviewAccountRecovery,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const recoveryTotalPages = Math.max(1, recoveryRequests.length);
  const currentRecoveryPage = Math.min(recoveryPage, recoveryTotalPages);
  const visibleRecoveryRequests = recoveryRequests.slice(currentRecoveryPage - 1, currentRecoveryPage);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (Boolean(user.disabled)) {
        return false;
      }

      if (user.role !== accountCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.full_name, user.email, user.role, user.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    }
    );
  }, [accountCategory, search, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = useMemo(() => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredUsers, currentPage, pageSize]);

  const isSelf = (userId) => currentUser?.id && userId === currentUser.id;
  const archivableVisibleUsers = visibleUsers.filter((targetUser) => !isSelf(targetUser.id));
  const allArchivableVisibleUsersSelected = archivableVisibleUsers.length > 0 && archivableVisibleUsers.every((targetUser) => selectedArchiveIds.includes(targetUser.id));

  const selectAccountCategory = (category) => {
    if (!isSuperAdmin && category !== "guest") return;
    setAccountCategory(category);
    setPage(1);
    setSelectedArchiveIds([]);
  };

  const openCreateAccount = (role) => {
    if (!isSuperAdmin || !["admin", "super_admin"].includes(role)) return;
    setCreateAccountForm({ full_name: "", email: "", phone: "", password: "", confirmPassword: "" });
    setCreateAccountRole(role);
  };

  const createManagedAccount = async (event) => {
    event.preventDefault();
    if (!isSuperAdmin || !["admin", "super_admin"].includes(createAccountRole) || isCreatingAccount) return;
    if (createAccountForm.password !== createAccountForm.confirmPassword) {
      toast.error("The passwords do not match.");
      return;
    }

    setIsCreatingAccount(true);
    try {
      await baseClient.auth.createManagedAccount({
        full_name: createAccountForm.full_name,
        email: createAccountForm.email,
        phone: createAccountForm.phone,
        password: createAccountForm.password,
        role: createAccountRole,
      });
      toast.success(`${createAccountRole === "super_admin" ? "Super admin" : "Admin"} account created.`);
      setCreateAccountForm({ full_name: "", email: "", phone: "", password: "", confirmPassword: "" });
      setCreateAccountRole("");
      selectAccountCategory(createAccountRole);
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to create the administrator account.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const toggleVisibleUserSelection = () => {
    const ids = archivableVisibleUsers.map((targetUser) => targetUser.id);
    setSelectedArchiveIds((current) => allArchivableVisibleUsersSelected
      ? current.filter((id) => !ids.includes(id))
      : [...new Set([...current, ...ids])]);
  };

  const archiveSelectedUsers = async () => {
    const selectedUsers = filteredUsers.filter((targetUser) => selectedArchiveIds.includes(targetUser.id) && !isSelf(targetUser.id));
    if (!selectedUsers.length) return;
    setIsBulkArchiving(true);
    const results = await Promise.allSettled(selectedUsers.map(async (targetUser) => {
      await baseClient.entities.User.update(targetUser.id, { disabled: true });
      await baseClient.entities.ActivityLog.create({
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        action: "Disabled User Account",
        entity_type: "User",
        entity_id: targetUser.id,
        details: `Archived account for ${targetUser.email}`,
      });
      return targetUser.id;
    }));
    const archivedIds = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failedCount = results.length - archivedIds.length;
    if (archivedIds.length) {
      setSelectedArchiveIds((current) => current.filter((id) => !archivedIds.includes(id)));
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      toast.success(`${archivedIds.length} account${archivedIds.length === 1 ? "" : "s"} archived.`);
    }
    if (failedCount) toast.error(`${failedCount} account${failedCount === 1 ? "" : "s"} could not be archived.`);
    setIsBulkArchiving(false);
    setBulkArchiveOpen(false);
  };

  const updateDisabledState = async (targetUser, nextDisabled) => {
    if (!targetUser || Boolean(targetUser.disabled) === nextDisabled) {
      return;
    }

    if (isSelf(targetUser.id) && nextDisabled) {
      toast.error("You cannot disable your own account.");
      return;
    }

    const saveId = `status-${targetUser.id}`;
    setSavingKey(saveId);

    try {
      await baseClient.entities.User.update(targetUser.id, {
        disabled: nextDisabled,
      });
      if (nextDisabled) setSelectedArchiveIds((current) => current.filter((id) => id !== targetUser.id));

      await baseClient.entities.ActivityLog.create({
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        action: nextDisabled ? "Disabled User Account" : "Enabled User Account",
        entity_type: "User",
        entity_id: targetUser.id,
        details: `${nextDisabled ? "Disabled" : "Enabled"} account for ${targetUser.email}`,
      });

      toast.success(nextDisabled ? "User disabled." : "User enabled.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      if (nextDisabled) setArchiveTarget(null);
    } catch (error) {
      toast.error(error?.message || "Unable to update user status.");
    } finally {
      setSavingKey("");
    }
  };

  const openRecoveryReview = (request, decision) => {
    setRecoveryReviewTarget(request);
    setRecoveryDecision(decision);
    setRecoveryIdentityVerified(false);
    setRecoveryReviewNote("");
  };

  const reviewAccountRecovery = async () => {
    if (!recoveryReviewTarget || !canReviewAccountRecovery) return;
    if (recoveryDecision === "approve" && !recoveryIdentityVerified) {
      toast.error("Verify the person using contact information already on the account before approving.");
      return;
    }
    if (recoveryDecision === "decline" && recoveryReviewNote.trim().length < 5) {
      toast.error("Add a brief reason before declining this request.");
      return;
    }

    const saveId = `recovery-${recoveryReviewTarget.id}`;
    setSavingKey(saveId);
    try {
      const result = await baseClient.auth.reviewAccountRecoveryRequest({
        request_id: recoveryReviewTarget.id,
        decision: recoveryDecision,
        identity_verified: recoveryIdentityVerified,
        review_note: recoveryReviewNote,
      });
      if (recoveryDecision === "approve") {
        toast.success(`Account recovery request approved. Recovery link sent to ${recoveryReviewTarget.requested_email}.`);
      } else if (result.email_sent) {
        toast.success(`Request declined. The reason was emailed to ${recoveryReviewTarget.requested_email}.`);
      } else {
        toast.error("Request declined, but the email with the reason could not be delivered. Please contact the requester using their account phone number.");
      }
      setRecoveryReviewTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-account-recovery-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] }),
      ]);
      return result;
    } catch (error) {
      toast.error(error?.message || "Unable to review this account recovery request.");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Manage User Permissions</h1>
        <p className="mt-1 text-muted-foreground">
          User roles are fixed after account creation. Create administrator accounts separately; archived accounts are restored from Archive.
        </p>
      </div>

      {canReviewAccountRecovery ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Account recovery requests</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Before approval, contact the user using the phone number already on the account and compare their details with resort records. Approving sends a one-time link to the proposed email; the email changes only after the user completes the link. Regular admins can review user accounts; only a super admin can review admin account requests.</p>
              </div>
              <Badge variant="outline">{recoveryRequests.length} pending</Badge>
            </div>
            {isLoadingRecoveryRequests ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : recoveryRequests.length ? (
              <div className="space-y-3">
                {visibleRecoveryRequests.map((request) => (
                  <div key={request.id} className="grid gap-4 rounded-lg border border-border p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <p><span className="text-muted-foreground">Account name:</span> <strong>{request.account_full_name || request.full_name}</strong></p>
                      <p><span className="text-muted-foreground">Submitted name:</span> {request.full_name}</p>
                      <p className="break-all"><span className="text-muted-foreground">Current email:</span> {request.account_email || request.old_email}</p>
                      <p className="break-all"><span className="text-muted-foreground">New email:</span> <strong>{request.requested_email}</strong></p>
                      <p><span className="text-muted-foreground">Phone on account:</span> {request.account_phone || "Not on file"}</p>
                      <p><span className="text-muted-foreground">Phone submitted:</span> {request.phone}</p>
                      {request.booking_reference ? <p><span className="text-muted-foreground">Booking reference:</span> {request.booking_reference}</p> : null}
                      {request.reason ? <p className="sm:col-span-2"><span className="text-muted-foreground">User note:</span> {request.reason}</p> : null}
                      <p className="text-xs text-muted-foreground sm:col-span-2">Submitted {request.created_date ? format(new Date(request.created_date), "MMM d, yyyy 'at' h:mm a") : "recently"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button type="button" size="sm" onClick={() => openRecoveryReview(request, "approve")} disabled={Boolean(savingKey)}>Verify &amp; approve</Button>
                      <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => openRecoveryReview(request, "decline")} disabled={Boolean(savingKey)}>Decline</Button>
                    </div>
                  </div>
                ))}
                {recoveryRequests.length > 1 ? (
                  <PaginationControls
                    page={currentRecoveryPage}
                    pageSize={1}
                    total={recoveryRequests.length}
                    onPageChange={setRecoveryPage}
                    onPageSizeChange={() => {}}
                    pageSizeOptions={[1]}
                  />
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No pending account recovery requests.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); setSelectedArchiveIds([]); }}
            placeholder="Search by name, email, role, or phone..."
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Account type">
          <Button type="button" role="tab" aria-selected={accountCategory === "guest"} variant={accountCategory === "guest" ? "default" : "outline"} onClick={() => selectAccountCategory("guest")}>User Accounts</Button>
          {isSuperAdmin ? <Button type="button" role="tab" aria-selected={accountCategory === "admin"} variant={accountCategory === "admin" ? "default" : "outline"} onClick={() => selectAccountCategory("admin")}>Admin Accounts</Button> : null}
          {isSuperAdmin ? <Button type="button" role="tab" aria-selected={accountCategory === "super_admin"} variant={accountCategory === "super_admin" ? "default" : "outline"} onClick={() => selectAccountCategory("super_admin")}>Super Admin Accounts</Button> : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {selectedArchiveIds.length > 0 ? (
            <Button variant="outline" className="gap-2 text-warning" onClick={() => setBulkArchiveOpen(true)} disabled={isBulkArchiving}>
              <Archive className="h-4 w-4" /> Archive selected ({selectedArchiveIds.length})
            </Button>
          ) : null}
          {isSuperAdmin ? (
            <>
              <Button type="button" variant="outline" className="gap-2" onClick={() => openCreateAccount("admin")}>
                <UserPlus className="h-4 w-4" /> Create Admin Account
              </Button>
              <Button type="button" className="gap-2" onClick={() => openCreateAccount("super_admin")}>
                <ShieldCheck className="h-4 w-4" /> Create Super Admin Account
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input type="checkbox" aria-label="Select all visible users for archive" checked={allArchivableVisibleUsersSelected} disabled={archivableVisibleUsers.length === 0} onChange={toggleVisibleUserSelection} className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40" />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Archive</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUsers.map((targetUser) => {
                    const statusSaving = savingKey === `status-${targetUser.id}`;
                    return (
                      <TableRow key={targetUser.id}>
                        <TableCell className="text-center">
                          <input type="checkbox" aria-label={`Select user ${targetUser.email} for archive`} checked={selectedArchiveIds.includes(targetUser.id)} disabled={isSelf(targetUser.id)} onChange={() => setSelectedArchiveIds((current) => current.includes(targetUser.id) ? current.filter((id) => id !== targetUser.id) : [...current, targetUser.id])} className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40" />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">{targetUser.full_name || "Unnamed"}</p>
                            <p className="text-xs font-mono text-muted-foreground">{targetUser.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{targetUser.email}</p>
                            <p className="text-xs text-muted-foreground">{targetUser.phone || "No phone"}</p>
                            <p className="text-xs text-muted-foreground">Birthday: {formatBirthDate(targetUser.birth_date)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleBadgeClass[targetUser.role] || roleBadgeClass.guest}>
                            {roleLabel[targetUser.role] || targetUser.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              Active
                            </Badge>
                            {statusSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setArchiveTarget(targetUser)}
                            disabled={statusSaving || isSelf(targetUser.id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {targetUser.created_date ? format(new Date(targetUser.created_date), "MMM d, yyyy") : "Unknown"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
          </Table>
        </CardContent>
        {!isLoading ? <PaginationControls page={currentPage} pageSize={pageSize} total={filteredUsers.length} onPageChange={(value) => { setPage(value); setSelectedArchiveIds([]); }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); setSelectedArchiveIds([]); }} /> : null}
      </Card>
      )}

      <Dialog open={Boolean(createAccountRole)} onOpenChange={(open) => { if (!open && !isCreatingAccount) setCreateAccountRole(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createAccountRole === "super_admin" ? "Create Super Admin Account" : "Create Admin Account"}</DialogTitle>
            <DialogDescription>
              Set up the account details and an initial password. Share the password with the new account holder securely.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createManagedAccount}>
            <div className="space-y-2">
              <Label htmlFor="managed-account-name">Full name</Label>
              <Input id="managed-account-name" value={createAccountForm.full_name} onChange={(event) => setCreateAccountForm((current) => ({ ...current, full_name: event.target.value }))} autoComplete="name" maxLength={191} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-account-email">Email address</Label>
              <Input id="managed-account-email" type="email" value={createAccountForm.email} onChange={(event) => setCreateAccountForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" maxLength={191} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-account-phone">Mobile number</Label>
              <Input id="managed-account-phone" type="tel" value={createAccountForm.phone} onChange={(event) => setCreateAccountForm((current) => ({ ...current, phone: event.target.value }))} placeholder="09XXXXXXXXX" autoComplete="tel" maxLength={32} required />
            </div>
            <PasswordInput id="managed-account-password" label="Initial password" value={createAccountForm.password} onChange={(event) => setCreateAccountForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" placeholder="Create a strong password" showRequirements showRequirementsOnFocus required />
            <PasswordInput id="managed-account-confirm-password" label="Confirm password" value={createAccountForm.confirmPassword} onChange={(event) => setCreateAccountForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" placeholder="Re-enter the password" showMatch confirmValue={createAccountForm.password} required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateAccountRole("")} disabled={isCreatingAccount}>Cancel</Button>
              <Button type="submit" disabled={isCreatingAccount || !createAccountRole}>
                {isCreatingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {isCreatingAccount ? "Creating account..." : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(recoveryReviewTarget)} onOpenChange={(open) => { if (!open && !savingKey) setRecoveryReviewTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{recoveryDecision === "approve" ? "Verify and approve account recovery?" : "Decline account recovery?"}</DialogTitle>
            <DialogDescription>
              {recoveryDecision === "approve"
                ? `A one-time link will be sent to ${recoveryReviewTarget?.requested_email}. The account email will change only after the user opens that link and sets a new password.`
                : `The request for ${recoveryReviewTarget?.requested_email} will be closed. The user will need to contact the resort for next steps.`}
            </DialogDescription>
          </DialogHeader>
          {recoveryDecision === "approve" ? (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <Checkbox checked={recoveryIdentityVerified} onCheckedChange={(checked) => setRecoveryIdentityVerified(checked === true)} />
                <span>I verified the user's identity through contact information already on the account and checked the submitted details against resort records.</span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="recovery-review-note">Approval comment (optional)</Label>
                <Textarea id="recovery-review-note" maxLength={1000} value={recoveryReviewNote} onChange={(event) => setRecoveryReviewNote(event.target.value)} placeholder="Add a note to include in the approval email, if needed." />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="recovery-review-note">Reason for declining (required)</Label>
              <Textarea id="recovery-review-note" maxLength={1000} value={recoveryReviewNote} onChange={(event) => setRecoveryReviewNote(event.target.value)} placeholder="Explain why the request was declined and what the user should do next. This comment will be emailed to the new address." />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Suggested comments — click one to use it, then edit if needed:</p>
                <div className="flex flex-wrap gap-2">
                  {recoveryDeclineSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto whitespace-normal py-2 text-left text-xs"
                      onClick={() => setRecoveryReviewNote(suggestion.comment)}
                    >
                      {suggestion.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecoveryReviewTarget(null)} disabled={Boolean(savingKey)}>Cancel</Button>
            <Button type="button" variant={recoveryDecision === "approve" ? "default" : "destructive"} onClick={() => void reviewAccountRecovery()} disabled={Boolean(savingKey) || (recoveryDecision === "approve" ? !recoveryIdentityVerified : recoveryReviewNote.trim().length < 5)}>
              {savingKey === `recovery-${recoveryReviewTarget?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {recoveryDecision === "approve" ? "Approve & send link" : "Decline request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !savingKey) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this user?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive {archiveTarget?.full_name || archiveTarget?.email}? They will lose access to their account and can be restored from the archive later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(savingKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(savingKey)}
              onClick={(event) => { event.preventDefault(); void updateDisabledState(archiveTarget, true); }}
            >
              {savingKey === `status-${archiveTarget?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Archive user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkArchiveOpen} onOpenChange={(open) => { if (!open && !isBulkArchiving) setBulkArchiveOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive selected user accounts?</AlertDialogTitle>
            <AlertDialogDescription>Disable {selectedArchiveIds.length} selected account{selectedArchiveIds.length === 1 ? "" : "s"}? The users will lose access, and you can restore them from Archive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void archiveSelectedUsers(); }} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isBulkArchiving || selectedArchiveIds.length === 0}>
              {isBulkArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Archive selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
