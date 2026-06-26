import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useGetAdmin,
  useListAdminShops,
  getListAdminShopsQueryKey,
  getGetAdminQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShopActionsMenu } from "@/components/ShopActionsMenu";

function asText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return (o.name ?? o.title ?? o._id) as string | undefined;
  }
  return String(value);
}

export default function UserShops() {
  const [, params] = useRoute("/users/:id/shops");
  const userId = params?.id ?? "";
  const queryClient = useQueryClient();

  const { data: user } = useGetAdmin(userId, {
    query: { enabled: !!userId, queryKey: getGetAdminQueryKey(userId) },
  });
  const { data, isLoading } = useListAdminShops(userId, {
    query: { enabled: !!userId, queryKey: getListAdminShopsQueryKey(userId) },
  });
  // After an edit/delete from the shop actions menu, refresh this user's shop
  // list (the menu already invalidates the global shops list).
  const refreshUserShops = () =>
    queryClient.invalidateQueries({ queryKey: getListAdminShopsQueryKey(userId) });
  const shops = data?.data ?? [];
  const ownerLabel = user?.username || user?.email || "User";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Shops"
        description={
          <>
            Shops owned by <span className="font-medium">{ownerLabel}</span>
          </>
        }
        backHref="/users"
      />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>
            All Shops{shops.length ? ` (${shops.length})` : ""}
          </CardTitle>
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
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-[56px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.length ? (
                      shops.map((shop) => (
                        <TableRow key={shop._id}>
                          <TableCell className="font-medium">{shop.name || "—"}</TableCell>
                          <TableCell>{asText(shop.shopCategoryId) || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={shop.warehouse ? "secondary" : "default"}>
                              {shop.warehouse ? "Warehouse" : "Shop"}
                            </Badge>
                          </TableCell>
                          <TableCell>{shop.contact || "—"}</TableCell>
                          <TableCell>{shop.address || "—"}</TableCell>
                          <TableCell className="text-right">
                            <ShopActionsMenu shop={shop} onChanged={refreshUserShops} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          This user has no shops.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {shops.length ? (
                  shops.map((shop) => (
                    <div
                      key={shop._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{shop.name || "—"}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {asText(shop.shopCategoryId) || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant={shop.warehouse ? "secondary" : "default"}>
                            {shop.warehouse ? "Warehouse" : "Shop"}
                          </Badge>
                          <ShopActionsMenu shop={shop} onChanged={refreshUserShops} />
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Contact</dt>
                          <dd>{shop.contact || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Address</dt>
                          <dd>{shop.address || "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    This user has no shops.
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
