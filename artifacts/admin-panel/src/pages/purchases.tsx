import { useEffect, useState } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const PAGE_SIZE = 20;

const ANY = "all";

// Upstream treats paymentType="credit" as "has outstanding balance", and any
// other value as "fully settled", so we expose those two meaningful choices.
const PAYMENT_OPTIONS = [
  { value: "credit", label: "Credit (unpaid)" },
  { value: "cash", label: "Settled" },
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

export default function Purchases() {
  const { shopId, shopName, from } = useShopFilter();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [debouncedInvoice, setDebouncedInvoice] = useState("");
  const [paymentType, setPaymentType] = useState(ANY);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedInvoice(invoiceSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [invoiceSearch]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedInvoice, paymentType, start, end, shopId]);

  // Date range is only applied when both ends are set (upstream requires both).
  const dateRangeReady = Boolean(start && end);

  const { data, isLoading, isFetching } = useListPurchases({
    page,
    limit: PAGE_SIZE,
    shopId,
    purchaseNo: debouncedInvoice || undefined,
    paymentType: paymentType === ANY ? undefined : paymentType,
    start: dateRangeReady ? start : undefined,
    end: dateRangeReady ? end : undefined,
  });

  const purchases = data?.data ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const currentPage = data?.currentPage ?? page;

  const hasFilters =
    Boolean(invoiceSearch) || paymentType !== ANY || Boolean(start) || Boolean(end);

  const clearFilters = () => {
    setInvoiceSearch("");
    setPaymentType(ANY);
    setStart("");
    setEnd("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
        <p className="text-muted-foreground">View all platform purchases.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchases List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="lg:w-56">
              <label className="mb-1 block text-xs text-muted-foreground">Invoice No</label>
              <Input
                type="search"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice…"
              />
            </div>
            <div className="lg:w-44">
              <label className="mb-1 block text-xs text-muted-foreground">Payment status</label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All</SelectItem>
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
          </div>

          {isLoading ? (
            <div className="p-4">Loading purchases...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Attendant</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead className="text-right">Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.length ? (
                      purchases.map((purchase) => (
                        <TableRow key={purchase._id}>
                          <TableCell className="font-medium">
                            {purchase.invoiceNo || purchase.purchaseNo || "—"}
                          </TableCell>
                          <TableCell>{getShopName(purchase.shopId)}</TableCell>
                          <TableCell>{getAttendantName(purchase.attendantId)}</TableCell>
                          <TableCell>{formatKes(purchase.totalAmount)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(purchase.createdAt ?? purchase.createAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelected(purchase)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No purchases found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {purchases.length ? (
                  purchases.map((purchase) => (
                    <div
                      key={purchase._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {purchase.invoiceNo || purchase.purchaseNo || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {getShopName(purchase.shopId)}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Total Amount</dt>
                          <dd>{formatKes(purchase.totalAmount)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Attendant</dt>
                          <dd>{getAttendantName(purchase.attendantId)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Date &amp; Time</dt>
                          <dd>{formatDateTime(purchase.createdAt ?? purchase.createAt)}</dd>
                        </div>
                      </dl>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => setSelected(purchase)}
                      >
                        View invoice
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No purchases found.
                  </div>
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

      <ReceiptDialog kind="purchase" record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
