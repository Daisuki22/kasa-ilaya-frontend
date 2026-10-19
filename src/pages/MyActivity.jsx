import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { baseClient } from "@/api/baseClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formatLogDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : format(date, "MMM d, yyyy h:mm a");
};

export default function MyActivity() {
  const { user } = useAuth();
  const { data: logs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-activity-logs", user?.email],
    queryFn: () => baseClient.entities.ActivityLog.listMine(),
    enabled: Boolean(user?.email),
  });

  return (
    <main className="app-content-container w-full space-y-6 px-2 py-8 sm:px-3 lg:px-4">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="h-5 w-5" /></span>
            <div>
              <CardTitle className="font-display text-2xl">My Activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">A private record of actions made by {user?.email || "your account"}.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : isError ? (
            <div className="space-y-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">{error?.message || "Your activity could not be loaded."}</p>
              <Button type="button" variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : logs.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No account activity has been recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Activity</TableHead><TableHead>Area</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatLogDate(log.created_date)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{log.action || "Activity"}</TableCell>
                      <TableCell>{log.entity_type || "Account"}</TableCell>
                      <TableCell className="min-w-64 text-sm text-muted-foreground">{log.details || "No additional details."}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
