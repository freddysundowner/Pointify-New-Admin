import { useState } from "react";
import { useListSales } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 20;

function getShopName(shop: unknown): string {
  if (!shop) return "N/A";
  if (typeof shop === "string") return shop;
  const s = shop as { name?: string; _id?: string };
  return s.name || s._id || "N/A";
}

function getAttendantName(attendant: unknown): string {
  if (!attendant || typeof attendant === "string") return "—";
  const a = attendant as { username?: string };
  return a.username || "—";
}

export default function Sales() {
  const { shopId, shopName, from } = useShopFilter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListSales({ page, limit: PAGE_SIZE, shopId });

  const sales = data?.data ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const currentPage = data?.currentPage ?? page;

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
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}
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
                      <TableHead>Attendant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length ? (
                      sales.map((sale) => (
                        <TableRow key={sale._id}>
                          <TableCell className="font-medium">{sale.receiptNo || "—"}</TableCell>
                          <TableCell>{getShopName(sale.shopId)}</TableCell>
                          <TableCell>{getAttendantName(sale.attendantId)}</TableCell>
                          <TableCell>{sale.totalAmount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sale.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(sale.createdAt ?? sale.createAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No sales found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {sales.length ? (
                  sales.map((sale) => (
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
                          <dt className="text-xs text-muted-foreground">Attendant</dt>
                          <dd>{getAttendantName(sale.attendantId)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Date &amp; Time</dt>
                          <dd>{formatDateTime(sale.createdAt ?? sale.createAt)}</dd>
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

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isFetching}
                >
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
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
