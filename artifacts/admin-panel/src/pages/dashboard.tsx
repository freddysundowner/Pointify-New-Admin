import { useGetAnalyticsOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Store,
  Users,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKes, formatNumber } from "@/lib/utils";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function Dashboard() {
  const { data: analytics, isLoading } = useGetAnalyticsOverview();

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading dashboard…</div>;
  }

  const revenue = analytics?.revenue ?? {};
  const shops = analytics?.shops ?? {};

  const allTime = revenue.allTime ?? {};
  const thisMonth = revenue.thisMonth ?? {};
  const lastMonth = revenue.lastMonth ?? {};

  const monthRevenue = num(thisMonth.revenue);
  const lastMonthRevenue = num(lastMonth.revenue);
  const monthDelta =
    lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : null;
  const monthUp = monthDelta === null || monthDelta >= 0;

  const totalUsers = num(analytics?.totalUsers);
  const payingUsers = num(analytics?.payingUsers);
  const activeShops = num(analytics?.activeShops);
  const trialShops = num(analytics?.trialShops);
  const expiredShops = num(analytics?.expiredShops);

  const productionActive = num(shops.productionActive);
  const productionExpired = num(shops.productionExpired);
  const trialActive = num(shops.trialActive);
  const trialExpired = num(shops.trialExpired);
  const totalShops = activeShops + expiredShops;

  const revenueChart = [
    { label: "Today", revenue: num(revenue.today?.revenue) },
    { label: "Yesterday", revenue: num(revenue.yesterday?.revenue) },
    { label: "This Week", revenue: num(revenue.thisWeek?.revenue) },
    { label: "This Month", revenue: monthRevenue },
    { label: "Last Month", revenue: lastMonthRevenue },
  ];

  const statusRows = [
    {
      label: "Production · Active",
      value: productionActive,
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
    {
      label: "Trial · Active",
      value: trialActive,
      icon: Clock,
      tone: "text-blue-600",
    },
    {
      label: "Production · Expired",
      value: productionExpired,
      icon: XCircle,
      tone: "text-amber-600",
    },
    {
      label: "Trial · Expired",
      value: trialExpired,
      icon: XCircle,
      tone: "text-rose-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Platform performance across all shops on Pointify.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All-time Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKes(allTime.revenue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(allTime.count)} subscription payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKes(monthRevenue)}</div>
            <p className="text-xs flex items-center gap-1">
              {monthDelta === null ? (
                <span className="text-muted-foreground">vs last month</span>
              ) : (
                <>
                  <span
                    className={`flex items-center gap-1 ${
                      monthUp ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {monthUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(monthDelta).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs last month</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(activeShops)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(trialShops)} on trial · {formatNumber(expiredShops)} expired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shop Owners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(payingUsers)} paying customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart + shop status */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue by Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={70}
                    tickFormatter={(v) => formatKes(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    formatter={(value) => [formatKes(value as number), "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Shop Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusRows.map((row) => {
              const pct = totalShops > 0 ? (row.value / totalShops) * 100 : 0;
              const Icon = row.icon;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${row.tone}`} />
                      {row.label}
                    </span>
                    <span className="font-medium">{formatNumber(row.value)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total shops</span>
              <span className="font-semibold">{formatNumber(totalShops)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
