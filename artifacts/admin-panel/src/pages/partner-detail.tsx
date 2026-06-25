import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useRoute, Link } from "wouter";
import {
  useGetPartner,
  useListShops,
  useListAdmins,
  useListPartnerTransactions,
  getGetPartnerQueryKey,
  getListShopsQueryKey,
  getListAdminsQueryKey,
  getListPartnerTransactionsQueryKey,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Store,
  Users as UsersIcon,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const LIMIT = 20;

function asText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return (o.name ?? o.title ?? o.username ?? o.email ?? o._id) as
      | string
      | undefined;
  }
  return String(value);
}

function fmtKes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `KES ${Number(n).toLocaleString()}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Pager({
  page,
  totalPages,
  count,
  label,
  isFetching,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  count: number;
  label: string;
  isFetching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {count.toLocaleString()} {label}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1 || isFetching}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages || isFetching}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function PartnerDetail() {
  const [, params] = useRoute("/partners/:id");
  const partnerId = params?.id ?? "";

  const [shopsPage, setShopsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [txPage, setTxPage] = useState(1);

  const { data: partner, isLoading: partnerLoading } = useGetPartner(partnerId, {
    query: { enabled: !!partnerId, queryKey: getGetPartnerQueryKey(partnerId) },
  });

  const shopsQuery = useListShops(
    { affliate: partnerId, page: shopsPage, limit: LIMIT },
    {
      query: {
        enabled: !!partnerId,
        queryKey: getListShopsQueryKey({
          affliate: partnerId,
          page: shopsPage,
          limit: LIMIT,
        }),
      },
    },
  );

  const usersQuery = useListAdmins(
    { affliate: partnerId, page: usersPage, limit: LIMIT },
    {
      query: {
        enabled: !!partnerId,
        queryKey: getListAdminsQueryKey({
          affliate: partnerId,
          page: usersPage,
          limit: LIMIT,
        }),
      },
    },
  );

  const txQuery = useListPartnerTransactions(
    { id: partnerId, page: txPage, limit: LIMIT },
    {
      query: {
        enabled: !!partnerId,
        queryKey: getListPartnerTransactionsQueryKey({
          id: partnerId,
          page: txPage,
          limit: LIMIT,
        }),
      },
    },
  );

  const shops = shopsQuery.data?.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const transactions = txQuery.data?.data ?? [];

  const name = partner?.name || "Partner";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={name}
        description="Everything referred by this partner — shops, users and transactions."
        backHref="/partners"
      />

      {/* Partner summary */}
      <Card>
        <CardHeader>
          <CardTitle>Partner details</CardTitle>
          <CardDescription>
            {partnerLoading ? "Loading…" : partner?.code ? `Referral code: ${partner.code}` : "Account overview"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="truncate text-sm font-medium">
                {partner?.email || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="text-sm font-medium">{partner?.phonenumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Country</dt>
              <dd className="text-sm font-medium">{partner?.country || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Commission</dt>
              <dd className="text-sm font-medium">
                {partner?.commission === null || partner?.commission === undefined
                  ? "—"
                  : `${partner.commission}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Wallet</dt>
              <dd className="text-sm font-medium">{fmtKes(partner?.wallet)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd>
                {partner?.blocked ? (
                  <Badge variant="destructive">Blocked</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="shops">
        <TabsList>
          <TabsTrigger value="shops">
            <Store className="mr-2 h-4 w-4" />
            Shops
          </TabsTrigger>
          <TabsTrigger value="users">
            <UsersIcon className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Receipt className="mr-2 h-4 w-4" />
            Transactions
          </TabsTrigger>
        </TabsList>

        {/* Shops */}
        <TabsContent value="shops">
          <Card>
            <CardHeader>
              <CardTitle>Shops</CardTitle>
              <CardDescription>
                Shops owned by users this partner referred.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shopsQuery.isLoading ? (
                <div className="p-4">Loading shops…</div>
              ) : shopsQuery.isError ? (
                <div className="rounded-lg border border-destructive/40 p-8 text-center text-muted-foreground">
                  Couldn't load shops.
                </div>
              ) : shops.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  No shops attributed to this partner.
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shops.map((shop) => (
                          <TableRow key={shop._id}>
                            <TableCell className="font-medium">
                              {shop.name || "—"}
                            </TableCell>
                            <TableCell>
                              {asText(shop.adminId) || "—"}
                            </TableCell>
                            <TableCell>
                              {asText(shop.shopCategoryId) || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={shop.warehouse ? "secondary" : "default"}
                              >
                                {shop.warehouse ? "Warehouse" : "Shop"}
                              </Badge>
                            </TableCell>
                            <TableCell>{shop.contact || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {shops.map((shop) => (
                      <div
                        key={shop._id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {shop.name || "—"}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {asText(shop.adminId) || "—"}
                            </p>
                          </div>
                          <Badge
                            variant={shop.warehouse ? "secondary" : "default"}
                            className="shrink-0"
                          >
                            {shop.warehouse ? "Warehouse" : "Shop"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pager
                    page={shopsQuery.data?.currentPage ?? shopsPage}
                    totalPages={shopsQuery.data?.totalPages ?? 1}
                    count={shopsQuery.data?.count ?? 0}
                    label="shops"
                    isFetching={shopsQuery.isFetching}
                    onPrev={() => setShopsPage((p) => Math.max(1, p - 1))}
                    onNext={() => setShopsPage((p) => p + 1)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Shop owners who signed up through this partner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading ? (
                <div className="p-4">Loading users…</div>
              ) : usersQuery.isError ? (
                <div className="rounded-lg border border-destructive/40 p-8 text-center text-muted-foreground">
                  Couldn't load users.
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  No users referred by this partner.
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead className="text-center">Shops</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u._id}>
                            <TableCell className="font-medium">
                              {u.username || "—"}
                            </TableCell>
                            <TableCell>{u.email || "—"}</TableCell>
                            <TableCell>{u.phone || "—"}</TableCell>
                            <TableCell className="text-center">
                              {u.shopCount ?? 0}
                            </TableCell>
                            <TableCell>{fmtDate(u.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {users.map((u) => (
                      <div
                        key={u._id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <p className="truncate font-semibold">
                          {u.username || "—"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {u.email || "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                          <span>{u.phone || "—"}</span>
                          <span>{u.shopCount ?? 0} shops</span>
                          <span>{fmtDate(u.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pager
                    page={usersQuery.data?.currentPage ?? usersPage}
                    totalPages={usersQuery.data?.totalPages ?? 1}
                    count={usersQuery.data?.count ?? 0}
                    label="users"
                    isFetching={usersQuery.isFetching}
                    onPrev={() => setUsersPage((p) => Math.max(1, p - 1))}
                    onNext={() => setUsersPage((p) => p + 1)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Subscription commission earnings and wallet withdrawals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {txQuery.isLoading ? (
                <div className="p-4">Loading transactions…</div>
              ) : txQuery.isError ? (
                <div className="rounded-lg border border-destructive/40 p-8 text-center text-muted-foreground">
                  Couldn't load transactions.
                </div>
              ) : transactions.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  No transactions for this partner.
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t) => (
                          <TableRow key={t._id}>
                            <TableCell>{fmtDate(t.createdAt)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  t.type === "withdraw" ? "outline" : "default"
                                }
                                className="capitalize"
                              >
                                {t.type || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>{asText(t.user) || "—"}</TableCell>
                            <TableCell className="text-right">
                              {fmtKes(t.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.type === "withdraw"
                                ? "—"
                                : fmtKes(t.affliateAmount)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.mpesaCode || t.transId || "—"}
                            </TableCell>
                            <TableCell>
                              {t.status ? (
                                <Badge variant="secondary">Completed</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {transactions.map((t) => (
                      <div
                        key={t._id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant={t.type === "withdraw" ? "outline" : "default"}
                            className="capitalize"
                          >
                            {t.type || "—"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {fmtDate(t.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span>Amount: {fmtKes(t.amount)}</span>
                          {t.type !== "withdraw" ? (
                            <span>Commission: {fmtKes(t.affliateAmount)}</span>
                          ) : null}
                          <span className="text-muted-foreground">
                            {t.mpesaCode || t.transId || ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pager
                    page={txQuery.data?.currentPage ?? txPage}
                    totalPages={txQuery.data?.totalPages ?? 1}
                    count={txQuery.data?.count ?? 0}
                    label="transactions"
                    isFetching={txQuery.isFetching}
                    onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
                    onNext={() => setTxPage((p) => p + 1)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
