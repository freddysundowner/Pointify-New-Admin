import { useListAttendants } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";

export default function Attendants() {
  const { shopId, shopName, from } = useShopFilter();
  const { data, isLoading } = useListAttendants({ shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendants</h1>
        <p className="text-muted-foreground">Manage shop attendants.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendants List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}
          {isLoading ? (
            <div className="p-4">Loading attendants...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Shop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.length ? (
                      data.data.map((attendant) => (
                        <TableRow key={attendant._id}>
                          <TableCell className="font-medium">{attendant.username}</TableCell>
                          <TableCell>{attendant.email || "N/A"}</TableCell>
                          <TableCell>{attendant.phone || "N/A"}</TableCell>
                          <TableCell>{getShopName(attendant.shopId)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No attendants found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((attendant) => (
                    <div
                      key={attendant._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {attendant.username || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {attendant.email || "N/A"}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Phone</dt>
                          <dd>{attendant.phone || "N/A"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Shop</dt>
                          <dd>{getShopName(attendant.shopId)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No attendants found.
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
