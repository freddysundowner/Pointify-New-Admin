import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDeleteShop,
  useUpdateShop,
  useGetShop,
  useListShopCategories,
  getListShopsQueryKey,
  getGetShopQueryKey,
  type Shop,
  type ShopUpdate,
} from "@workspace/api-client-react";
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

// The upstream list endpoint populates `adminId` with only { _id, email, phone }
// (no username) and `subscription` with its endDate, type and package type.
// Relation fields can also arrive as bare id strings, so read defensively.
export interface ShopOwner {
  email?: string | null;
  phone?: string | null;
}
interface ShopSubscription {
  endDate?: string | null;
  type?: string | null;
  packageId?: { type?: string | null; title?: string | null } | string | null;
}

export function asOwner(value: unknown): ShopOwner | null {
  if (value && typeof value === "object") return value as ShopOwner;
  return null;
}
function asSubscription(value: unknown): ShopSubscription | null {
  if (value && typeof value === "object") return value as ShopSubscription;
  return null;
}

export function shopType(shop: Shop): "trial" | "production" | null {
  const sub = asSubscription(shop.subscription);
  const pkg = sub?.packageId;
  const pkgType = pkg && typeof pkg === "object" ? pkg.type : null;
  const raw = (pkgType || sub?.type || "").toLowerCase();
  if (raw === "production") return "production";
  if (raw === "trial") return "trial";
  return null;
}

export function shopExpiry(shop: Shop): Date | null {
  const sub = asSubscription(shop.subscription);
  if (!sub?.endDate) return null;
  const d = new Date(sub.endDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function TypeBadge({ shop }: { shop: Shop }) {
  const t = shopType(shop);
  if (!t) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={t === "production" ? "default" : "secondary"}>
      {t === "production" ? "Production" : "Trial"}
    </Badge>
  );
}

export function StatusBadge({ shop }: { shop: Shop }) {
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

/**
 * Self-contained shop actions for any list of shops (main Shops page or a
 * single user's shops). Owns the View / Edit / Delete dialogs and the delete
 * mutation internally so callers only need to drop it in.
 *
 * `onChanged` lets the caller invalidate its own list query (e.g. a user's
 * shops) after an edit or delete, on top of the global shops list invalidation
 * the dialogs already perform.
 */
export function ShopActionsMenu({
  shop,
  from,
  onChanged,
}: {
  shop: Shop;
  from?: string;
  onChanged?: () => void;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteShop = useDeleteShop({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShopsQueryKey() });
        onChanged?.();
        toast({ title: "Shop deleted", description: shop.name || undefined });
        setDeleteOpen(false);
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open shop actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setViewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
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
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete shop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ViewShopDialog shop={viewOpen ? shop : null} onClose={() => setViewOpen(false)} />

      <EditShopDialog
        shop={editOpen ? shop : null}
        onClose={() => setEditOpen(false)}
        onChanged={onChanged}
      />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shop?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-semibold">{shop.name || "this shop"}</span>{" "}
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
                deleteShop.mutate({ id: shop._id });
              }}
            >
              {deleteShop.isPending ? "Deleting…" : "Delete shop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
              value={
                shop.createAt ? (
                  <div className="flex flex-col">
                    <span>{dateFmt.format(new Date(shop.createAt))}</span>
                    <span className="text-xs text-muted-foreground">
                      {timeFmt.format(new Date(shop.createAt))}
                    </span>
                  </div>
                ) : (
                  "—"
                )
              }
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

function EditShopDialog({
  shop,
  onClose,
  onChanged,
}: {
  shop: Shop | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
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
          <ShopEditForm key={detail._id} detail={detail} onDone={onClose} onChanged={onChanged} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShopEditForm({
  detail,
  onDone,
  onChanged,
}: {
  detail: Shop;
  onDone: () => void;
  onChanged?: () => void;
}) {
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
          onChanged?.();
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
