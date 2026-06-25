import { useState, useEffect } from "react";
import { useListPortalShops, getListPortalShopsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, Loader2, MapPin, Phone, CheckCircle2, AlertTriangle, XCircle, CircleSlash, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { getShopSubscription, type ShopSubStatus } from "@/lib/format";

const STATUS_STYLES: Record<ShopSubStatus, { className: string; Icon: typeof CheckCircle2 }> = {
  active: {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    Icon: CheckCircle2,
  },
  expiring: {
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    Icon: AlertTriangle,
  },
  expired: {
    className: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: XCircle,
  },
  unpaid: {
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    Icon: AlertTriangle,
  },
  none: {
    className: "bg-muted text-muted-foreground border-border",
    Icon: CircleSlash,
  },
};

function SubscriptionBadge({ status, label }: { status: ShopSubStatus; label: string }) {
  const { className, Icon } = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

const PAGE_SIZE = 10;

export default function Shops() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, isError } = useListPortalShops(
    { page, limit: PAGE_SIZE },
    { query: { queryKey: getListPortalShopsQueryKey({ page, limit: PAGE_SIZE }) } }
  );

  const shops = result?.data || [];
  const totalPages = result?.totalPages || 1;
  const totalCount = result?.count || 0;
  const currentPage = result?.currentPage || page;

  // The server clamps out-of-range pages; mirror that back into local state so
  // Previous/Next keep working from the corrected page.
  useEffect(() => {
    if (result?.currentPage && result.currentPage !== page) {
      setPage(result.currentPage);
    }
  }, [result?.currentPage, page]);

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
                {shops.map((shop: any) => {
                  const sub = getShopSubscription(shop);
                  return (
                  <div key={shop._id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium min-w-0">
                        <Store className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{shop.name || 'Unnamed Shop'}</span>
                      </div>
                      <SubscriptionBadge status={sub.status} label={sub.label} />
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      <div className="text-xs font-medium text-foreground">{sub.detail}</div>
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
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Shop Name</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.map((shop: any) => {
                      const sub = getShopSubscription(shop);
                      return (
                      <TableRow key={shop._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            {shop.name || 'Unnamed Shop'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <SubscriptionBadge status={sub.status} label={sub.label} />
                            <div className="text-xs text-muted-foreground">{sub.detail}</div>
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                    <span className="hidden sm:inline"> · {totalCount} shops</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
