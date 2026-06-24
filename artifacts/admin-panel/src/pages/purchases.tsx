import { useListPurchases } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { formatDate } from "@/lib/utils";

export default function Purchases() {
  const { shopId, shopName, from } = useShopFilter();
  const { data, isLoading } = useListPurchases({ page: 1, limit: 20, shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
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
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((purchase) => (
                      <TableRow key={purchase._id}>
                        <TableCell className="font-medium">{purchase.invoiceNo}</TableCell>
                        <TableCell>{getShopName(purchase.shopId)}</TableCell>
                        <TableCell>{purchase.totalAmount}</TableCell>
                        <TableCell>{formatDate(purchase.createAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((purchase) => (
                    <div
                      key={purchase._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {purchase.invoiceNo || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {getShopName(purchase.shopId)}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Total Amount</dt>
                          <dd>{purchase.totalAmount}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Date</dt>
                          <dd>{formatDate(purchase.createAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No purchases found.
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
