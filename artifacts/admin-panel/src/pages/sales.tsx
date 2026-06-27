import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { useListSales } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { formatDateTime, formatKes } from "@/lib/utils";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { SaleManageDialog } from "@/components/SaleManageDialog";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const ANY = "all";

const STATUS_OPTIONS = [
  { value: "cashed", label: "Cashed" },
  { value: "hold", label: "Hold" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank", label: "Bank" },
  { value: "credit", label: "Credit" },
  { value: "wallet", label: "Wallet" },
];

function getShopName(shop: unknown): string {
  if (!shop) return "N/A";
  if (typeof shop === "string") return shop;
  const s = shop as { name?: string; _id?: string };
  return s.name || s._id || "N/A";
}

function getAttendantName(attendant: unknown): string {
  if (!attendant || typeof attendant === "string") return "—";
  const a = attendant as { username?: string };
  return a.username || "—";
}

export default function Sales() {
  const { shopId, shopName, from } = useShopFilter();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [managed, setManaged] = useState<Record<string, unknown> | null>(null);

  const [receiptSearch, setReceiptSearch] = useState("");
  const [debouncedReceipt, setDebouncedReceipt] = useState("");
  const [status, setStatus] = useState(ANY);
  const [paymentType, setPaymentType] = useState(ANY);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [showFuture, setShowFuture] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedReceipt(receiptSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [receiptSearch]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedReceipt, status, paymentType, start, end, shopId]);

  // Date range is only applied when both ends are set (upstream requires both).
  const dateRangeReady = Boolean(start && end);

  const { data, isLoading, isFetching } = useListSales({
    page,
    limit: PAGE_SIZE,
    shopId,
    receiptNo: debouncedReceipt || undefined,
    status: status === ANY ? undefined : status,
    paymentType: paymentType === ANY ? undefined : paymentType,
    // Upstream defaults paymentTag to "cash" (hiding non-cash sales) when no
    // payment filter is sent. An explicit empty paymentTag disables that branch
    // so "All payments" truly returns every payment type.
    paymentTag: "",
    start: dateRangeReady ? start : undefined,
    end: dateRangeReady ? end : undefined,
  });

  const sales = data?.data ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const currentPage = data?.currentPage ?? page;

  // Some sales come back with a timestamp later than "now" (e.g. device clock
  // drift at the shop). Split them out so they can be folded away by default.
  const { currentSales, futureSales } = useMemo(() => {
    const now = Date.now();
    const current: typeof sales = [];
    const future: typeof sales = [];
    for (const sale of sales) {
      const ts = new Date((sale.createdAt ?? sale.createAt) as string).getTime();
      if (Number.isFinite(ts) && ts > now) future.push(sale);
      else current.push(sale);
    }
    return { currentSales: current, futureSales: future };
  }, [sales]);

  // Re-fold future-dated sales whenever the visible page changes.
  useEffect(() => {
    setShowFuture(false);
  }, [currentPage]);

  const hasFilters =
    Boolean(receiptSearch) ||
    status !== ANY ||
    paymentType !== ANY ||
    Boolean(start) ||
    Boolean(end);

  const clearFilters = () => {
    setReceiptSearch("");
    setStatus(ANY);
    setPaymentType(ANY);
    setStart("");
    setEnd("");
  };

  type SaleItem = (typeof sales)[number];

  const futureBadge = (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
      Future
    </Badge>
  );

  const renderSaleRow = (sale: SaleItem, future = false) => (
    <TableRow key={sale._id} className={future ? "bg-amber-50/40" : undefined}>
      <TableCell className="font-medium">{sale.receiptNo || "—"}</TableCell>
      <TableCell>{getShopName(sale.shopId)}</TableCell>
      <TableCell>{getAttendantName(sale.attendantId)}</TableCell>
      <TableCell>{formatKes(sale.totalAmount)}</TableCell>
      <TableCell>
        <Badge variant="outline">{sale.status}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          {formatDateTime(sale.createdAt ?? sale.createAt)}
          {future && futureBadge}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelected(sale)}>
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManaged(sale)}>
            Manage
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  const renderSaleCard = (sale: SaleItem, future = false) => (
    <div
      key={sale._id}
      className={`rounded-lg border bg-card p-4 shadow-sm ${
        future ? "border-amber-200 bg-amber-50/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{sale.receiptNo || "—"}</p>
          <p className="truncate text-sm text-muted-foreground">{getShopName(sale.shopId)}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {sale.status}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd>{formatKes(sale.totalAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Attendant</dt>
          <dd>{getAttendantName(sale.attendantId)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Date &amp; Time</dt>
          <dd className="flex items-center gap-2">
            {formatDateTime(sale.createdAt ?? sale.createAt)}
            {future && futureBadge}
          </dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelected(sale)}>
          View receipt
        </Button>
        <Button variant="outline" size="sm" onClick={() => setManaged(sale)}>
          Manage
        </Button>
      </div>
    </div>
  );

  const futureToggleLabel = (
    <>
      {showFuture ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      <CalendarClock className="h-4 w-4 text-amber-600" />
      <span className="font-medium">Future-dated sales</span>
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
        {futureSales.length}
      </Badge>
      <span className="ml-auto text-muted-foreground">{showFuture ? "Hide" : "Show"}</span>
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Sales" description="View all platform sales." />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}

          <FilterBar
            className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
            active={hasFilters}
          >
            <div className="lg:w-56">
              <label className="mb-1 block text-xs text-muted-foreground">Receipt No</label>
              <Input
                type="search"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder="Search receipt…"
              />
            </div>
            <div className="lg:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">Payment type</label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All payments</SelectItem>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <Input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="lg:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterBar>

          {isLoading ? (
            <div className="p-4">Loading sales...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Attendant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No sales found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {currentSales.map((sale) => renderSaleRow(sale))}
                        {futureSales.length > 0 && (
                          <>
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="p-0">
                                <button
                                  type="button"
                                  aria-expanded={showFuture}
                                  onClick={() => setShowFuture((v) => !v)}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                                >
                                  {futureToggleLabel}
                                </button>
                              </TableCell>
                            </TableRow>
                            {showFuture &&
                              futureSales.map((sale) => renderSaleRow(sale, true))}
                          </>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {sales.length === 0 ? (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No sales found.
                  </div>
                ) : (
                  <>
                    {currentSales.map((sale) => renderSaleCard(sale))}
                    {futureSales.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/40">
                        <button
                          type="button"
                          aria-expanded={showFuture}
                          onClick={() => setShowFuture((v) => !v)}
                          className="flex w-full items-center gap-2 p-3 text-left text-sm"
                        >
                          {futureToggleLabel}
                        </button>
                        {showFuture && (
                          <div className="space-y-3 p-3 pt-0">
                            {futureSales.map((sale) => renderSaleCard(sale, true))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isFetching}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isFetching}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ReceiptDialog kind="sale" record={selected} onClose={() => setSelected(null)} />
      <SaleManageDialog sale={managed} onClose={() => setManaged(null)} />
    </div>
  );
}
