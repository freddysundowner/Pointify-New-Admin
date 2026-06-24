import { useListSubscriptions } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKes } from "@/lib/utils";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";

export default function Subscriptions() {
  const { shopId, shopName, from } = useShopFilter();
  const { data, isLoading } = useListSubscriptions({ page: 1, limit: 20, shop: shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
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
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((sub) => (
                      <TableRow key={sub._id}>
                        <TableCell className="font-medium">{getShopName(sub.shop)}</TableCell>
                        <TableCell>{sub.type}</TableCell>
                        <TableCell>{formatKes(sub.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status ? "default" : "destructive"}>
                            {sub.status ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((sub) => (
                    <div
                      key={sub._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {getShopName(sub.shop)}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {sub.type || "—"}
                          </p>
                        </div>
                        <Badge
                          variant={sub.status ? "default" : "destructive"}
                          className="shrink-0"
                        >
                          {sub.status ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Amount</dt>
                          <dd>{formatKes(sub.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">End Date</dt>
                          <dd>{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'N/A'}</dd>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
