import { useState } from "react";
import {
  useGetLead,
  getGetLeadQueryKey,
  getListLeadsQueryKey,
  useAddLeadActivity,
  useUpdateLead,
  useDeleteLead,
  type Lead,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Phone,
  MapPin,
  User,
  Tag,
  CalendarClock,
  Sparkles,
  ArrowRight,
  StickyNote,
  FileEdit,
  History,
  Handshake,
  AlertCircle,
  Clock,
  SendHorizonal,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  STAGES,
  StageBadge,
  fmtDate,
  fmtDateTime,
  followUpStatus,
} from "@/lib/leads-utils";

function partnerNameOf(lead: Lead): string {
  const aff = (lead as Record<string, unknown>)["affiliate"];
  if (aff && typeof aff === "object") {
    return String((aff as Record<string, unknown>)["name"] ?? "") || "—";
  }
  return "—";
}

type Activity = {
  _id?: string | null;
  action?: string;
  from?: string | null;
  to?: string | null;
  note?: string | null;
  at?: string | null;
};

function activityIcon(action: string) {
  switch (action) {
    case "created":
      return <Sparkles className="h-3.5 w-3.5" />;
    case "stage_changed":
      return <ArrowRight className="h-3.5 w-3.5" />;
    case "follow_up_set":
      return <CalendarClock className="h-3.5 w-3.5" />;
    case "note":
      return <StickyNote className="h-3.5 w-3.5" />;
    default:
      return <FileEdit className="h-3.5 w-3.5" />;
  }
}

function ActivityLabel({ activity }: { activity: Activity }) {
  const action = activity.action ?? "";
  if (action === "created") {
    return (
      <span>
        Lead created
        {activity.to ? (
          <>
            {" "}
            in stage <span className="font-medium">{activity.to}</span>
          </>
        ) : null}
      </span>
    );
  }
  if (action === "stage_changed") {
    return (
      <span>
        Stage changed from{" "}
        <span className="font-medium">{activity.from || "—"}</span> to{" "}
        <span className="font-medium">{activity.to || "—"}</span>
      </span>
    );
  }
  if (action === "follow_up_set") {
    if (!activity.to) return <span>Follow-up date cleared</span>;
    return (
      <span>
        Follow-up set for{" "}
        <span className="font-medium">{fmtDate(activity.to)}</span>
      </span>
    );
  }
  if (action === "note") {
    return <span className="whitespace-pre-wrap">{activity.note}</span>;
  }
  if (action === "details_updated") {
    return <span>Lead details updated</span>;
  }
  return <span>{action || "Activity"}</span>;
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function FollowUpDetail({ raw }: { raw: unknown }) {
  const status = followUpStatus(raw);
  const label = fmtDate(raw);

  if (!status) return <span>{label}</span>;

  if (status === "overdue") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-red-600">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {label}
        <span className="text-xs font-normal text-red-500">(overdue)</span>
      </span>
    );
  }
  if (status === "today") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-amber-600">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {label}
        <span className="text-xs font-normal text-amber-500">(today)</span>
      </span>
    );
  }
  return <span>{label}</span>;
}

export default function LeadDetailDialog({
  leadId,
  onOpenChange,
  partnerName,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  partnerName?: string;
}) {
  const [noteText, setNoteText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: lead,
    isLoading,
    isError,
  } = useGetLead(leadId ?? "", {
    query: {
      enabled: !!leadId,
      queryKey: getGetLeadQueryKey(leadId ?? ""),
    },
  });

  // ── Add note ──────────────────────────────────────────────────────────────
  const { mutate: addNote, isPending: submittingNote } = useAddLeadActivity({
    mutation: {
      onSuccess: () => {
        setNoteText("");
        void queryClient.invalidateQueries({
          queryKey: getGetLeadQueryKey(leadId ?? ""),
        });
        toast({ title: "Note added" });
      },
      onError: () => {
        toast({
          title: "Failed to add note",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  // ── Change stage ──────────────────────────────────────────────────────────
  const { mutate: updateLead, isPending: updatingStage } = useUpdateLead({
    mutation: {
      onSuccess: (updated) => {
        void queryClient.invalidateQueries({
          queryKey: getGetLeadQueryKey(leadId ?? ""),
        });
        void queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
        const newStage =
          (updated as Record<string, unknown>)?.["stage"] ?? "—";
        toast({ title: `Stage updated to "${newStage}"` });
      },
      onError: () => {
        toast({ title: "Failed to update stage", variant: "destructive" });
      },
    },
  });

  // ── Change follow-up date ─────────────────────────────────────────────────
  const { mutate: updateFollowUp, isPending: updatingFollowUp } = useUpdateLead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getGetLeadQueryKey(leadId ?? ""),
        });
        void queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
        toast({ title: "Follow-up date updated" });
      },
      onError: () => {
        toast({ title: "Failed to update follow-up date", variant: "destructive" });
      },
    },
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const { mutate: deleteLead, isPending: deleting } = useDeleteLead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
        toast({ title: "Lead deleted" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to delete lead", variant: "destructive" });
      },
    },
  });

  function handleSubmitNote() {
    const trimmed = noteText.trim();
    if (!trimmed || !leadId) return;
    addNote({ id: leadId, data: { note: trimmed } });
  }

  /** Convert an upstream ISO date string → YYYY-MM-DD for <input type="date"> */
  function toDateInputValue(raw: unknown): string {
    if (!raw) return "";
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return "";
    // Shift to EAT (UTC+3) so the displayed day matches what fmtDate shows.
    const eat = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return eat.toISOString().slice(0, 10);
  }

  function handleFollowUpChange(value: string) {
    if (!leadId || !lead) return;
    const l = lead as Record<string, unknown>;
    updateFollowUp({
      id: leadId,
      data: {
        businessName: String(l["businessName"] ?? ""),
        contactPerson: (l["contactPerson"] as string | null) ?? null,
        phonenumber: (l["phonenumber"] as string | null) ?? null,
        businessType: (l["businessType"] as string | null) ?? null,
        location: (l["location"] as string | null) ?? null,
        source: (l["source"] as string | null) ?? null,
        stage: (l["stage"] as string | null) ?? null,
        // Send the YYYY-MM-DD string upstream, or null to clear.
        nextFollowUpDate: value || null,
        notes: (l["notes"] as string | null) ?? null,
      },
    });
  }

  function handleStageChange(newStage: string) {
    if (!leadId || !lead) return;
    // Send all existing fields along with the new stage (LeadInput requires businessName)
    const l = lead as Record<string, unknown>;
    updateLead({
      id: leadId,
      data: {
        businessName: String(l["businessName"] ?? ""),
        contactPerson: (l["contactPerson"] as string | null) ?? null,
        phonenumber: (l["phonenumber"] as string | null) ?? null,
        businessType: (l["businessType"] as string | null) ?? null,
        location: (l["location"] as string | null) ?? null,
        source: (l["source"] as string | null) ?? null,
        stage: newStage,
        nextFollowUpDate: (l["nextFollowUpDate"] as string | null) ?? null,
        notes: (l["notes"] as string | null) ?? null,
      },
    });
  }

  function handleDeleteConfirm() {
    if (!leadId) return;
    deleteLead({ id: leadId });
  }

  const activities = ((lead as Record<string, unknown> | undefined)?.[
    "activities"
  ] ?? []) as Activity[];
  const timeline = [...activities].reverse();
  const owner =
    lead && partnerNameOf(lead) !== "—" ? partnerNameOf(lead) : partnerName;

  const isBusy = updatingStage || deleting;

  return (
    <>
      <Sheet open={!!leadId} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError || !lead ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-destructive">
              Could not load this lead. It may have been deleted.
            </div>
          ) : (
            <>
              {/* ── Header ── */}
              <SheetHeader className="space-y-2 border-b px-6 py-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="pr-2 text-lg leading-snug">
                    {lead.businessName}
                  </SheetTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isBusy}
                    title="Delete lead"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <SheetDescription className="sr-only">
                  Lead details and activity history
                </SheetDescription>

                {/* Stage selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={lead.stage ?? "New Lead"}
                    onValueChange={handleStageChange}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="h-7 w-auto gap-1.5 border-0 bg-transparent px-0 py-0 text-sm font-normal shadow-none focus:ring-0 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                      <SelectValue>
                        <StageBadge stage={lead.stage ?? "New Lead"} />
                      </SelectValue>
                      {updatingStage ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <StageBadge stage={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lead.source && (
                    <Badge variant="outline" className="text-xs">
                      {lead.source}
                    </Badge>
                  )}
                </div>
              </SheetHeader>

              <div className="space-y-5 px-6 py-5">
                {/* ── Lead details ── */}
                <div className="grid gap-3">
                  <DetailRow
                    icon={<Handshake className="h-4 w-4" />}
                    label="Partner"
                  >
                    {owner || "—"}
                  </DetailRow>
                  <DetailRow
                    icon={<User className="h-4 w-4" />}
                    label="Contact person"
                  >
                    {lead.contactPerson || "—"}
                  </DetailRow>
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
                    {lead.phonenumber ? (
                      <a
                        href={`tel:${lead.phonenumber}`}
                        className="hover:underline"
                      >
                        {lead.phonenumber}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  <DetailRow
                    icon={<Tag className="h-4 w-4" />}
                    label="Business type"
                  >
                    {lead.businessType || "—"}
                  </DetailRow>
                  <DetailRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Location"
                  >
                    {lead.location || "—"}
                  </DetailRow>
                  <DetailRow
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Next follow-up"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={toDateInputValue(lead.nextFollowUpDate)}
                        onChange={(e) => handleFollowUpChange(e.target.value)}
                        disabled={updatingFollowUp}
                        className="h-7 rounded border border-input bg-background px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      />
                      {lead.nextFollowUpDate && (
                        <button
                          type="button"
                          onClick={() => handleFollowUpChange("")}
                          disabled={updatingFollowUp}
                          title="Clear follow-up date"
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          ×
                        </button>
                      )}
                      {updatingFollowUp && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </DetailRow>
                  {lead.notes && (
                    <DetailRow
                      icon={<StickyNote className="h-4 w-4" />}
                      label="Notes"
                    >
                      <span className="whitespace-pre-wrap">{lead.notes}</span>
                    </DetailRow>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Added {fmtDate(lead.createAt)}
                </p>

                <Separator />

                {/* ── Add a note ── */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add a note</p>
                  <Textarea
                    placeholder="Write an internal note…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSubmitNote();
                      }
                    }}
                    rows={3}
                    className="resize-none text-sm"
                    disabled={submittingNote}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Ctrl+Enter to submit
                    </p>
                    <Button
                      size="sm"
                      onClick={handleSubmitNote}
                      disabled={submittingNote || !noteText.trim()}
                    >
                      {submittingNote ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Add note
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── Activity timeline ── */}
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Activity
                  </p>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No activity recorded for this lead yet.
                    </p>
                  ) : (
                    <ol className="relative ml-2 space-y-4 border-l pl-5">
                      {timeline.map((activity, i) => (
                        <li key={activity._id ?? i} className="relative">
                          <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
                            {activityIcon(activity.action ?? "")}
                          </span>
                          <div className="text-sm text-foreground">
                            <ActivityLabel activity={activity} />
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtDateTime(activity.at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{lead?.businessName}</strong> and all its activity history
              will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
