import { useState } from "react";
import { useListShops } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Shops() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListShops({ page, limit: 20 });

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
                      <TableHead>Contact</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.length ? (
                      data.data.map((shop) => (
                        <TableRow key={shop._id}>
                          <TableCell className="font-medium">{shop.name}</TableCell>
                          <TableCell>{shop.contact}</TableCell>
                          <TableCell>{shop.currency}</TableCell>
                          <TableCell>
                            <Badge variant={shop.production ? "default" : "secondary"}>
                              {shop.production ? "Production" : "Trial"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No shops found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((shop) => (
                    <div
                      key={shop._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{shop.name || "—"}</p>
                        </div>
                        <Badge
                          variant={shop.production ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {shop.production ? "Production" : "Trial"}
                        </Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Contact</dt>
                          <dd>{shop.contact || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Currency</dt>
                          <dd>{shop.currency || "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No shops found.
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
