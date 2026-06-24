import { useEffect, useState } from "react";
import {
  useListProducts,
  useGetProduct,
  type Product,
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
  ChevronDown,
  ChevronRight,
  Search,
  Boxes,
  Loader2,
} from "lucide-react";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { formatKes, formatDate } from "@/lib/utils";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Manage all products across shops.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}

          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-end">
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
          </div>

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
                          colSpan={6}
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

function ProductRow({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
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
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-0">
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
        <Badge variant={stockBadgeVariant(product.quantity)} className="shrink-0">
          {product.quantity ?? 0} in stock
        </Badge>
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
        <Boxes className="h-4 w-4 text-primary" />
        Inventory
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
