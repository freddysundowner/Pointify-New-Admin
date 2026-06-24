import { useState } from "react";
import { useListProducts, useListShops } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Products() {
  const [page, setPage] = useState(1);
  const [shopId, setShopId] = useState<string | undefined>(undefined);
  
  const { data, isLoading } = useListProducts({ page, limit: 20, shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

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
          {isLoading ? (
            <div className="p-4">Loading products...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{getShopName(product.shopId)}</TableCell>
                        <TableCell>{product.sellingPrice}</TableCell>
                        <TableCell>
                          <Badge variant={product.quantity && product.quantity > 0 ? "default" : "destructive"}>
                            {product.quantity || 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((product) => (
                    <div
                      key={product._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {product.name || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {getShopName(product.shopId)}
                          </p>
                        </div>
                        <Badge
                          variant={product.quantity && product.quantity > 0 ? "default" : "destructive"}
                          className="shrink-0"
                        >
                          {product.quantity || 0} in stock
                        </Badge>
                      </div>
                      <dl className="mt-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Selling Price</dt>
                          <dd>{product.sellingPrice}</dd>
                        </div>
                      </dl>
                    </div>
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
