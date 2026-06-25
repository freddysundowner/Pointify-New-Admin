import { useState } from "react";
import { useListPortalShops, getListPortalShopsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, Loader2, MapPin, Phone } from "lucide-react";
import { format } from "date-fns";

export default function Shops() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, isError } = useListPortalShops(
    { page, limit: 50 },
    { query: { queryKey: getListPortalShopsQueryKey({ page, limit: 50 }) } }
  );

  const shops = result?.data || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referred Shops</h1>
        <p className="text-muted-foreground mt-1">Shops created by the users you referred to Pointify.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shop Directory</CardTitle>
          <CardDescription>A list of all active shops under your referral network.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive">
              Failed to load shops. Please try again later.
            </div>
          ) : shops.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Store className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No shops yet</h3>
              <p className="text-muted-foreground">When your referred users create shops, they will appear here.</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {shops.map((shop: any) => (
                  <div key={shop._id} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Store className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{shop.name || 'Unnamed Shop'}</span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      {shop.contact && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{shop.contact}</span>
                        </div>
                      )}
                      {shop.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{shop.address}</span>
                        </div>
                      )}
                      <div className="text-xs pt-1">
                        Created {shop.createAt ? format(new Date(shop.createAt), "MMM d, yyyy") : "Unknown"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Shop Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.map((shop: any) => (
                      <TableRow key={shop._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            {shop.name || 'Unnamed Shop'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {shop.contact ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" />
                              {shop.contact}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {shop.address ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              {shop.address}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {shop.createAt ? format(new Date(shop.createAt), "MMM d, yyyy") : "Unknown"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
