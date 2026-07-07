import { useState, useEffect, useMemo } from "react";
import {
  useListPortalLeads,
  getListPortalLeadsQueryKey,
  useGetPortalLeadStats,
  getGetPortalLeadStatsQueryKey,
  useCreatePortalLead,
  useUpdatePortalLead,
  useDeletePortalLead,
  useListPortalShopCategories,
  type Lead,
  type LeadInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  Loader2,
  Plus,
  Search,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Trophy,
} from "lucide-react";

const PAGE_SIZE = 10;

// Confirmed pipeline, in order. Kept in sync with the proxy (portal.ts) and the
// upstream lead controller.
const STAGES = [
  "New Lead",
  "Contacted",
  "Interested",
  "Visit/Demo Scheduled",
  "Negotiating",
  "Won (Converted)",
  "Lost",
] as const;

const SOURCES = ["Referral", "Field Sales", "Digital", "Follow-Up"] as const;

const CLOSED_STAGES = new Set<string>(["Won (Converted)", "Lost"]);

// Badge styling per stage so the pipeline is scannable at a glance.
const STAGE_STYLES: Record<string, string> = {
  "New Lead": "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Contacted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Interested: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  "Visit/Demo Scheduled": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Negotiating: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  "Won (Converted)": "bg-green-100 text-green-700 hover:bg-green-100",
  Lost: "bg-red-100 text-red-700 hover:bg-red-100",
};

// A calendar date (yyyy-mm-dd) in East Africa Time. Follow-ups are day-granular
// and the whole platform runs in EAT.
function eatDateStr(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type FollowUpState = "overdue" | "today" | "upcoming" | null;

function followUpState(raw: unknown, stage: string): FollowUpState {
  if (!raw || CLOSED_STAGES.has(stage)) return null;
  const when = eatDateStr(new Date(String(raw)));
  const today = eatDateStr(new Date());
  if (when < today) return "overdue";
  if (when === today) return "today";
  return "upcoming";
}

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

// Empty draft used when creating a new lead.
const EMPTY_DRAFT: LeadInput = {
  businessName: "",
  contactPerson: "",
  phonenumber: "",
  businessType: "",
  location: "",
  source: "",
  stage: "New Lead",
  nextFollowUpDate: "",
  notes: "",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge
      variant="secondary"
      className={STAGE_STYLES[stage] ?? "bg-muted text-foreground"}
    >
      {stage}
    </Badge>
  );
}

function FollowUpLabel({ lead }: { lead: Lead }) {
  const state = followUpState(lead.nextFollowUpDate, lead.stage ?? "New Lead");
  if (!lead.nextFollowUpDate) {
    return <span className="text-muted-foreground">—</span>;
  }
  const base = formatDate(lead.nextFollowUpDate);
  if (state === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" />
        {base} · overdue
      </span>
    );
  }
  if (state === "today") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
        <CalendarClock className="h-3.5 w-3.5" />
        {base} · today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CalendarClock className="h-3.5 w-3.5" />
      {base}
    </span>
  );
}

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Debounce the free-text search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
      ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
    }),
    [page, search, stageFilter, sourceFilter],
  );

  const {
    data: result,
    isLoading,
    isError,
  } = useListPortalLeads(listParams, {
    query: { queryKey: getListPortalLeadsQueryKey(listParams) },
  });

  const { data: stats } = useGetPortalLeadStats({
    query: { queryKey: getGetPortalLeadStatsQueryKey() },
  });

  // Business Type options are the existing global shop categories.
  const { data: shopCategories } = useListPortalShopCategories();
  const businessTypes = useMemo(
    () =>
      ((shopCategories as Array<{ name?: string | null }> | undefined) ?? [])
        .map((c) => (c.name ?? "").trim())
        .filter((n) => n !== ""),
    [shopCategories],
  );

  const leads = (result?.data as Lead[]) || [];
  const totalPages = result?.totalPages || 1;
  const totalCount = result?.count || 0;
  const currentPage = result?.currentPage || page;

  useEffect(() => {
    if (result?.currentPage && result.currentPage !== page) {
      setPage(result.currentPage);
    }
  }, [result?.currentPage, page]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LeadInput>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const createMut = useCreatePortalLead();
  const updateMut = useUpdatePortalLead();
  const deleteMut = useDeletePortalLead();
  const saving = createMut.isPending || updateMut.isPending;

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getListPortalLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPortalLeadStatsQueryKey() });
  }

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingId(lead._id ?? null);
    setDraft({
      businessName: lead.businessName ?? "",
      contactPerson: lead.contactPerson ?? "",
      phonenumber: lead.phonenumber ?? "",
      businessType: lead.businessType ?? "",
      location: lead.location ?? "",
      source: lead.source ?? "",
      stage: lead.stage ?? "New Lead",
      nextFollowUpDate: lead.nextFollowUpDate
        ? String(lead.nextFollowUpDate).slice(0, 10)
        : "",
      notes: lead.notes ?? "",
    });
    setDialogOpen(true);
  }

  function set<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit() {
    if (!draft.businessName || draft.businessName.trim() === "") {
      toast({
        variant: "destructive",
        title: "Business name required",
        description: "Please enter the business name for this lead.",
      });
      return;
    }
    // Normalize: send null for empty optional fields, and only the date part.
    const payload: LeadInput = {
      businessName: draft.businessName.trim(),
      contactPerson: draft.contactPerson?.trim() || null,
      phonenumber: draft.phonenumber?.trim() || null,
      businessType: draft.businessType?.trim() || null,
      location: draft.location?.trim() || null,
      source: draft.source || null,
      stage: draft.stage || "New Lead",
      nextFollowUpDate: draft.nextFollowUpDate || null,
      notes: draft.notes?.trim() || null,
    };

    if (editingId) {
      updateMut.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead updated" });
            setDialogOpen(false);
            invalidateAll();
          },
          onError: () =>
            toast({
              variant: "destructive",
              title: "Could not update lead",
              description: "Please try again.",
            }),
        },
      );
    } else {
      createMut.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead added" });
            setDialogOpen(false);
            invalidateAll();
          },
          onError: () =>
            toast({
              variant: "destructive",
              title: "Could not add lead",
              description: "Please try again.",
            }),
        },
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget?._id) return;
    deleteMut.mutate(
      { id: deleteTarget._id },
      {
        onSuccess: () => {
          toast({ title: "Lead deleted" });
          setDeleteTarget(null);
          invalidateAll();
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Could not delete lead",
            description: "Please try again.",
          }),
      },
    );
  }

  const hasFilters =
    search !== "" || stageFilter !== "all" || sourceFilter !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">
            Track prospective businesses through your sales pipeline.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={stats?.total ?? 0}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Won"
          value={stats?.won ?? 0}
          icon={<Trophy className="h-4 w-4 text-green-600" />}
        />
        <StatCard
          label="Due Today"
          value={stats?.dueToday ?? 0}
          icon={<CalendarClock className="h-4 w-4 text-amber-600" />}
          highlight={(stats?.dueToday ?? 0) > 0 ? "amber" : undefined}
        />
        <StatCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          highlight={(stats?.overdue ?? 0) > 0 ? "red" : undefined}
        />
      </div>

      {/* Per-stage pipeline breakdown */}
      {stats?.byStage && stats.byStage.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byStage.map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => {
                setStageFilter(stageFilter === s.stage ? "all" : s.stage ?? "all");
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                stageFilter === s.stage
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.stage}
              <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold">
                {s.count ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search business, contact, phone, location…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-destructive">
              Failed to load leads. Please try again later.
            </div>
          ) : totalCount === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">
                {hasFilters ? "No matching leads" : "No leads yet"}
              </h3>
              <p className="text-muted-foreground">
                {hasFilters
                  ? "Try adjusting your search or filters."
                  : "Add your first lead to start building your pipeline."}
              </p>
              {!hasFilters && (
                <Button onClick={openCreate} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Add Lead
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {leads.map((lead) => (
                  <div key={lead._id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {lead.businessName}
                        </div>
                        {lead.contactPerson && (
                          <div className="truncate text-xs text-muted-foreground">
                            {lead.contactPerson}
                          </div>
                        )}
                      </div>
                      <StageBadge stage={lead.stage ?? "New Lead"} />
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {lead.phonenumber && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.phonenumber}</span>
                        </div>
                      )}
                      {lead.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <FollowUpLabel lead={lead} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {lead.source ? (
                        <Badge variant="outline" className="text-[10px]">
                          {lead.source}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(lead)}
                          className="h-8 gap-1 px-2 text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(lead)}
                          className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-md border md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Next Follow-Up</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead._id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {lead.businessName}
                          </div>
                          {(lead.businessType || lead.location) && (
                            <div className="text-xs text-muted-foreground">
                              {[lead.businessType, lead.location]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
                            {lead.contactPerson && (
                              <span className="text-foreground">
                                {lead.contactPerson}
                              </span>
                            )}
                            {lead.phonenumber && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                {lead.phonenumber}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={lead.stage ?? "New Lead"} />
                        </TableCell>
                        <TableCell>
                          {lead.source ? (
                            <Badge variant="outline">{lead.source}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <FollowUpLabel lead={lead} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(lead)}
                              className="h-8 w-8"
                              aria-label="Edit lead"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(lead)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Delete lead"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} · {totalCount} leads
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Lead" : "Add Lead"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this lead's details and pipeline stage."
                : "Capture a new prospective business."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="businessName">
                Business Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                value={draft.businessName ?? ""}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="e.g. Mama Njeri Groceries"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={draft.contactPerson ?? ""}
                  onChange={(e) => set("contactPerson", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phonenumber">Phone Number</Label>
                <Input
                  id="phonenumber"
                  value={draft.phonenumber ?? ""}
                  onChange={(e) => set("phonenumber", e.target.value)}
                  placeholder="07XX XXX XXX"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Business Type</Label>
                <Select
                  value={draft.businessType ?? ""}
                  onValueChange={(v) => set("businessType", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const current = (draft.businessType ?? "").trim();
                      const opts =
                        current && !businessTypes.includes(current)
                          ? [current, ...businessTypes]
                          : businessTypes;
                      if (opts.length === 0) {
                        return (
                          <SelectItem value="__none" disabled>
                            No categories found
                          </SelectItem>
                        );
                      }
                      return opts.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={draft.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Nakuru CBD"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Source</Label>
                <Select
                  value={draft.source ?? ""}
                  onValueChange={(v) => set("source", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Stage</Label>
                <Select
                  value={draft.stage ?? "New Lead"}
                  onValueChange={(v) => set("stage", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nextFollowUpDate">Next Follow-Up Date</Label>
              <Input
                id="nextFollowUpDate"
                type="date"
                value={draft.nextFollowUpDate ?? ""}
                onChange={(e) => set("nextFollowUpDate", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Anything worth remembering about this lead…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.businessName
                ? `"${deleteTarget.businessName}" will be permanently removed. This can't be undone.`
                : "This lead will be permanently removed. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: "amber" | "red";
}) {
  const ring =
    highlight === "red"
      ? "border-destructive/40 bg-destructive/5"
      : highlight === "amber"
        ? "border-amber-300 bg-amber-50"
        : "";
  return (
    <Card className={ring}>
      <CardContent className="flex items-center justify-between gap-2 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
