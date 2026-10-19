import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, Loader2, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaginationControls from "@/components/admin/PaginationControls";
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
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [savingKey, setSavingKey] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState([]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);

  useEffect(() => {
    baseClient.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-user-permissions"],
    queryFn: () => baseClient.entities.User.list("full_name", 1000),
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (Boolean(user.disabled)) {
        return false;
      }

      if (roleFilter !== "all" && user.role !== roleFilter) {
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
  }, [roleFilter, search, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = useMemo(() => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredUsers, currentPage, pageSize]);

  const isSelf = (userId) => currentUser?.id && userId === currentUser.id;
  const isSuperAdmin = currentUser?.role === "super_admin"
    || currentUser?.app_role === "super_admin"
    || currentUser?._app_role === "super_admin";
  const archivableVisibleUsers = visibleUsers.filter((targetUser) => !isSelf(targetUser.id));
  const allArchivableVisibleUsersSelected = archivableVisibleUsers.length > 0 && archivableVisibleUsers.every((targetUser) => selectedArchiveIds.includes(targetUser.id));

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

  const updateRole = async (targetUser, nextRole) => {
    if (!targetUser || targetUser.role === nextRole) {
      return;
    }

    if (isSelf(targetUser.id) && nextRole !== "super_admin") {
      toast.error("You cannot downgrade your own account.");
      return;
    }

    const saveId = `role-${targetUser.id}`;
    setSavingKey(saveId);

    try {
      await baseClient.entities.User.update(targetUser.id, {
        role: nextRole,
        app_role: nextRole,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        action: "Updated User Role",
        entity_type: "User",
        entity_id: targetUser.id,
        details: `Changed role of ${targetUser.email} from ${targetUser.role} to ${nextRole}`,
      });

      toast.success("User role updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to update user role.");
    } finally {
      setSavingKey("");
    }
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

  const sendPasswordResetLink = async () => {
    if (!resetTarget) return;

    const saveId = `reset-${resetTarget.id}`;
    setSavingKey(saveId);
    try {
      await baseClient.auth.sendAdminPasswordResetLink(resetTarget.id);
      toast.success(`Password reset link sent to ${resetTarget.email}.`);
      setResetTarget(null);
    } catch (error) {
      toast.error(error?.message || "Unable to send the password reset link.");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Manage User Permissions</h1>
        <p className="mt-1 text-muted-foreground">
          Control active user roles and account access. Archived accounts are restored from Archive.
        </p>
      </div>

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

        <div className="w-full max-w-xs sm:w-auto sm:min-w-[180px]">
          <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(1); setSelectedArchiveIds([]); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filter roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="guest">Guests</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="super_admin">Super Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedArchiveIds.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" className="gap-2 text-warning" onClick={() => setBulkArchiveOpen(true)} disabled={isBulkArchiving}>
            <Archive className="h-4 w-4" /> Archive selected ({selectedArchiveIds.length})
          </Button>
        </div>
      ) : null}

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
                  {isSuperAdmin ? <TableHead>Password</TableHead> : null}
                  <TableHead className="text-right">Archive</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUsers.map((targetUser) => {
                    const roleSaving = savingKey === `role-${targetUser.id}`;
                    const statusSaving = savingKey === `status-${targetUser.id}`;
                    const resetSaving = savingKey === `reset-${targetUser.id}`;

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
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={roleBadgeClass[targetUser.role] || roleBadgeClass.guest}>
                              {roleLabel[targetUser.role] || targetUser.role}
                            </Badge>
                            <Select
                              value={targetUser.role || "guest"}
                              onValueChange={(value) => updateRole(targetUser, value)}
                              disabled={roleSaving}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="guest">Guest</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                {isSuperAdmin ? <SelectItem value="super_admin">Super Admin</SelectItem> : null}
                              </SelectContent>
                            </Select>
                            {roleSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              Active
                            </Badge>
                            {statusSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </TableCell>
                        {isSuperAdmin ? (
                          <TableCell>
                            {targetUser.has_local_password ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setResetTarget(targetUser)}
                                disabled={Boolean(savingKey)}
                              >
                                {resetSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                Send reset link
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Google-managed</span>
                            )}
                          </TableCell>
                        ) : null}
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

      <AlertDialog open={Boolean(resetTarget)} onOpenChange={(open) => { if (!open && !savingKey) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send password reset link?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a forgot password link to {resetTarget?.email}? The link will let them create a new password and expires after 15 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(savingKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(savingKey)}
              onClick={(event) => { event.preventDefault(); void sendPasswordResetLink(); }}
            >
              {savingKey === `reset-${resetTarget?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
