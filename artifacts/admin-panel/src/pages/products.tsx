import { useEffect, useState } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useGetProduct,
  useUpdateProduct,
  useListProductCategories,
  useListProductStockHistory,
  useListProductSalesHistory,
  useListProductPurchasesHistory,
  useGetProductHistorySummary,
  getListProductsQueryKey,
  getGetProductQueryKey,
  type Product,
  type ProductUpdate,
  type Batch,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Boxes,
  Loader2,
  MoreHorizontal,
  History,
  Pencil,
} from "lucide-react";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { formatKes, formatNumber, formatDate } from "@/lib/utils";

function getShopName(shop: unknown): string {
  if (!shop) return "N/A";
  if (typeof shop === "string") return shop;
  const s = shop as { name?: string; _id?: string };
  return s.name || s._id || "N/A";
}

function stockBadgeVariant(qty: unknown) {
  return Number(qty) > 0 ? "default" : "destructive";
}

export default function Products() {
  const { shopId, shopName, from } = useShopFilter();

  const [nameInput, setNameInput] = useState("");
  const [shopInput, setShopInput] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");

  // Debounce both search fields so we don't hit upstream on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setNameQuery(nameInput.trim()), 350);
    return () => clearTimeout(t);
  }, [nameInput]);
  useEffect(() => {
    const t = setTimeout(() => setShopQuery(shopInput.trim()), 350);
    return () => clearTimeout(t);
  }, [shopInput]);

  const { data, isLoading, isFetching } = useListProducts({
    page: 1,
    limit: 20,
    ...(shopId ? { shopid: shopId } : {}),
    ...(nameQuery ? { name: nameQuery } : {}),
    // Shop-name search only applies when not already scoped to a single shop.
    ...(!shopId && shopQuery ? { shop: shopQuery } : {}),
  });

  const products = data?.data ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Products" description="Manage all products across shops." />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>Products List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}

          <FilterBar
            className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-end"
            active={Boolean(nameInput || shopInput)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="product-search">Search product</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product-search"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Product name"
                  className="pl-8 sm:w-56"
                />
              </div>
            </div>
            {!shopId && (
              <div className="space-y-1.5">
                <Label htmlFor="shop-search">Search shop</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="shop-search"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    placeholder="Shop name"
                    className="pl-8 sm:w-56"
                  />
                </div>
              </div>
            )}
            {isFetching && (
              <div className="flex items-center pb-2 text-sm text-muted-foreground">
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}
          </FilterBar>

          {isLoading ? (
            <div className="p-4">Loading products...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Name</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Date added</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length ? (
                      products.map((product) => (
                        <ProductRow key={product._id} product={product} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No products found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {products.length ? (
                  products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No products found.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductActions({
  product,
  onToggleInventory,
}: {
  product: Product;
  onToggleInventory: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
            aria-label="Product actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit product
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleInventory}>
            <Boxes className="mr-2 h-4 w-4" />
            View inventory
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            View history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProductDialog
        product={product}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ProductHistoryDialog
        product={product}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}

function num(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
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

/** Slices an ISO/date string to the `YYYY-MM-DD` form an <input type="date"> needs. */
function toDateInput(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function EditProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The list row omits several editable fields (description, dealerPrice, etc.),
  // so load the full product to seed the form with accurate current values.
  const { data, isLoading, isError } = useGetProduct(product._id, {
    query: { enabled: open, queryKey: getGetProductQueryKey(product._id) },
  });
  const detail = data ?? product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit product
          </DialogTitle>
          <DialogDescription>
            {product.name || "—"} · {getShopName(product.shopId)}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            Loading product…
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-destructive">
            Could not load this product. Please try again.
          </p>
        ) : (
          <ProductEditForm
            key={detail._id}
            detail={detail}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductEditForm({
  detail,
  onDone,
}: {
  detail: Product;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const update = useUpdateProduct();

  const [name, setName] = useState(str(detail.name));
  const [description, setDescription] = useState(str(detail.description));
  const [buyingPrice, setBuyingPrice] = useState(num(detail.buyingPrice));
  const [sellingPrice, setSellingPrice] = useState(num(detail.sellingPrice));
  const [wholesalePrice, setWholesalePrice] = useState(num(detail.wholesalePrice));
  const [dealerPrice, setDealerPrice] = useState(num(detail.dealerPrice));
  const [minSellingPrice, setMinSellingPrice] = useState(num(detail.minSellingPrice));
  const [maxDiscount, setMaxDiscount] = useState(num(detail.maxDiscount));
  const [quantity, setQuantity] = useState(num(detail.quantity));
  const [reorderLevel, setReorderLevel] = useState(num(detail.reorderLevel));
  const [measure, setMeasure] = useState(str(detail.measure));
  const [manufacturer, setManufacturer] = useState(str(detail.manufacturer));
  const [barcode, setBarcode] = useState(str(detail.barcode));
  const [serialnumber, setSerialnumber] = useState(str(detail.serialnumber));
  const [taxable, setTaxable] = useState(Boolean(detail.taxable));
  const [expiryDate, setExpiryDate] = useState(toDateInput(detail.expiryDate));
  const [productCategoryId, setProductCategoryId] = useState(
    genId(detail.productCategoryId) || NO_CATEGORY,
  );

  const { data: categories } = useListProductCategories();

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const buying = buyingPrice === "" ? undefined : Number(buyingPrice);
    const selling = sellingPrice === "" ? undefined : Number(sellingPrice);
    if (buying !== undefined && selling !== undefined && selling < buying) {
      toast({
        title: "Invalid prices",
        description: "Selling price must be greater than the buying price.",
        variant: "destructive",
      });
      return;
    }

    // Numbers are omitted when blank: the upstream coerces numeric fields
    // (e.g. parseInt on quantity), so sending "" would corrupt them.
    const numField = (v: string): number | undefined =>
      v === "" ? undefined : Number(v);
    // Text fields are sent as-is (including "") so blanking a field clears it.
    const strField = (v: string): string => v.trim();

    const payload: ProductUpdate = {
      name: name.trim(),
      description: strField(description),
      buyingPrice: numField(buyingPrice),
      sellingPrice: numField(sellingPrice),
      wholesalePrice: numField(wholesalePrice),
      dealerPrice: numField(dealerPrice),
      minSellingPrice: numField(minSellingPrice),
      maxDiscount: numField(maxDiscount),
      quantity: numField(quantity),
      reorderLevel: numField(reorderLevel),
      measure: strField(measure),
      manufacturer: strField(manufacturer),
      barcode: strField(barcode),
      serialnumber: strField(serialnumber),
      taxable,
      expiryDate: expiryDate === "" ? undefined : expiryDate,
      productCategoryId: productCategoryId === NO_CATEGORY ? null : productCategoryId,
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
          toast({ title: "Product updated" });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetProductQueryKey(detail._id),
          });
          onDone();
        },
        onError: () =>
          toast({ title: "Update failed", variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-description">Description</Label>
          <Textarea
            id="p-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField id="p-buying" label="Buying price" value={buyingPrice} onChange={setBuyingPrice} />
          <NumberField id="p-selling" label="Selling price" value={sellingPrice} onChange={setSellingPrice} />
          <NumberField id="p-wholesale" label="Wholesale price" value={wholesalePrice} onChange={setWholesalePrice} />
          <NumberField id="p-dealer" label="Dealer price" value={dealerPrice} onChange={setDealerPrice} />
          <NumberField id="p-min" label="Min selling price" value={minSellingPrice} onChange={setMinSellingPrice} />
          <NumberField id="p-maxdisc" label="Max discount (%)" value={maxDiscount} onChange={setMaxDiscount} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField id="p-qty" label="Quantity" value={quantity} onChange={setQuantity} />
          <NumberField id="p-reorder" label="Reorder level" value={reorderLevel} onChange={setReorderLevel} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="p-measure">Unit / measure</Label>
            <Input id="p-measure" value={measure} onChange={(e) => setMeasure(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-manufacturer">Manufacturer</Label>
            <Input id="p-manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-barcode">Barcode</Label>
            <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-serial">Serial number</Label>
            <Input id="p-serial" value={serialnumber} onChange={(e) => setSerialnumber(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={productCategoryId} onValueChange={setProductCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              {(categories?.data ?? [])
                .filter((c) => c._id)
                .map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name || c._id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="p-expiry">Expiry date</Label>
            <Input
              id="p-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="p-taxable" className="cursor-pointer">
              Taxable
            </Label>
            <Switch id="p-taxable" checked={taxable} onCheckedChange={setTaxable} />
          </div>
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

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <TableCell className="align-middle">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            aria-label={open ? "Hide inventory" : "Show inventory"}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell>
          <div className="font-medium">{product.name || "—"}</div>
          <div className="text-xs text-muted-foreground">
            {getShopName(product.shopId)}
          </div>
        </TableCell>
        <TableCell>{formatKes(product.sellingPrice)}</TableCell>
        <TableCell>
          <Badge variant={stockBadgeVariant(product.quantity)}>
            {product.quantity ?? 0}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(product.createdAt ?? product.date)}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(product.updatedAt)}
        </TableCell>
        <TableCell className="text-right">
          <ProductActions
            product={product}
            onToggleInventory={() => setOpen(true)}
          />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="p-0">
            <div className="px-6 py-4">
              <ProductInventory product={product} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name || "—"}</p>
          <p className="truncate text-sm text-muted-foreground">
            {getShopName(product.shopId)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={stockBadgeVariant(product.quantity)}>
            {product.quantity ?? 0} in stock
          </Badge>
          <ProductActions
            product={product}
            onToggleInventory={() => setOpen(true)}
          />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Selling Price</dt>
          <dd>{formatKes(product.sellingPrice)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Date added</dt>
          <dd>{formatDate(product.createdAt ?? product.date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Updated</dt>
          <dd>{formatDate(product.updatedAt)}</dd>
        </div>
      </dl>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="mr-1 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-1 h-4 w-4" />
        )}
        {open ? "Hide inventory" : "View inventory"}
      </Button>
      {open && (
        <div className="mt-3 border-t pt-3">
          <ProductInventory product={product} />
        </div>
      )}
    </div>
  );
}

/**
 * Shows the stock breakdown for a product. The list endpoint doesn't include
 * batches, so we lazily fetch the full product (which populates `batches`) when
 * the row is expanded.
 */
function ProductInventory({ product }: { product: Product }) {
  const { data, isLoading, isError } = useGetProduct(product._id);

  const detail = data ?? product;
  const batches: Batch[] = Array.isArray(detail.batches) ? detail.batches : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Boxes className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Inventory
          <span className="text-muted-foreground"> · </span>
          <span className="font-semibold">
            {detail.name || product.name || "—"}
          </span>
        </span>
      </div>

      {/* Stock summary from the product record. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">In stock</p>
          <p className="font-medium">{detail.quantity ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reorder level</p>
          <p className="font-medium">{detail.reorderLevel ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Buying price</p>
          <p className="font-medium">{formatKes(detail.buyingPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expiry date</p>
          <p className="font-medium">{formatDate(detail.expiryDate)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Loading inventory…
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Could not load inventory details.</p>
      ) : batches.length ? (
        <div className="overflow-hidden rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Buying price</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b._id}>
                  <TableCell className="font-mono text-xs">
                    {b.batchCode || b._id.slice(-6)}
                  </TableCell>
                  <TableCell>{b.quantity ?? 0}</TableCell>
                  <TableCell>{formatKes(b.buyingPrice)}</TableCell>
                  <TableCell>{formatDate(b.expirationDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(b.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No batch records for this product.
        </p>
      )}
    </div>
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ProductHistoryDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState("movements");

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const params = { productId: product._id, month, year };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Product history
          </DialogTitle>
          <DialogDescription>
            {product.name || "—"} · {getShopName(product.shopId)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {open && <HistorySummary params={params} />}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
          </TabsList>
          <TabsContent value="movements">
            {open && tab === "movements" && <StockHistoryTab params={params} />}
          </TabsContent>
          <TabsContent value="sales">
            {open && tab === "sales" && <SalesHistoryTab params={params} />}
          </TabsContent>
          <TabsContent value="purchases">
            {open && tab === "purchases" && <PurchasesHistoryTab params={params} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type HistoryParams = { productId: string; month: number; year: number };

function HistorySummary({ params }: { params: HistoryParams }) {
  const { data, isLoading } = useGetProductHistorySummary(params);
  const stats = [
    { label: "Total sales", value: formatKes(data?.totalSales) },
    { label: "Units sold", value: formatNumber(data?.totalUnitsSold) },
    { label: "Stock in", value: formatNumber(data?.totalStockIn) },
    { label: "Stock out", value: formatNumber(data?.totalStockOut) },
    { label: "Net movement", value: formatNumber(data?.netMovement) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-base font-semibold">
            {isLoading ? "…" : s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function HistoryStates({
  isLoading,
  isError,
  isEmpty,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
}) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  if (isError)
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Could not load history.
      </p>
    );
  if (isEmpty)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No records for this period.
      </p>
    );
  return null;
}

function StockHistoryTab({ params }: { params: HistoryParams }) {
  const { data, isLoading, isError } = useListProductStockHistory({
    ...params,
    limit: 100,
  });
  const rows = data?.data ?? [];
  if (isLoading || isError || !rows.length)
    return (
      <HistoryStates isLoading={isLoading} isError={isError} isEmpty={!rows.length} />
    );
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Performed by</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">
                {formatDate(m.date)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={m.type === "Stock In" ? "default" : "destructive"}
                >
                  {m.type || "—"}
                </Badge>
              </TableCell>
              <TableCell>{m.quantity ?? 0}</TableCell>
              <TableCell>{m.performedBy || "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {m.description || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SalesHistoryTab({ params }: { params: HistoryParams }) {
  const { data, isLoading, isError } = useListProductSalesHistory({
    ...params,
    limit: 100,
  });
  const rows = data?.data ?? [];
  if (isLoading || isError || !rows.length)
    return (
      <HistoryStates isLoading={isLoading} isError={isError} isEmpty={!rows.length} />
    );
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Receipt</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Unit price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">
                {formatDate(s.date)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {s.receiptNo || "—"}
              </TableCell>
              <TableCell>{s.customer || "—"}</TableCell>
              <TableCell>{s.units ?? 0}</TableCell>
              <TableCell>{formatKes(s.unitPrice)}</TableCell>
              <TableCell className="font-medium">{formatKes(s.total)}</TableCell>
              <TableCell>{s.paymentType || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PurchasesHistoryTab({ params }: { params: HistoryParams }) {
  const { data, isLoading, isError } = useListProductPurchasesHistory({
    ...params,
    limit: 100,
  });
  const rows = data?.data ?? [];
  if (isLoading || isError || !rows.length)
    return (
      <HistoryStates isLoading={isLoading} isError={isError} isEmpty={!rows.length} />
    );
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Receipt</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Unit price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">
                {formatDate(p.date)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {p.receiptNo || "—"}
              </TableCell>
              <TableCell>{p.supplier || "—"}</TableCell>
              <TableCell>{p.units ?? 0}</TableCell>
              <TableCell>{formatKes(p.unitPrice)}</TableCell>
              <TableCell className="font-medium">{formatKes(p.total)}</TableCell>
              <TableCell>{p.paymentType || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
