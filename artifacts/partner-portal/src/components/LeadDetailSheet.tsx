import { useState } from "react";
import {
  useGetPortalLead,
  getGetPortalLeadQueryKey,
  useUpdatePortalLead,
  useAddPortalLeadActivity,
  getListPortalLeadsQueryKey,
  getGetPortalLeadStatsQueryKey,
  type Lead,
  type LeadInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Phone,
  MapPin,
  User,
  Tag,
  CalendarClock,
  Pencil,
  Trash2,
  Sparkles,
  ArrowRight,
  StickyNote,
  FileEdit,
  MessageSquarePlus,
  History,
} from "lucide-react";

// Stage constants + badge styles, kept in sync with pages/leads.tsx, the proxy
// (portal.ts) and the upstream lead controller.
const STAGES = [
  "New Lead",
  "Contacted",
  "Interested",
  "Visit/Demo Scheduled",
  "Negotiating",
  "Won (Converted)",
  "Lost",
] as const;

const STAGE_STYLES: Record<string, string> = {
  "New Lead": "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Contacted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Interested: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  "Visit/Demo Scheduled": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Negotiating: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  "Won (Converted)": "bg-green-100 text-green-700 hover:bg-green-100",
  Lost: "bg-red-100 text-red-700 hover:bg-red-100",
};

function formatDate(raw: unknown): string {
  if (!raw) return "—";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(raw: unknown): string {
  if (!raw) return "";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Owner id of a lead — `affiliate` is a bare id string or a populated object.
export function leadAffiliateId(lead: Lead | undefined): string {
  if (!lead) return "";
  const aff = (lead as Record<string, unknown>)["affiliate"];
  if (aff && typeof aff === "object") {
    return String((aff as Record<string, unknown>)["_id"] ?? "");
  }
  return String(aff ?? "");
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
        Stage changed from <span className="font-medium">{activity.from || "—"}</span> to{" "}
        <span className="font-medium">{activity.to || "—"}</span>
      </span>
    );
  }
  if (action === "follow_up_set") {
    if (!activity.to) return <span>Follow-up date cleared</span>;
    return (
      <span>
        Follow-up set for <span className="font-medium">{formatDate(activity.to)}</span>
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

export default function LeadDetailSheet({
  leadId,
  onOpenChange,
  myId,
  ownerName,
  onEdit,
  onDelete,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  myId: string | undefined;
  // Resolves the display name of the lead's owner (used in team views).
  ownerName: (lead: Lead) => string;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState("");

  const {
    data: lead,
    isLoading,
    isError,
  } = useGetPortalLead(leadId ?? "", {
    query: {
      enabled: !!leadId,
      queryKey: getGetPortalLeadQueryKey(leadId ?? ""),
    },
  });

  const updateMut = useUpdatePortalLead();
  const noteMut = useAddPortalLeadActivity();

  // A master can open a team member's lead, but only the owner may change it.
  const isOwn = !!lead && !!myId && leadAffiliateId(lead) === myId;

  function invalidate() {
    if (leadId) {
      queryClient.invalidateQueries({
        queryKey: getGetPortalLeadQueryKey(leadId),
      });
    }
    queryClient.invalidateQueries({ queryKey: getListPortalLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPortalLeadStatsQueryKey() });
  }

  function changeStage(stage: string) {
    if (!lead?._id || stage === lead.stage) return;
    updateMut.mutate(
      // Only `stage` changes — the proxy/upstream apply just the sent fields,
      // but businessName is included to satisfy the input contract.
      { id: lead._id, data: { businessName: lead.businessName ?? "", stage } as LeadInput },
      {
        onSuccess: () => {
          toast({ title: "Stage updated", description: `Moved to "${stage}".` });
          invalidate();
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Could not update stage",
            description: "Please try again.",
          }),
      },
    );
  }

  function submitNote() {
    const note = noteDraft.trim();
    if (!lead?._id || !note) return;
    noteMut.mutate(
      { id: lead._id, data: { note } },
      {
        onSuccess: () => {
          setNoteDraft("");
          toast({ title: "Note added" });
          invalidate();
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Could not add note",
            description:
              "Please try again. If this keeps failing, the lead server may need an update.",
          }),
      },
    );
  }

  const activities = ((lead as Record<string, unknown> | undefined)?.[
    "activities"
  ] ?? []) as Activity[];
  const timeline = [...activities].reverse();

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
                <Badge
                  variant="secondary"
                  className={STAGE_STYLES[lead.stage ?? ""] ?? "bg-muted text-foreground"}
                >
                  {lead.stage ?? "New Lead"}
                </Badge>
                {lead.source && (
                  <Badge variant="outline" className="text-xs">
                    {lead.source}
                  </Badge>
                )}
                {!isOwn && (
                  <Badge variant="outline" className="text-xs">
                    {ownerName(lead)} · view only
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-5 px-6 py-5">
              {/* Quick stage change (owner only) */}
              {isOwn && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pipeline stage
                  </p>
                  <Select
                    value={lead.stage ?? "New Lead"}
                    onValueChange={changeStage}
                    disabled={updateMut.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Details */}
              <div className="grid gap-3">
                <DetailRow icon={<User className="h-4 w-4" />} label="Contact person">
                  {lead.contactPerson || "—"}
                </DetailRow>
                <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
                  {lead.phonenumber ? (
                    <a href={`tel:${lead.phonenumber}`} className="underline-offset-2 hover:underline">
                      {lead.phonenumber}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow icon={<Tag className="h-4 w-4" />} label="Business type">
                  {lead.businessType || "—"}
                </DetailRow>
                <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location">
                  {lead.location || "—"}
                </DetailRow>
                <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Next follow-up">
                  {formatDate(lead.nextFollowUpDate)}
                </DetailRow>
                {lead.notes && (
                  <DetailRow icon={<StickyNote className="h-4 w-4" />} label="Notes">
                    <span className="whitespace-pre-wrap">{lead.notes}</span>
                  </DetailRow>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Added {formatDate((lead as Record<string, unknown>)["createAt"])}
              </p>

              {isOwn && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onEdit(lead)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => onDelete(lead)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              )}

              <Separator />

              {/* Activity timeline */}
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Activity
                </p>

                {isOwn && (
                  <div className="space-y-2">
                    <Textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Log a call, meeting or anything worth remembering…"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={submitNote}
                      disabled={noteMut.isPending || noteDraft.trim() === ""}
                    >
                      {noteMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                      )}
                      Add note
                    </Button>
                  </div>
                )}

                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No activity recorded yet. Stage changes and notes will show
                    up here.
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
                          {formatDateTime(activity.at)}
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
