import { useGetPortalSummary, getGetPortalSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Store, Users, Banknote, ArrowUpRight, Clock } from "lucide-react";
import { formatKES } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetPortalSummary({
    query: { queryKey: getGetPortalSummaryQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-14"></CardHeader>
              <CardContent className="h-16"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>Failed to load dashboard summary.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Here's how your referrals are performing.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-mono font-bold text-sm border border-primary/20">
            Code: {summary.code || 'N/A'}
          </div>
          <Link href="/withdraw">
            <Button>Withdraw Funds</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground shadow-md border-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium opacity-90">Available Wallet</CardTitle>
            <Wallet className="h-5 w-5 opacity-75" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatKES(summary.wallet)}</div>
            <p className="text-xs opacity-75 mt-1">
              Ready to withdraw
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
            <Banknote className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKES(summary.totalEarned)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Referred Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.userCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered shop owners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Shops</CardTitle>
            <Store className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.shopCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Created by your users
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Pending Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKES(summary.pendingWithdrawals)}</div>
            <p className="text-sm text-muted-foreground mt-1">Currently processing</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowUpRight className="w-5 h-5" />
              Total Withdrawn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKES(summary.totalWithdrawn)}</div>
            <p className="text-sm text-muted-foreground mt-1">Successfully cashed out</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
