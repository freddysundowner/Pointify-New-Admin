import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useListSubscriptions,
  ListSubscriptionsStatus,
  ListSubscriptionsType,
  type Subscription,
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
import { formatKes, formatDate } from "@/lib/utils";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

const LIMIT = 20;

type StatusFilter = "all" | "Active" | "Expired" | "Cancelled";
type TypeFilter = "all" | "trial" | "production";

function getShopName(shop: unknown): string {
  if (!shop) return "N/A";
  if (typeof shop === "string") return shop;
  const s = shop as { name?: string | null; _id?: string };
  return s.name || s._id || "N/A";
}

export default function Subscriptions() {
  const { shopId, shopName, from } = useShopFilter();
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const sp = new URLSearchParams(searchString);

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = (sp.get("status") as StatusFilter) || "all";
  const type = (sp.get("type") as TypeFilter) || "all";
  const shopname = sp.get("shopname") ?? "";
  const invoiceNo = sp.get("invoiceNo") ?? "";
  const createAt = sp.get("createAt") ?? "";
  const expFrom = sp.get("expiryperiodFrom") ?? "";
  const expTo = sp.get("expiryperiodTo") ?? "";

  const [shopnameInput, setShopnameInput] = useState(shopname);
  const [invoiceInput, setInvoiceInput] = useState(invoiceNo);

  // Compose a new URL from the current query plus overrides, dropping defaults.
  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchString);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === "all" || (k === "page" && Number(v) <= 1)) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    const qs = next.toString();
    return qs ? `${location}?${qs}` : location;
  };
  const goto = (overrides: Record<string, string | number | undefined>) =>
    navigate(buildUrl(overrides));

  // Debounce the free-text inputs (shop name, invoice) and commit to the URL,
  // resetting to the first page. Read the live query at fire time so a filter
  // changed mid-debounce is preserved.
  useEffect(() => {
    const trimmed = shopnameInput.trim();
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if ((next.get("shopname") ?? "") === trimmed) return;
      if (trimmed) next.set("shopname", trimmed);
      else next.delete("shopname");
      next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${location}?${qs}` : location);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopnameInput]);

  useEffect(() => {
    const trimmed = invoiceInput.trim();
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if ((next.get("invoiceNo") ?? "") === trimmed) return;
      if (trimmed) next.set("invoiceNo", trimmed);
      else next.delete("invoiceNo");
      next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${location}?${qs}` : location);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceInput]);

  // The expiry range is only honoured upstream when BOTH ends are present.
  const expiryActive = Boolean(expFrom && expTo);

  const params = {
    page,
    limit: LIMIT,
    ...(shopId ? { shop: shopId } : {}),
    ...(status !== "all" ? { status: ListSubscriptionsStatus[status] } : {}),
    ...(type !== "all" ? { type: ListSubscriptionsType[type] } : {}),
    ...(shopname ? { shopname } : {}),
    ...(invoiceNo ? { invoiceNo } : {}),
    ...(createAt ? { createAt } : {}),
    ...(expiryActive ? { expiryperiodFrom: expFrom, expiryperiodTo: expTo } : {}),
  };

  const { data, isLoading, isFetching } = useListSubscriptions(params);

  const subs = (data?.data ?? []) as Subscription[];
  const totalPages = data?.totalPages ?? 1;
  const count = data?.count ?? 0;
  const currentPage = data?.currentPage ?? page;
  const rangeStart = count === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const rangeEnd = Math.min(currentPage * LIMIT, count);

  const hasAnyFilter = Boolean(
    status !== "all" ||
      type !== "all" ||
      shopname ||
      invoiceNo ||
      createAt ||
      expiryActive,
  );
  const clearFilters = () => {
    setShopnameInput("");
    setInvoiceInput("");
    // Preserve the shop-scoping params (shop/shopName/from) if present.
    const next = new URLSearchParams();
    for (const k of ["shop", "shopName", "from"]) {
      const v = sp.get(k);
      if (v) next.set(k, v);
    }
    const qs = next.toString();
    navigate(qs ? `${location}?${qs}` : location);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground">Manage all shop subscriptions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}

          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-end">
            {!shopId && (
              <div className="space-y-1.5">
                <Label htmlFor="sub-shopname">Search shop</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sub-shopname"
                    value={shopnameInput}
                    onChange={(e) => setShopnameInput(e.target.value)}
                    placeholder="Shop name"
                    className="pl-8 sm:w-48"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sub-invoice">Invoice no.</Label>
              <Input
                id="sub-invoice"
                value={invoiceInput}
                onChange={(e) => setInvoiceInput(e.target.value)}
                placeholder="Invoice number"
                className="sm:w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => goto({ status: v, page: 1 })}>
                <SelectTrigger className="sm:w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => goto({ type: v, page: 1 })}>
                <SelectTrigger className="sm:w-36">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-created">Created on</Label>
              <Input
                id="sub-created"
                type="date"
                value={createAt}
                onChange={(e) => goto({ createAt: e.target.value, page: 1 })}
                className="sm:w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-exp-from">Expiry from</Label>
              <Input
                id="sub-exp-from"
                type="date"
                value={expFrom}
                onChange={(e) => goto({ expiryperiodFrom: e.target.value, page: 1 })}
                className="sm:w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-exp-to">Expiry to</Label>
              <Input
                id="sub-exp-to"
                type="date"
                value={expTo}
                onChange={(e) => goto({ expiryperiodTo: e.target.value, page: 1 })}
                className="sm:w-40"
              />
            </div>
            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          {(expFrom || expTo) && !expiryActive && (
            <p className="pb-4 text-xs text-amber-600">
              Set both “Expiry from” and “Expiry to” to filter by expiry date range.
            </p>
          )}

          {isLoading ? (
            <div className="p-4">Loading subscriptions...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.length ? (
                      subs.map((sub) => (
                        <TableRow key={sub._id}>
                          <TableCell className="font-medium">{getShopName(sub.shop)}</TableCell>
                          <TableCell>{sub.invoiceNo || "—"}</TableCell>
                          <TableCell className="capitalize">{sub.type || "—"}</TableCell>
                          <TableCell>{formatKes(sub.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status ? "default" : "destructive"}>
                              {sub.status ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(sub.endDate)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No subscriptions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {subs.length ? (
                  subs.map((sub) => (
                    <div key={sub._id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{getShopName(sub.shop)}</p>
                          <p className="truncate text-sm capitalize text-muted-foreground">
                            {sub.type || "—"}
                          </p>
                        </div>
                        <Badge variant={sub.status ? "default" : "destructive"} className="shrink-0">
                          {sub.status ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Invoice</dt>
                          <dd className="truncate">{sub.invoiceNo || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Amount</dt>
                          <dd>{formatKes(sub.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">End Date</dt>
                          <dd>{formatDate(sub.endDate)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No subscriptions found.
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {count === 0
                    ? "No subscriptions"
                    : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${count.toLocaleString()}`}
                  {isFetching && " …"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goto({ page: page - 1 })}
                    disabled={currentPage <= 1 || isFetching}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goto({ page: Math.min(totalPages, page + 1) })}
                    disabled={currentPage >= totalPages || isFetching}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
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
