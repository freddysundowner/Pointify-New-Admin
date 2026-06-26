import { useState, useEffect } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLocation, useSearch } from "wouter";
import {
  useListShops,
  ListShopsSubscriptionStatus,
  ListShopsSubscriptionType,
  type Shop,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  ShopActionsMenu,
  TypeBadge,
  StatusBadge,
  asOwner,
  type ShopOwner,
} from "@/components/ShopActionsMenu";

const LIMIT = 20;

type StatusFilter = "all" | "active" | "expired";
type TypeFilter = "all" | "trial" | "production";

export default function Shops() {
  // The list state (page + filters) lives in the URL so that navigating into a
  // shop's data and back returns the operator to the exact same view.
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const sp = new URLSearchParams(searchString);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const search = sp.get("name") ?? "";
  const status = (sp.get("status") as StatusFilter) || "all";
  const type = (sp.get("type") as TypeFilter) || "all";

  const [searchInput, setSearchInput] = useState(search);

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

  // Debounce the shop-name search so we don't hit upstream on every keystroke,
  // then commit the value to the URL (resetting to the first page). We read the
  // live query at fire time (not a stale closure) so a filter the user changed
  // mid-debounce is preserved.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if ((next.get("name") ?? "") === trimmed) return;
      if (trimmed) next.set("name", trimmed);
      else next.delete("name");
      next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${location}?${qs}` : location);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // The Shops URL the operator is currently viewing, carried into shop-scoped
  // pages so their "Back to Shops" returns here with the same page/filters.
  const fromUrl = `${location}${searchString ? `?${searchString}` : ""}`;

  const params = {
    page,
    limit: LIMIT,
    ...(search ? { name: search } : {}),
    ...(status !== "all"
      ? { subscriptionStatus: ListShopsSubscriptionStatus[status] }
      : {}),
    ...(type !== "all" ? { subscriptionType: ListShopsSubscriptionType[type] } : {}),
  };

  const { data, isLoading, isFetching } = useListShops(params);

  const shops = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const count = data?.count ?? 0;
  const currentPage = data?.currentPage ?? page;
  const rangeStart = count === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const rangeEnd = Math.min(currentPage * LIMIT, count);

  const hasAnyFilter = Boolean(search || status !== "all" || type !== "all");
  const clearFilters = () => {
    setSearchInput("");
    navigate(location);
  };

  const ownerLabel = (shop: Shop): { email: string; phone: string } => {
    const owner: ShopOwner | null = asOwner(shop.adminId);
    return {
      email: owner?.email || "—",
      phone: owner?.phone || "",
    };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Shops" description="Manage all shops registered on the platform." />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>All Shops</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar
            className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-end"
            active={hasAnyFilter}
          >
            <div className="space-y-1.5">
              <Label htmlFor="search">Search shop</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Shop name"
                  className="pl-8 sm:w-56"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => goto({ status: v, page: 1 })}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => goto({ type: v, page: 1 })}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </FilterBar>
          <p className="pb-4 text-xs text-muted-foreground">
            Search matches shop names. The POS backend exposes the owner&apos;s email and phone
            (not their name), and supports filtering by active/expired status rather than a
            specific expiry date.
          </p>

          {isLoading ? (
            <div className="p-4">Loading shops...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[56px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.length ? (
                      shops.map((shop) => {
                        const owner = ownerLabel(shop);
                        return (
                          <TableRow key={shop._id}>
                            <TableCell className="font-medium">{shop.name || "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="truncate">{owner.email}</span>
                                {owner.phone && (
                                  <span className="text-xs text-muted-foreground">{owner.phone}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <TypeBadge shop={shop} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge shop={shop} />
                            </TableCell>
                            <TableCell className="text-right">
                              <ShopActionsMenu shop={shop} from={fromUrl} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No shops found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {shops.length ? (
                  shops.map((shop) => {
                    const owner = ownerLabel(shop);
                    return (
                      <div key={shop._id} className="rounded-lg border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate font-semibold">{shop.name || "—"}</p>
                          <div className="flex shrink-0 items-center gap-1">
                            <TypeBadge shop={shop} />
                            <ShopActionsMenu shop={shop} from={fromUrl} />
                          </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">Owner</dt>
                            <dd className="truncate">{owner.email}</dd>
                            {owner.phone && (
                              <dd className="text-xs text-muted-foreground">{owner.phone}</dd>
                            )}
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">Status</dt>
                            <dd className="mt-0.5">
                              <StatusBadge shop={shop} />
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No shops found.
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {count === 0
                    ? "No shops"
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
