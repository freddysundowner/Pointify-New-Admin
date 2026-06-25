import { useMemo, useState, type ReactNode } from "react";
import {
  useGetStatistics,
  useGetRevenueRange,
  getGetRevenueRangeQueryKey,
  useListAdmins,
  useListAdminShops,
  useListUserPackages,
  useWithdrawMpesa,
  useCreateSubscription,
  getListAdminShopsQueryKey,
  getListUserPackagesQueryKey,
  getListAdminsQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Send,
  CreditCard,
  Receipt,
  Store,
  Users,
  TrendingUp,
  TrendingDown,
  Check,
  ChevronsUpDown,
  Loader2,
  Repeat,
  ShoppingCart,
  MessageSquare,
  AlertTriangle,
  Package as PackageIcon,
  Boxes,
  UserPlus,
  CalendarRange,
} from "lucide-react";
import { formatKes, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const compactKes = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `KES ${(v / 1_000).toFixed(1)}K`;
  return formatKes(v);
};

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export default function Statistics() {
  const { data: stats, isLoading, isError, refetch } = useGetStatistics();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  // Custom revenue date-range filter. We only query once both ends are set and
  // the operator applies the range (the upstream call scans every subscription).
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
  const rangeParams = { from: appliedRange?.from ?? "", to: appliedRange?.to ?? "" };
  const rangeQuery = useGetRevenueRange(rangeParams, {
    query: {
      enabled: appliedRange != null,
      queryKey: getGetRevenueRangeQueryKey(rangeParams),
    },
  });

  const revenue = stats?.revenue ?? {};
  const gmv = stats?.gmv ?? {};
  const users = stats?.users ?? {};
  const shops = stats?.shops ?? {};
  const subscriptions = stats?.subscriptions ?? {};
  const sms = stats?.sms ?? {};
  const catalog = stats?.catalog ?? {};

  const monthRevenue = num(revenue.thisMonth?.amount);
  const lastMonthRevenue = num(revenue.lastMonth?.amount);
  const revenueDelta = deltaPct(monthRevenue, lastMonthRevenue);

  const revenueTrend = (stats?.revenueTrend ?? []).map((p) => ({
    label: p.label ?? p.month ?? "",
    value: num(p.amount),
  }));
  const salesTrend = (stats?.salesTrend ?? []).map((p) => ({
    label: p.label ?? p.month ?? "",
    value: num(p.amount),
  }));
  const userTrend = (stats?.userTrend ?? []).map((p) => ({
    label: p.label ?? p.month ?? "",
    value: num(p.count),
  }));

  const productionActive = num(shops.productionActive);
  const productionExpired = num(shops.productionExpired);
  const trialActive = num(shops.trialActive);
  const trialExpired = num(shops.trialExpired);

  const subRows = [
    { label: "Production · Active", value: productionActive, tone: "text-emerald-600" },
    { label: "Production · Expired", value: productionExpired, tone: "text-amber-600" },
    { label: "Trial · Active", value: trialActive, tone: "text-blue-600" },
    { label: "Trial · Expired", value: trialExpired, tone: "text-rose-600" },
  ];

  const packages = stats?.packages ?? [];
  const topShops = stats?.topShops ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground">
            Platform-wide performance, growth, payouts and payment prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
            <Banknote className="mr-2 h-4 w-4" />
            Withdraw
          </Button>
          <Button onClick={() => setPromptOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send payment prompt
          </Button>
        </div>
      </div>

      {isLoading ? (
        <StatisticsSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Couldn't load statistics</p>
              <p className="text-sm text-muted-foreground">
                The statistics service may not be available yet.
              </p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Revenue overview + custom date range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Revenue
              </CardTitle>
              <CardDescription>
                Subscription revenue collected over time. Pick a date range to total any period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <RevenueStat
                  label="Today"
                  amount={num(revenue.today?.amount)}
                  count={num(revenue.today?.count)}
                />
                <RevenueStat
                  label="This Week"
                  amount={num(revenue.thisWeek?.amount)}
                  count={num(revenue.thisWeek?.count)}
                />
                <RevenueStat
                  label="This Month"
                  amount={monthRevenue}
                  count={num(revenue.thisMonth?.count)}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="lg:w-44">
                    <Label className="mb-1 block text-xs text-muted-foreground">From</Label>
                    <Input
                      type="date"
                      value={rangeFrom}
                      max={rangeTo || undefined}
                      onChange={(e) => setRangeFrom(e.target.value)}
                    />
                  </div>
                  <div className="lg:w-44">
                    <Label className="mb-1 block text-xs text-muted-foreground">To</Label>
                    <Input
                      type="date"
                      value={rangeTo}
                      min={rangeFrom || undefined}
                      onChange={(e) => setRangeTo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={!rangeFrom || !rangeTo}
                      onClick={() => setAppliedRange({ from: rangeFrom, to: rangeTo })}
                    >
                      Show revenue
                    </Button>
                    {appliedRange && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setAppliedRange(null);
                          setRangeFrom("");
                          setRangeTo("");
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {appliedRange && (
                  <div className="mt-4">
                    {rangeQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculating revenue…
                      </div>
                    ) : rangeQuery.isError ? (
                      <div className="flex items-center gap-2 text-sm text-rose-600">
                        <AlertTriangle className="h-4 w-4" />
                        Couldn't calculate revenue for this range.
                        <Button
                          variant="link"
                          className="h-auto p-0 text-rose-600"
                          onClick={() => rangeQuery.refetch()}
                        >
                          Try again
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-2xl font-bold">
                          {formatKes(rangeQuery.data?.amount)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          from {formatNumber(rangeQuery.data?.count)} subscription
                          {num(rangeQuery.data?.count) === 1 ? "" : "s"} ·{" "}
                          {appliedRange.from} → {appliedRange.to}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Primary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Revenue This Month"
              icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
              value={formatKes(monthRevenue)}
              footer={
                revenueDelta === null ? (
                  <span className="text-muted-foreground">vs last month</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span
                      className={`flex items-center gap-1 ${
                        revenueDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {revenueDelta >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(revenueDelta).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs last month</span>
                  </span>
                )
              }
            />
            <KpiCard
              title="All-time Revenue"
              icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
              value={formatKes(revenue.allTime?.amount)}
              footer={`${formatNumber(revenue.allTime?.count)} subscription payments`}
            />
            <KpiCard
              title="Active Subscription Value"
              icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
              value={formatKes(revenue.mrr)}
              footer="Run-rate from active paid plans"
            />
            <KpiCard
              title="Merchant Sales (This Month)"
              icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
              value={formatKes(gmv.thisMonth?.amount)}
              footer={`${formatNumber(gmv.thisMonth?.count)} sales across all shops`}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Paying Customers"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(users.paying)}
              footer={`of ${formatNumber(users.total)} users · ${formatNumber(
                users.trial,
              )} on trial`}
            />
            <KpiCard
              title="Active Shops"
              icon={<Store className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(productionActive + trialActive)}
              footer={`${formatNumber(productionActive)} paid · ${formatNumber(
                trialActive,
              )} trial`}
            />
            <KpiCard
              title="New Sign-ups (This Month)"
              icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(users.newThisMonth)}
              footer={`${formatNumber(users.newToday)} today`}
            />
            <KpiCard
              title="SMS Sent (This Month)"
              icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(sms.sentThisMonth)}
              footer={`${formatNumber(sms.creditsUsedThisMonth)} credits · ${formatNumber(
                sms.failedThisMonth,
              )} failed`}
            />
          </div>

          {/* Trends */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Revenue</CardTitle>
                <CardDescription>Last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendArea data={revenueTrend} money />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Merchant Sales Volume</CardTitle>
                <CardDescription>Gross sales across all shops · last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBar data={salesTrend} money />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Customer Growth</CardTitle>
                <CardDescription>New sign-ups per month · last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendLine data={userTrend} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Shops by Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className={row.tone}>{row.label}</span>
                    <span className="font-semibold">{formatNumber(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Total shops</span>
                  <span className="font-semibold">{formatNumber(shops.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New this month</span>
                  <span className="font-semibold">{formatNumber(shops.newThisMonth)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription health + catalog */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Active Subscriptions"
              icon={<Check className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(subscriptions.active)}
              footer={`${formatNumber(subscriptions.newThisMonth)} new this month`}
            />
            <KpiCard
              title="Expiring Soon"
              icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(subscriptions.expiringSoon)}
              footer="Within the next 7 days"
              accent={num(subscriptions.expiringSoon) > 0 ? "warn" : undefined}
            />
            <KpiCard
              title="Expired Subscriptions"
              icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(subscriptions.expired)}
              footer="Past their end date"
            />
            <KpiCard
              title="Products Catalogued"
              icon={<Boxes className="h-4 w-4 text-muted-foreground" />}
              value={formatNumber(catalog.products)}
              footer="Across all shops"
            />
          </div>

          {/* Breakdown tables */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="h-4 w-4" />
                  Plans in Use
                </CardTitle>
                <CardDescription>Active subscriptions by plan</CardDescription>
              </CardHeader>
              <CardContent>
                {packages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No active plans.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b pb-2 text-xs font-medium text-muted-foreground">
                      <span>Plan</span>
                      <span className="text-right">Active</span>
                      <span className="text-right">Revenue</span>
                    </div>
                    {packages.map((pkg, i) => (
                      <div
                        key={`${pkg.name}-${i}`}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="truncate font-medium">{pkg.name || "Unknown"}</span>
                          {pkg.type ? (
                            <Badge variant="outline" className="capitalize">
                              {pkg.type}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-right font-semibold">
                          {formatNumber(pkg.activeSubscriptions)}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {compactKes(num(pkg.revenue))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Top Shops by Sales
                </CardTitle>
                <CardDescription>Highest gross sales all-time</CardDescription>
              </CardHeader>
              <CardContent>
                {topShops.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sales recorded yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-4 border-b pb-2 text-xs font-medium text-muted-foreground">
                      <span>#</span>
                      <span>Shop</span>
                      <span className="text-right">Sales</span>
                      <span className="text-right">Revenue</span>
                    </div>
                    {topShops.map((shop, i) => (
                      <div
                        key={shop.shopId ?? i}
                        className="grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-4 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{i + 1}</span>
                        <span className="truncate font-medium">{shop.name || "Unknown shop"}</span>
                        <span className="text-right text-muted-foreground">
                          {formatNumber(shop.sales)}
                        </span>
                        <span className="text-right font-semibold">
                          {compactKes(num(shop.revenue))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <PaymentPromptDialog open={promptOpen} onClose={() => setPromptOpen(false)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                        */
/* -------------------------------------------------------------------------- */

function KpiCard({
  title,
  icon,
  value,
  footer,
  accent,
}: {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  footer: ReactNode;
  accent?: "warn";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${accent === "warn" ? "text-amber-600" : ""}`}
        >
          {value}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {footer}
        </p>
      </CardContent>
    </Card>
  );
}

function RevenueStat({
  label,
  amount,
  count,
}: {
  label: string;
  amount: number;
  count: number;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{formatKes(amount)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNumber(count)} subscription{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

const chartTip = {
  cursor: { fill: "hsl(var(--muted))", opacity: 0.4 },
  contentStyle: {
    borderRadius: "0.5rem",
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--background))",
    fontSize: "12px",
  },
};

function TrendArea({ data, money }: { data: Array<{ label: string; value: number }>; money?: boolean }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={56}
            tickFormatter={(v) => (money ? compactKes(v) : formatNumber(v))}
          />
          <Tooltip
            {...chartTip}
            formatter={(v) => [money ? formatKes(v as number) : formatNumber(v as number), "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#revFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendBar({ data, money }: { data: Array<{ label: string; value: number }>; money?: boolean }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={56}
            tickFormatter={(v) => (money ? compactKes(v) : formatNumber(v))}
          />
          <Tooltip
            {...chartTip}
            formatter={(v) => [money ? formatKes(v as number) : formatNumber(v as number), "Sales"]}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendLine({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={40}
            allowDecimals={false}
            tickFormatter={(v) => formatNumber(v)}
          />
          <Tooltip
            {...chartTip}
            formatter={(v) => [formatNumber(v as number), "New users"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[260px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Withdraw (M-Pesa B2C)                                                        */
/* -------------------------------------------------------------------------- */

function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [phonenumber, setPhonenumber] = useState("");
  const [pin, setPin] = useState("");

  const reset = () => {
    setAmount("");
    setPhonenumber("");
    setPin("");
  };

  const withdraw = useWithdrawMpesa({
    mutation: {
      onSuccess: (res) => {
        const ok = (res as Record<string, unknown>)?.status !== false;
        const message =
          (res as Record<string, unknown>)?.message?.toString() ||
          (ok ? "Withdrawal request sent" : "Withdrawal failed");
        toast({
          title: ok ? "Withdrawal sent" : "Withdrawal failed",
          description: message,
          variant: ok ? undefined : "destructive",
        });
        if (ok) {
          reset();
          onClose();
        }
      },
      onError: (err) => {
        const data = (err as { data?: Record<string, unknown> })?.data;
        const description =
          (data?.["message"] as string | undefined) ||
          (data?.["errorMessage"] as string | undefined) ||
          (data?.["error"] as string | undefined) ||
          "The POS server did not respond. M-Pesa payouts can stall if the upstream B2C service is unavailable — please try again shortly.";
        toast({ title: "Withdrawal failed", description, variant: "destructive" });
      },
    },
  });

  const amountNum = Number(amount);
  const canSubmit =
    Number.isFinite(amountNum) && amountNum > 0 && phonenumber.trim() !== "" && pin.trim() !== "";

  const submit = () => {
    if (!canSubmit) return;
    withdraw.mutate({
      data: { amount: amountNum, phonenumber: phonenumber.trim(), pin: pin.trim() },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw via M-Pesa</DialogTitle>
          <DialogDescription>
            Send a B2C payout to an M-Pesa number. This moves real money.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-amount">Amount (KES)</Label>
            <Input
              id="w-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-phone">Phone number</Label>
            <Input
              id="w-phone"
              value={phonenumber}
              onChange={(e) => setPhonenumber(e.target.value)}
              placeholder="e.g. 0712345678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-pin">PIN</Label>
            <Input
              id="w-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Authorisation PIN"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || withdraw.isPending}>
            {withdraw.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment prompt (STK push via createSubscription)                            */
/* -------------------------------------------------------------------------- */

type PickedUser = { id: string; label: string; phone?: string };

function PaymentPromptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [user, setUser] = useState<PickedUser | null>(null);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [packageId, setPackageId] = useState<string>("");
  const [phonenumber, setPhonenumber] = useState("");

  const resetAll = () => {
    setUser(null);
    setSelectedShops([]);
    setPackageId("");
    setPhonenumber("");
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const onPickUser = (picked: PickedUser) => {
    setUser(picked);
    setSelectedShops([]);
    setPackageId("");
    setPhonenumber(picked.phone ?? "");
  };

  const { data: shopData, isLoading: shopsLoading } = useListAdminShops(user?.id ?? "", {
    query: {
      enabled: open && !!user?.id,
      queryKey: getListAdminShopsQueryKey(user?.id ?? ""),
    },
  });
  const { data: pkgData, isLoading: pkgsLoading } = useListUserPackages(
    { id: user?.id ?? "" },
    {
      query: {
        enabled: open && !!user?.id,
        queryKey: getListUserPackagesQueryKey({ id: user?.id ?? "" }),
      },
    },
  );

  const shopList = (shopData?.data ?? []) as Array<Record<string, unknown>>;
  const packageList = (pkgData?.data ?? []) as Array<Record<string, unknown>>;

  const selectedPackage = useMemo(
    () => packageList.find((p) => String(p._id) === packageId),
    [packageList, packageId],
  );

  const create = useCreateSubscription({
    mutation: {
      onSuccess: (res) => {
        const r = asRecord(res);
        // Upstream returns the M-Pesa STK result inside a 200: a sent prompt is
        // { status: 200, message: "waiting" }; a gateway rejection is
        // { status: 200, message: "failed" }; an exception is { status: false }.
        const ok = r.status !== false && r.message !== "failed";
        if (ok) {
          toast({
            title: "Payment prompt sent",
            description: "An M-Pesa prompt was pushed to the customer's phone.",
          });
          handleClose();
        } else {
          toast({
            title: "Payment prompt failed",
            description:
              r.message?.toString() ||
              "Could not send the prompt. Check the phone number and try again.",
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({ title: "Failed to send payment prompt", variant: "destructive" });
      },
    },
  });

  const toggleShop = (id: string) => {
    setSelectedShops((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const canSubmit =
    !!user &&
    !!packageId &&
    selectedShops.length > 0 &&
    phonenumber.trim() !== "";

  const submit = () => {
    if (!canSubmit || !user) return;
    create.mutate({
      data: {
        userId: user.id,
        package: packageId,
        // Upstream's Subscription.shop is required, so send the first selected
        // shop as the primary shop in addition to the full shops array.
        shop: selectedShops[0],
        shops: selectedShops,
        paymentType: "mpesa",
        phonenumber: phonenumber.trim(),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send payment prompt</DialogTitle>
          <DialogDescription>
            Pick a customer, choose their shops and a plan, then push an M-Pesa
            prompt to their phone. Prices already reflect whether they are an old
            or new customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1: user */}
          <div className="space-y-2">
            <Label>Customer</Label>
            <UserPicker selected={user} onSelect={onPickUser} />
          </div>

          {user && (
            <>
              {/* Step 2: shops */}
              <div className="space-y-2">
                <Label>Shops</Label>
                {shopsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading shops…</p>
                ) : shopList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This customer has no shops.
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                    {shopList.map((shop) => {
                      const id = String(shop._id);
                      const name = (shop.name as string) || id;
                      return (
                        <label
                          key={id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={selectedShops.includes(id)}
                            onCheckedChange={() => toggleShop(id)}
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedShops.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedShops.length} shop{selectedShops.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              {/* Step 3: package */}
              <div className="space-y-2">
                <Label>Plan</Label>
                {pkgsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading plans…</p>
                ) : packageList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plans available.</p>
                ) : (
                  <div className="space-y-1.5">
                    {packageList.map((pkg) => {
                      const id = String(pkg._id);
                      const active = packageId === id;
                      const title =
                        (pkg.title as string) || (pkg.newTitle as string) || "Plan";
                      const price = packagePrice(pkg);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPackageId(id)}
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                            active
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {active && <Check className="h-4 w-4 text-primary" />}
                            <span className="font-medium">{title}</span>
                            {pkg.type ? (
                              <Badge variant="outline" className="capitalize">
                                {String(pkg.type)}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="font-semibold">{price}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedPackage && isNewPricing(selectedPackage) && (
                  <p className="text-xs text-muted-foreground">
                    New-customer pricing scales with the number of shops; the exact
                    amount is confirmed on the M-Pesa prompt.
                  </p>
                )}
              </div>

              {/* Step 4: phone */}
              <div className="space-y-2">
                <Label htmlFor="pp-phone">Phone number for the prompt</Label>
                <Input
                  id="pp-phone"
                  value={phonenumber}
                  onChange={(e) => setPhonenumber(e.target.value)}
                  placeholder="e.g. 0712345678"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isNewPricing(pkg: Record<string, unknown>): boolean {
  return pkg.priceText != null || pkg.priceFrom != null;
}

function packagePrice(pkg: Record<string, unknown>): string {
  if (typeof pkg.priceText === "string" && pkg.priceText.trim() !== "") {
    return pkg.priceText;
  }
  const amount = pkg.amount ?? pkg.oldAmount;
  return formatKes(amount);
}

/* -------------------------------------------------------------------------- */
/* User combobox                                                               */
/* -------------------------------------------------------------------------- */

function UserPicker({
  selected,
  onSelect,
}: {
  selected: PickedUser | null;
  onSelect: (u: PickedUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const params = { search: search.trim() || undefined, limit: 20 };
  const { data, isLoading } = useListAdmins(params, {
    query: { enabled: open, queryKey: getListAdminsQueryKey(params) },
  });

  const users = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.label : "Select a customer…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, email or phone…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No customers found.</CommandEmpty>
                <CommandGroup>
                  {users.map((u) => {
                    const id = String(u._id);
                    const username = (u.username as string) || "";
                    const email = (u.email as string) || "";
                    const phone = (u.phone as string) || "";
                    const label = username || email || phone || id;
                    return (
                      <CommandItem
                        key={id}
                        value={id}
                        onSelect={() => {
                          onSelect({ id, label, phone: phone || undefined });
                          setOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          {(email || phone) && (
                            <span className="text-xs text-muted-foreground">
                              {[email, phone].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                        {selected?.id === id && (
                          <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
