import { useRoute, Link } from "wouter";
import {
  useGetAdmin,
  useListAdminShops,
  getListAdminShopsQueryKey,
  getGetAdminQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

  const { data: user } = useGetAdmin(userId, {
    query: { enabled: !!userId, queryKey: getGetAdminQueryKey(userId) },
  });
  const { data, isLoading } = useListAdminShops(userId, {
    query: { enabled: !!userId, queryKey: getListAdminShopsQueryKey(userId) },
  });
  const shops = data?.data ?? [];
  const ownerLabel = user?.username || user?.email || "User";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to users</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shops</h1>
          <p className="text-muted-foreground">
            Shops owned by <span className="font-medium">{ownerLabel}</span>
          </p>
        </div>
      </div>

      <Card>
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
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
                        <Badge
                          variant={shop.warehouse ? "secondary" : "default"}
                          className="shrink-0"
                        >
                          {shop.warehouse ? "Warehouse" : "Shop"}
                        </Badge>
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
