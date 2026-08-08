import { useState } from "react";
import {
  useGetLead,
  getGetLeadQueryKey,
  useAddLeadActivity,
  type Lead,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
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

// Read-only lead detail sheet for the admin panel: full lead info, activity
// timeline, and an admin note input.
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

  const { mutate: addNote, isPending: submitting } = useAddLeadActivity({
    mutation: {
      onSuccess: () => {
        setNoteText("");
        // Refresh the lead so the new activity shows immediately.
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

  function handleSubmitNote() {
    const trimmed = noteText.trim();
    if (!trimmed || !leadId) return;
    addNote({ id: leadId, data: { note: trimmed } });
  }

  const activities = ((lead as Record<string, unknown> | undefined)?.[
    "activities"
  ] ?? []) as Activity[];
  const timeline = [...activities].reverse();
  const owner =
    lead && partnerNameOf(lead) !== "—" ? partnerNameOf(lead) : partnerName;

  return (
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
            <SheetHeader className="space-y-2 border-b px-6 py-4 text-left">
              <SheetTitle className="pr-8 text-lg leading-snug">
                {lead.businessName}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Lead details and activity history
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={lead.stage ?? "New Lead"} />
                {lead.source && (
                  <Badge variant="outline" className="text-xs">
                    {lead.source}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-5 px-6 py-5">
              {/* Lead details */}
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
                  <FollowUpDetail raw={lead.nextFollowUpDate} />
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

              {/* Add a note */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Add a note</p>
                <Textarea
                  placeholder="Write an internal note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    // Ctrl/Cmd+Enter submits
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmitNote();
                    }
                  }}
                  rows={3}
                  className="resize-none text-sm"
                  disabled={submitting}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Ctrl+Enter to submit
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSubmitNote}
                    disabled={submitting || !noteText.trim()}
                  >
                    {submitting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add note
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Activity timeline */}
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
  );
}
