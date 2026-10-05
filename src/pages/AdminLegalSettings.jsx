import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, FileText, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const DOCUMENTS = {
  terms: { type: "terms", label: "Terms & Conditions", icon: BookOpen },
  privacy: { type: "privacy", label: "Privacy Notice", icon: ShieldCheck },
};

const nextVersion = (value = "1.0") => {
  const parts = value.split(".").map((part) => Number(part) || 0);
  if (parts.length === 1) return `${parts[0]}.1`;
  parts[parts.length - 1] += 1;
  return parts.join(".");
};

const blankDocument = (type) => ({
  document_type: type,
  title: type === "terms" ? "Terms and Conditions" : "Privacy Notice",
  content: "",
  version: "1.0",
});

export default function AdminLegalSettings() {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState("terms");
  const [form, setForm] = useState(() => blankDocument("terms"));
  const [editingId, setEditingId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null);
  const { data: documents = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-legal-documents"],
    queryFn: () => baseClient.entities.LegalDocument.list("-created_date", 100),
  });

  const typeDocuments = useMemo(() => documents.filter((document) => document.document_type === activeType), [documents, activeType]);
  const published = typeDocuments.find((document) => document.status === "published") || null;
  const draft = typeDocuments.find((document) => document.status === "draft") || null;

  const loadDraft = (type, records = documents) => {
    const matching = records.filter((document) => document.document_type === type);
    const currentDraft = matching.find((document) => document.status === "draft");
    if (currentDraft) {
      setEditingId(currentDraft.id);
      setForm({ document_type: type, title: currentDraft.title, content: currentDraft.content, version: currentDraft.version });
      return;
    }
    const currentPublished = matching.find((document) => document.status === "published");
    setEditingId("");
    setForm(currentPublished
      ? { document_type: type, title: currentPublished.title, content: currentPublished.content, version: nextVersion(currentPublished.version) }
      : blankDocument(type));
  };

  React.useEffect(() => {
    if (!isLoading) loadDraft(activeType);
  // A published version can be replaced by the next query result after a save/publish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, isLoading, documents]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, title: form.title.trim(), content: form.content.trim(), version: form.version.trim() };
      if (!payload.title || !payload.content || !payload.version) throw new Error("Enter a title, version, and document content.");
      return editingId
        ? baseClient.entities.LegalDocument.update(editingId, payload)
        : baseClient.entities.LegalDocument.create(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-legal-documents"] });
      setEditingId(saved?.id || editingId);
      toast.success("Draft saved.");
    },
    onError: (saveError) => toast.error(saveError?.status >= 500 ? "The draft could not be saved. Please try again." : saveError.message || "The draft could not be saved."),
  });

  const publishMutation = useMutation({
    mutationFn: (id) => baseClient.entities.LegalDocument.publish(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-legal-documents"] });
      setPublishTarget(null);
      toast.success("Legal document published.");
    },
    onError: (publishError) => {
      setPublishTarget(null);
      toast.error(publishError?.status >= 500 ? "The document could not be published. Please try again." : publishError.message || "The document could not be published.");
    },
  });

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const DocumentIcon = DOCUMENTS[activeType].icon;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground">Legal & Privacy Settings</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Edit plain-text legal documents, save drafts, preview them, and publish versioned copies for new bookings.</p>
      </header>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Notice</TabsTrigger>
        </TabsList>
        {Object.values(DOCUMENTS).map(({ type, label }) => (
          <TabsContent key={type} value={type} className="space-y-5">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : null}
            {isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error?.status >= 500 ? "Legal settings could not be loaded. Please try again." : error?.message || "Legal settings could not be loaded."}</div> : null}
            {!isLoading && !isError ? <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg"><DocumentIcon className="h-5 w-5 text-primary" />Currently published</CardTitle>
                </CardHeader>
                <CardContent>
                  {published ? <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div><p className="font-semibold">{published.title} <span className="text-muted-foreground">v{published.version}</span></p><p className="mt-1 text-muted-foreground">Published {published.published_at ? new Date(published.published_at).toLocaleString() : "date unavailable"}</p></div>
                    <span className="rounded-full bg-success/10 px-3 py-1 font-medium text-success">Live for new bookings</span>
                  </div> : <p className="text-sm text-warning">No version is published yet. Save and publish a draft to enable booking acknowledgments.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">{draft ? "Edit draft" : "Create draft"}</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div className="space-y-2"><Label htmlFor={`${type}-title`}>Document title</Label><Input id={`${type}-title`} value={form.title} maxLength={200} onChange={(event) => updateForm("title", event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor={`${type}-version`}>Version</Label><Input id={`${type}-version`} value={form.version} maxLength={32} onChange={(event) => updateForm("version", event.target.value)} placeholder="1.0" /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor={`${type}-content`}>Document text</Label><Textarea id={`${type}-content`} value={form.content} onChange={(event) => updateForm("content", event.target.value)} maxLength={100000} rows={18} className="min-h-[320px] font-sans leading-7" placeholder="Enter the full document text. Line breaks are preserved for guests." /><p className="text-right text-xs text-muted-foreground">{form.content.length.toLocaleString()} / 100,000 characters</p></div>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} disabled={!form.content.trim()}><Eye className="mr-2 h-4 w-4" />Preview</Button>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => loadDraft(activeType)} disabled={saveMutation.isPending}>Reset</Button>
                      <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title.trim() || !form.content.trim() || !form.version.trim()}><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save Draft"}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {draft ? <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-warning">Draft ready: v{draft.version}</p><p className="text-sm text-warning">Publishing makes this the current version and archives the previous published version.</p></div><Button type="button" onClick={() => setPublishTarget(draft)} disabled={saveMutation.isPending || publishMutation.isPending || editingId !== draft.id}><FileText className="mr-2 h-4 w-4" />Publish version</Button></div> : null}
            </> : null}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-6 py-5 pr-12 text-left"><DialogTitle>{form.title || DOCUMENTS[activeType].label}</DialogTitle><DialogDescription>Preview · version {form.version || "not set"}</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{form.content}</div></div>
          <div className="border-t px-6 py-4"><Button variant="outline" onClick={() => setPreviewOpen(false)}>Close preview</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(publishTarget)} onOpenChange={(open) => { if (!open && !publishMutation.isPending) setPublishTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Publish {DOCUMENTS[activeType].label} v{publishTarget?.version}?</AlertDialogTitle><AlertDialogDescription>New bookings will use this version. Existing bookings keep the version they accepted. The current published version will be archived.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={publishMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={publishMutation.isPending} onClick={(event) => { event.preventDefault(); if (publishTarget) publishMutation.mutate(publishTarget.id); }}>{publishMutation.isPending ? "Publishing…" : "Publish"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
