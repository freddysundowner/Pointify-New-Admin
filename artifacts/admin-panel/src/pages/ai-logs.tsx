import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/layout/FilterBar";
import {
  useListAiLogs,
  useGetAiLogStats,
  type AiLog,
  type ListAiLogsParams,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, MessageSquareText, CheckCircle2, XCircle } from "lucide-react";
import { formatDateTime, formatKes, formatNumber } from "@/lib/utils";

const ALL = "all";

// Known insight types. The upstream may add more, so the list filter falls back
// to showing whatever value comes back even if it's not in this map.
const INSIGHT_LABELS: Record<string, string> = {
  daily_summary: "Daily summary",
  subscription_expiry: "Subscription expiry",
};

function insightLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  return INSIGHT_LABELS[value] ?? value.replace(/_/g, " ");
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <Card className="page-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-muted p-2">
          <Icon className={`h-5 w-5 ${toneClass}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SentBadge({ log }: { log: AiLog }) {
  if (log.smsSent) {
    return (
      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
        Sent
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-destructive/30 text-destructive">
      Failed
    </Badge>
  );
}

export default function AiLogs() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>(ALL);
  const [sent, setSent] = useState<string>(ALL);
  const [adminId, setAdminId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Committed filters drive the query; the adminId text input is applied on submit.
  const [adminIdApplied, setAdminIdApplied] = useState("");

  const listParams = useMemo<ListAiLogsParams>(() => {
    const params: ListAiLogsParams = { page, limit: 20 };
    if (type !== ALL) params.type = type;
    if (sent !== ALL) params.sent = sent === "sent";
    if (adminIdApplied.trim()) params.adminId = adminIdApplied.trim();
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }, [page, type, sent, adminIdApplied, from, to]);

  const { data, isLoading, isFetching } = useListAiLogs(listParams);
  const { data: stats } = useGetAiLogStats(
    {
      ...(adminIdApplied.trim() ? { adminId: adminIdApplied.trim() } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  );

  const logs = data?.data ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const totalCount = data?.count ?? 0;

  const totals = stats?.totals;
  const breakdown = stats?.breakdown ?? [];

  const filtersActive =
    type !== ALL || sent !== ALL || Boolean(adminIdApplied) || Boolean(from) || Boolean(to);

  const resetPageThen = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const applyAdminId = () => {
    setPage(1);
    setAdminIdApplied(adminId);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="AI Insights"
        description="Automated AI insight messages sent to shop owners."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          icon={MessageSquareText}
          label="Total insights"
          value={formatNumber(totals?.total ?? 0)}
        />
        <StatCard
          icon={CheckCircle2}
          label="Sent"
          value={formatNumber(totals?.sent ?? 0)}
          tone="success"
        />
        <StatCard
          icon={XCircle}
          label="Failed"
          value={formatNumber(totals?.failed ?? 0)}
          tone="danger"
        />
      </div>

      {breakdown.length > 0 && (
        <Card className="page-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              By insight type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {breakdown.map((b) => (
                <div
                  key={b._id ?? "unknown"}
                  className="rounded-lg border bg-card p-3"
                >
                  <p className="font-medium">{insightLabel(b._id)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatNumber(b.total ?? 0)} total · {formatNumber(b.sent ?? 0)} sent ·{" "}
                    {formatNumber(b.failed ?? 0)} failed
                  </p>
                  {b.lastSentAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last: {formatDateTime(b.lastSentAt)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <FilterBar
        title="Filter insights"
        active={filtersActive}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="type-filter" className="text-xs">
            Insight type
          </Label>
          <Select value={type} onValueChange={(v) => resetPageThen(() => setType(v))}>
            <SelectTrigger id="type-filter" className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              <SelectItem value="daily_summary">Daily summary</SelectItem>
              <SelectItem value="subscription_expiry">Subscription expiry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sent-filter" className="text-xs">
            Delivery
          </Label>
          <Select value={sent} onValueChange={(v) => resetPageThen(() => setSent(v))}>
            <SelectTrigger id="sent-filter" className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from-filter" className="text-xs">
            From
          </Label>
          <Input
            id="from-filter"
            type="date"
            value={from}
            onChange={(e) => resetPageThen(() => setFrom(e.target.value))}
            className="w-full md:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="to-filter" className="text-xs">
            To
          </Label>
          <Input
            id="to-filter"
            type="date"
            value={to}
            onChange={(e) => resetPageThen(() => setTo(e.target.value))}
            className="w-full md:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin-filter" className="text-xs">
            Owner / Admin ID
          </Label>
          <div className="flex gap-2">
            <Input
              id="admin-filter"
              placeholder="Admin ID"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyAdminId();
              }}
              className="w-full md:w-48"
            />
            <Button variant="outline" onClick={applyAdminId}>
              Apply
            </Button>
          </div>
        </div>
      </FilterBar>

      <Card className="page-card">
        <CardHeader>
          <CardTitle>Insight log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading insights…</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length ? (
                      logs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell className="font-medium">
                            <div className="max-w-[180px]">
                              <p className="truncate">{log.shopName?.trim() || "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {log.ownerPhone || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{insightLabel(log.insightType)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate" title={log.message ?? undefined}>
                              {log.message || "—"}
                            </p>
                            {log.smsError ? (
                              <p className="truncate text-xs text-destructive" title={log.smsError}>
                                {log.smsError}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {log.stats?.revenue != null ? formatKes(log.stats.revenue) : "—"}
                          </TableCell>
                          <TableCell>
                            <SentBadge log={log} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No AI insights found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {logs.length ? (
                  logs.map((log) => (
                    <div key={log._id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {log.shopName?.trim() || "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {log.ownerPhone || "—"}
                          </p>
                        </div>
                        <SentBadge log={log} />
                      </div>
                      <p className="mt-2 text-sm">{log.message || "—"}</p>
                      {log.smsError ? (
                        <p className="mt-1 text-xs text-destructive">{log.smsError}</p>
                      ) : null}
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Type</dt>
                          <dd>{insightLabel(log.insightType)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Revenue</dt>
                          <dd>
                            {log.stats?.revenue != null ? formatKes(log.stats.revenue) : "—"}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Date</dt>
                          <dd>{formatDateTime(log.createdAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No AI insights found.
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {totalCount > 0
                    ? `Page ${page} of ${totalPages} · ${totalCount} insight${totalCount === 1 ? "" : "s"}`
                    : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isFetching}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
