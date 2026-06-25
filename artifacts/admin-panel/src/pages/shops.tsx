import { useState, useEffect } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListShops,
  useDeleteShop,
  useUpdateShop,
  useGetShop,
  useListShopCategories,
  getListShopsQueryKey,
  getGetShopQueryKey,
  ListShopsSubscriptionStatus,
  ListShopsSubscriptionType,
  type Shop,
  type ShopUpdate,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  Package,
  Receipt,
  ShoppingCart,
  CreditCard,
  Users,
  Trash2,
  Loader2,
} from "lucide-react";
import { shopScopedHref } from "@/lib/shop-filter";

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
  const [viewShop, setViewShop] = useState<Shop | null>(null);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);

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

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteShop = useDeleteShop({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShopsQueryKey() });
        toast({ title: "Shop deleted", description: deleteTarget?.name || undefined });
        setDeleteTarget(null);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to delete shop",
          description: "The shop could not be deleted. Please try again.",
        });
      },
    },
  });

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
    const owner = asOwner(shop.adminId);
    return {
      email: owner?.email || "—",
      phone: owner?.phone || "",
    };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Shops" description="Manage all shops registered on the platform." />

      <Card>
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
                              <ShopActions
                                shop={shop}
                                from={fromUrl}
                                onView={() => setViewShop(shop)}
                                onEdit={() => setEditShop(shop)}
                                onDelete={() => setDeleteTarget(shop)}
                              />
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
                            <ShopActions
                              shop={shop}
                              from={fromUrl}
                              onView={() => setViewShop(shop)}
                              onEdit={() => setEditShop(shop)}
                              onDelete={() => setDeleteTarget(shop)}
                            />
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

      <ViewShopDialog shop={viewShop} onClose={() => setViewShop(null)} />

      <EditShopDialog shop={editShop} onClose={() => setEditShop(null)} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shop?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-semibold">{deleteTarget?.name || "this shop"}</span>{" "}
              from the platform. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteShop.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteShop.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteShop.mutate({ id: deleteTarget._id });
              }}
            >
              {deleteShop.isPending ? "Deleting…" : "Delete shop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShopActions({
  shop,
  from,
  onView,
  onEdit,
  onDelete,
}: {
  shop: Shop;
  from?: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open shop actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit shop
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Browse shop data
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={shopScopedHref("/products", shop, from)}>
            <Package className="mr-2 h-4 w-4" />
            Products
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={shopScopedHref("/sales", shop, from)}>
            <Receipt className="mr-2 h-4 w-4" />
            Sales
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={shopScopedHref("/purchases", shop, from)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Purchases
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={shopScopedHref("/subscriptions", shop, from)}>
            <CreditCard className="mr-2 h-4 w-4" />
            Subscriptions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={shopScopedHref("/attendants", shop, from)}>
            <Users className="mr-2 h-4 w-4" />
            Attendants
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete shop
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 break-words">{value ?? "—"}</span>
    </div>
  );
}

function ViewShopDialog({ shop, onClose }: { shop: Shop | null; onClose: () => void }) {
  const owner = shop ? asOwner(shop.adminId) : null;
  const expiry = shop ? shopExpiry(shop) : null;
  const t = shop ? shopType(shop) : null;
  return (
    <Dialog open={Boolean(shop)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shop?.name || "Shop"}</DialogTitle>
          <DialogDescription>Shop details</DialogDescription>
        </DialogHeader>
        {shop && (
          <div className="divide-y">
            <DetailRow label="Name" value={shop.name} />
            <DetailRow label="Owner email" value={owner?.email} />
            <DetailRow label="Owner phone" value={owner?.phone} />
            <DetailRow
              label="Type"
              value={t ? (t === "production" ? "Production" : "Trial") : "—"}
            />
            <DetailRow
              label="Subscription"
              value={
                expiry
                  ? `${expiry.getTime() >= Date.now() ? "Active until" : "Expired on"} ${dateFmt.format(expiry)}`
                  : "No subscription"
              }
            />
            <DetailRow label="Products" value={shop.productCount ?? 0} />
            <DetailRow
              label="Created"
              value={shop.createAt ? dateFmt.format(new Date(shop.createAt)) : "—"}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shopStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function shopNum(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function genId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === "string") return id;
  }
  return "";
}

const NO_CATEGORY = "__none__";

function EditShopDialog({ shop, onClose }: { shop: Shop | null; onClose: () => void }) {
  // The list row may not carry every editable field, so load the full shop to
  // seed the form with accurate current values.
  const open = Boolean(shop);
  const { data, isLoading, isError } = useGetShop(shop?._id ?? "", {
    query: {
      enabled: open && Boolean(shop?._id),
      queryKey: getGetShopQueryKey(shop?._id ?? ""),
    },
  });
  const detail = data ?? shop;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit shop
          </DialogTitle>
          <DialogDescription>{shop?.name || "Shop"}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            Loading shop…
          </div>
        ) : isError || !detail ? (
          <p className="py-10 text-center text-sm text-destructive">
            Could not load this shop. Please try again.
          </p>
        ) : (
          <ShopEditForm key={detail._id} detail={detail} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShopEditForm({ detail, onDone }: { detail: Shop; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const update = useUpdateShop();
  const { data: categories } = useListShopCategories();

  const [name, setName] = useState(shopStr(detail.name));
  const [address, setAddress] = useState(shopStr(detail.address));
  const [contact, setContact] = useState(shopStr(detail.contact));
  const [currency, setCurrency] = useState(shopStr(detail.currency));
  const [tax, setTax] = useState(shopNum(detail.tax));
  const [shopCategoryId, setShopCategoryId] = useState(
    genId(detail.shopCategoryId) || NO_CATEGORY,
  );
  const [paybillTill, setPaybillTill] = useState(shopStr(detail.paybill_till));
  const [paybillAccount, setPaybillAccount] = useState(shopStr(detail.paybill_account));
  const [addressReceipt, setAddressReceipt] = useState(shopStr(detail.address_receipt));
  const [receiptEmail, setReceiptEmail] = useState(shopStr(detail.receiptemail));
  const [warehouseEmail, setWarehouseEmail] = useState(shopStr(detail.warehouseemail));
  const [backupEmail, setBackupEmail] = useState(shopStr(detail.backupemail));

  const [production, setProduction] = useState(Boolean(detail.production));
  const [warehouse, setWarehouse] = useState(Boolean(detail.warehouse));
  const [useWarehouse, setUseWarehouse] = useState(Boolean(detail.useWarehouse));
  const [trackbatches, setTrackbatches] = useState(Boolean(detail.trackbatches));
  const [allowOnlineSelling, setAllowOnlineSelling] = useState(
    detail.allowOnlineSelling !== false,
  );
  const [allownegativeselling, setAllownegativeselling] = useState(
    Boolean(detail.allownegativeselling),
  );
  const [showstockonline, setShowstockonline] = useState(Boolean(detail.showstockonline));
  const [showpriceonline, setShowpriceonline] = useState(Boolean(detail.showpriceonline));
  const [allowBackup, setAllowBackup] = useState(detail.allowBackup !== false);
  const [mpesaRequireValidation, setMpesaRequireValidation] = useState(
    Boolean(detail.mpesa_require_validation),
  );

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    // Text fields are sent as-is (including "") so blanking a field clears it.
    const strField = (v: string): string => v.trim();

    const payload: ShopUpdate = {
      name: name.trim(),
      address: strField(address),
      contact: strField(contact),
      currency: strField(currency),
      tax: tax === "" ? undefined : Number(tax),
      shopCategoryId: shopCategoryId === NO_CATEGORY ? null : shopCategoryId,
      paybill_till: strField(paybillTill),
      paybill_account: strField(paybillAccount),
      address_receipt: strField(addressReceipt),
      receiptemail: strField(receiptEmail),
      warehouseemail: strField(warehouseEmail),
      backupemail: strField(backupEmail),
      production,
      warehouse,
      useWarehouse,
      trackbatches,
      allowOnlineSelling,
      allownegativeselling,
      showstockonline,
      showpriceonline,
      allowBackup,
      mpesa_require_validation: mpesaRequireValidation,
    };

    update.mutate(
      { id: detail._id, data: payload },
      {
        onSuccess: (res) => {
          const err = (res as { error?: string } | undefined)?.error;
          if (err) {
            toast({ title: "Update failed", description: err, variant: "destructive" });
            return;
          }
          toast({ title: "Shop updated" });
          queryClient.invalidateQueries({ queryKey: getListShopsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetShopQueryKey(detail._id) });
          onDone();
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="s-name">Shop name</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-address">Address</Label>
          <Textarea
            id="s-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="s-contact">Contact</Label>
            <Input id="s-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-currency">Currency</Label>
            <Input
              id="s-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="KES"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-tax">Tax (%)</Label>
            <Input
              id="s-tax"
              type="number"
              inputMode="decimal"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Shop category</Label>
          <Select value={shopCategoryId} onValueChange={setShopCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              {(categories ?? [])
                .filter((c) => c._id)
                .map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name || c._id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm font-medium">Payments &amp; receipts</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-till">Paybill / Till number</Label>
              <Input id="s-till" value={paybillTill} onChange={(e) => setPaybillTill(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-paybill-acc">Paybill account</Label>
              <Input
                id="s-paybill-acc"
                value={paybillAccount}
                onChange={(e) => setPaybillAccount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-receipt-addr">Receipt address / footer</Label>
            <Input
              id="s-receipt-addr"
              value={addressReceipt}
              onChange={(e) => setAddressReceipt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="s-receipt-email">Receipt email</Label>
              <Input
                id="s-receipt-email"
                type="email"
                value={receiptEmail}
                onChange={(e) => setReceiptEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-warehouse-email">Warehouse email</Label>
              <Input
                id="s-warehouse-email"
                type="email"
                value={warehouseEmail}
                onChange={(e) => setWarehouseEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-backup-email">Backup email</Label>
              <Input
                id="s-backup-email"
                type="email"
                value={backupEmail}
                onChange={(e) => setBackupEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1 rounded-md border p-4">
          <p className="pb-2 text-sm font-medium">Settings</p>
          <ShopToggle label="Production mode" checked={production} onChange={setProduction} />
          <ShopToggle label="Warehouse enabled" checked={warehouse} onChange={setWarehouse} />
          <ShopToggle label="Use warehouse" checked={useWarehouse} onChange={setUseWarehouse} />
          <ShopToggle label="Track batches" checked={trackbatches} onChange={setTrackbatches} />
          <ShopToggle
            label="Allow online selling"
            checked={allowOnlineSelling}
            onChange={setAllowOnlineSelling}
          />
          <ShopToggle
            label="Allow negative selling"
            checked={allownegativeselling}
            onChange={setAllownegativeselling}
          />
          <ShopToggle
            label="Show stock online"
            checked={showstockonline}
            onChange={setShowstockonline}
          />
          <ShopToggle
            label="Show price online"
            checked={showpriceonline}
            onChange={setShowpriceonline}
          />
          <ShopToggle label="Allow backup" checked={allowBackup} onChange={setAllowBackup} />
          <ShopToggle
            label="M-Pesa requires validation"
            checked={mpesaRequireValidation}
            onChange={setMpesaRequireValidation}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ShopToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="cursor-pointer font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
