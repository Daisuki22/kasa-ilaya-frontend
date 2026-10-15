import React, { useCallback, useRef, useState } from "react";
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

export function useConfirmation() {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolveRef.current?.(false);
    resolveRef.current = resolve;
    setRequest({
      title: options.title || "Are you sure?",
      description: options.description || "Do you want to continue?",
      confirmLabel: options.confirmLabel || "Continue",
      cancelLabel: options.cancelLabel || "Cancel",
      destructive: Boolean(options.destructive),
    });
  }), []);

  const settle = useCallback((confirmed) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  const confirmationDialog = (
    <AlertDialog open={Boolean(request)} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel || "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            className={request?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={(event) => { event.preventDefault(); settle(true); }}
          >
            {request?.confirmLabel || "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmationDialog };
}
