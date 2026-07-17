import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useListLeads,
  getListLeadsQueryKey,
  useListPartners,
  getListPartnersQueryKey,
  listLeads,
  type Lead,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import LeadDetailDialog from "@/components/LeadDetailDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Loader2,
  Search,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
  CalendarClock,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

// Kept in sync with the partner portal pipeline and the upstream lead store.
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

// Quote a value for CSV: wrap in quotes and double any embedded quotes.
// Cells starting with =, +, - or @ get a leading apostrophe so spreadsheet
// apps treat them as text instead of executing them as formulas.
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function fmtDate(raw: unknown): string {
  if (!raw) return "—";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// `affiliate` is a populated object ({ _id, name, … }) or a bare id string.
export function leadPartnerName(lead: Lead): { id: string; name: string } {
  const aff = (lead as Record<string, unknown>)["affiliate"];
  if (aff && typeof aff === "object") {
    const obj = aff as Record<string, unknown>;
    return {
      id: String(obj["_id"] ?? ""),
      name: String(obj["name"] ?? "") || "—",
    };
  }
  return { id: String(aff ?? ""), name: "—" };
}

export default function Leads() {
  // Deep link: /leads?partner=<id> preselects the partner filter (used by the
  // partner detail page). Read once on mount; the filter drives state after.
  const [partnerFilter, setPartnerFilter] = useState<string>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("partner");
    return fromUrl && fromUrl.trim() !== "" ? fromUrl.trim() : "all";
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  // Lead opened in the read-only detail sheet.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Partner dropdown options. The platform has a manageable number of
  // partners, so fetch one large page for the filter.
  const partnersParams = { page: 1, limit: 500 };
  const { data: partnersResult } = useListPartners(partnersParams, {
    query: { queryKey: getListPartnersQueryKey(partnersParams) },
  });
  const partners = useMemo(
    () => partnersResult?.data ?? [],
    [partnersResult?.data],
  );
  const partnerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of partners) {
      if (p._id) map.set(p._id, p.name ?? p.email ?? p._id);
    }
    return map;
  }, [partners]);

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(partnerFilter !== "all" ? { partnerId: partnerFilter } : {}),
      ...(search ? { search } : {}),
      ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
    }),
    [page, partnerFilter, search, stageFilter],
  );

  const {
    data: result,
    isLoading,
    isError,
  } = useListLeads(listParams, {
    query: { queryKey: getListLeadsQueryKey(listParams) },
  });

  const leads = (result?.data as Lead[]) || [];
  const totalPages = result?.totalPages || 1;
  const totalCount = result?.count || 0;
  const currentPage = result?.currentPage || page;

  function partnerLabel(lead: Lead): string {
    const { id, name } = leadPartnerName(lead);
    if (name !== "—") return name;
    return partnerNameById.get(id) ?? "—";
  }

  const hasFilters =
    search !== "" || stageFilter !== "all" || partnerFilter !== "all";

  // Download every lead matching the current filters as a CSV file. Fetches
  // all pages (200 per request) so the report is complete, not just the
  // visible page.
  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const all: Lead[] = [];
      const baseParams = {
        ...(partnerFilter !== "all" ? { partnerId: partnerFilter } : {}),
        ...(search ? { search } : {}),
        ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
      };
      let pageNum = 1;
      // Hard cap of 50 pages (10,000 leads) as a safety valve.
      for (;;) {
        const res = await listLeads({ ...baseParams, page: pageNum, limit: 200 });
        const rows = (res.data as Lead[]) ?? [];
        all.push(...rows);
        const total = res.totalPages ?? 1;
        if (pageNum >= total || rows.length === 0 || pageNum >= 50) break;
        pageNum += 1;
      }

      const header = [
        "Business",
        "Contact person",
        "Phone",
        "Business type",
        "Location",
        "Partner",
        "Source",
        "Stage",
        "Next follow-up",
        "Notes",
        "Created",
        "Last updated",
      ];
      const lines = [header.map(csvCell).join(",")];
      for (const lead of all) {
        const rec = lead as Record<string, unknown>;
        lines.push(
          [
            lead.businessName ?? "",
            lead.contactPerson ?? "",
            lead.phonenumber ?? "",
            lead.businessType ?? "",
            lead.location ?? "",
            partnerLabel(lead) === "—" ? "" : partnerLabel(lead),
            lead.source ?? "",
            lead.stage ?? "New Lead",
            lead.nextFollowUpDate ? String(lead.nextFollowUpDate).slice(0, 10) : "",
            lead.notes ?? "",
            rec["createAt"] ? String(rec["createAt"]).slice(0, 10) : "",
            lead.updatedAt ? String(lead.updatedAt).slice(0, 10) : "",
          ]
            .map(csvCell)
            .join(","),
        );
      }

      // \ufeff BOM so Excel opens it with correct UTF-8 accents/emoji.
      const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pointify-leads-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Report downloaded",
        description: `${all.length} lead${all.length === 1 ? "" : "s"} exported to CSV.`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not download the leads report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Leads"
        description="Prospective businesses captured by partners across the platform."
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search business, contact, phone, location…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* Searchable partner picker — the platform can have many partners,
            so a type-to-filter combobox beats a long dropdown. */}
        <Popover open={partnerPickerOpen} onOpenChange={setPartnerPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={partnerPickerOpen}
              className="w-full justify-between font-normal lg:w-56"
            >
              <span
                className={
                  partnerFilter !== "all" ? "truncate" : "text-muted-foreground"
                }
              >
                {partnerFilter !== "all"
                  ? (partnerNameById.get(partnerFilter) ?? partnerFilter)
                  : "All partners"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search partner…" />
              <CommandList>
                <CommandEmpty>No partner found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all"
                    onSelect={() => {
                      setPartnerFilter("all");
                      setPage(1);
                      setPartnerPickerOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        partnerFilter === "all" ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    All partners
                  </CommandItem>
                  {partners.map((p) =>
                    p._id ? (
                      <CommandItem
                        key={p._id}
                        value={`${p.name ?? ""} ${p.email ?? ""} ${p._id}`}
                        onSelect={() => {
                          setPartnerFilter(
                            partnerFilter === p._id ? "all" : p._id!,
                          );
                          setPage(1);
                          setPartnerPickerOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            partnerFilter === p._id
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">
                            {p.name ?? p.email ?? p._id}
                          </span>
                          {p.name && p.email && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.email}
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    ) : null,
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Select
          value={stageFilter}
          onValueChange={(v) => {
            setStageFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:w-52">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={exporting || isLoading || totalCount === 0}
          className="w-full lg:w-auto"
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <Card className="page-card">
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
                  : "Leads captured by partners will appear here."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {leads.map((lead) => (
                  <div
                    key={lead._id}
                    className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    onClick={() => setDetailId(lead._id ?? null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {lead.businessName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {partnerLabel(lead)}
                        </div>
                      </div>
                      <StageBadge stage={lead.stage ?? "New Lead"} />
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {lead.contactPerson && (
                        <div className="truncate">{lead.contactPerson}</div>
                      )}
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
                      {lead.nextFollowUpDate && (
                        <div className="flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                          <span>{fmtDate(lead.nextFollowUpDate)}</span>
                        </div>
                      )}
                    </div>
                    {lead.source && (
                      <div className="mt-3">
                        <Badge variant="outline" className="text-[10px]">
                          {lead.source}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-md border md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Next Follow-Up</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow
                        key={lead._id}
                        className="cursor-pointer"
                        onClick={() => setDetailId(lead._id ?? null)}
                      >
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
                        <TableCell className="text-sm">
                          {partnerLabel(lead)}
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
                          {fmtDate(lead.nextFollowUpDate)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmtDate(lead.createAt)}
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

      <LeadDetailDialog
        leadId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        partnerName={
          detailId
            ? partnerNameById.get(
                leadPartnerName(
                  leads.find((l) => l._id === detailId) ?? ({} as Lead),
                ).id,
              )
            : undefined
        }
      />
    </div>
  );
}
