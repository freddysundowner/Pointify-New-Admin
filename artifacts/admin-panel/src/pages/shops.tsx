import { useState, useEffect } from "react";
import {
  useListShops,
  ListShopsSubscriptionStatus,
  ListShopsSubscriptionType,
  type Shop,
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
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

const LIMIT = 20;

type StatusFilter = "all" | "active" | "expired";
type TypeFilter = "all" | "trial" | "production";

// The upstream list endpoint populates `adminId` with only { _id, email, phone }
// (no username) and `subscription` with its endDate, type and package type.
// Relation fields can also arrive as bare id strings, so read defensively.
interface ShopOwner {
  email?: string | null;
  phone?: string | null;
}
interface ShopSubscription {
  endDate?: string | null;
  type?: string | null;
  packageId?: { type?: string | null; title?: string | null } | string | null;
}

function asOwner(value: unknown): ShopOwner | null {
  if (value && typeof value === "object") return value as ShopOwner;
  return null;
}
function asSubscription(value: unknown): ShopSubscription | null {
  if (value && typeof value === "object") return value as ShopSubscription;
  return null;
}

function shopType(shop: Shop): "trial" | "production" | null {
  const sub = asSubscription(shop.subscription);
  const pkg = sub?.packageId;
  const pkgType = pkg && typeof pkg === "object" ? pkg.type : null;
  const raw = (pkgType || sub?.type || "").toLowerCase();
  if (raw === "production") return "production";
  if (raw === "trial") return "trial";
  return null;
}

function shopExpiry(shop: Shop): Date | null {
  const sub = asSubscription(shop.subscription);
  if (!sub?.endDate) return null;
  const d = new Date(sub.endDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function TypeBadge({ shop }: { shop: Shop }) {
  const t = shopType(shop);
  if (!t) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={t === "production" ? "default" : "secondary"}>
      {t === "production" ? "Production" : "Trial"}
    </Badge>
  );
}

function StatusBadge({ shop }: { shop: Shop }) {
  const expiry = shopExpiry(shop);
  if (!expiry) return <span className="text-muted-foreground">No subscription</span>;
  const active = expiry.getTime() >= Date.now();
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant={active ? "default" : "destructive"}
        className={active ? "w-fit bg-emerald-600 hover:bg-emerald-600/90" : "w-fit"}
      >
        {active ? "Active" : "Expired"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {active ? "Expires" : "Expired"} {dateFmt.format(expiry)}
      </span>
    </div>
  );
}

export default function Shops() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  // Debounce the shop-name search so we don't hit upstream on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets back to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, status, type]);

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
    setSearch("");
    setStatus("all");
    setType("all");
  };

  const ownerLabel = (shop: Shop): { email: string; phone: string } => {
    const owner = asOwner(shop.adminId);
    return {
      email: owner?.email || "—",
      phone: owner?.phone || "",
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shops</h1>
        <p className="text-muted-foreground">Manage all shops registered on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shops</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-end">
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
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
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
              <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
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
          </div>
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
                      <TableHead>Contact</TableHead>
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
                            <TableCell>{shop.contact || "—"}</TableCell>
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
                          <div className="shrink-0">
                            <TypeBadge shop={shop} />
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
                          <div>
                            <dt className="text-xs text-muted-foreground">Status</dt>
                            <dd className="mt-0.5">
                              <StatusBadge shop={shop} />
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Contact</dt>
                            <dd>{shop.contact || "—"}</dd>
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
