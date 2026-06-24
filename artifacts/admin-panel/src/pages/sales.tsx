import { useState } from "react";
import { useListSales } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSales({ page, limit: 20 });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
        <p className="text-muted-foreground">View all platform sales.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading sales...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((sale) => (
                      <TableRow key={sale._id}>
                        <TableCell className="font-medium">{sale.receiptNo}</TableCell>
                        <TableCell>{getShopName(sale.shopId)}</TableCell>
                        <TableCell>{sale.totalAmount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.status}</Badge>
                        </TableCell>
                        <TableCell>{sale.createAt ? new Date(sale.createAt).toLocaleDateString() : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((sale) => (
                    <div
                      key={sale._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {sale.receiptNo || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {getShopName(sale.shopId)}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{sale.status}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Amount</dt>
                          <dd>{sale.totalAmount}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Date</dt>
                          <dd>{sale.createAt ? new Date(sale.createAt).toLocaleDateString() : 'N/A'}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No sales found.
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
