import { useState } from "react";
import { useListPortalTransactions, getListPortalTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { formatKES } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, isError } = useListPortalTransactions(
    { page, limit: 50 },
    { query: { queryKey: getListPortalTransactionsQueryKey({ page, limit: 50 }) } }
  );

  const transactions = result?.data || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1">History of your earnings and withdrawals.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>A complete log of all wallet activity.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive">
              Failed to load transactions. Please try again later.
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <ArrowUpRight className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No transactions yet</h3>
              <p className="text-muted-foreground">Your earnings and withdrawals will appear here.</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {transactions.map((tx: any) => {
                  const isEarning = tx.type === "subscription";
                  return (
                    <div key={tx._id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isEarning ? (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                              <ArrowUpRight className="w-4 h-4" />
                            </div>
                          )}
                          <span className="font-medium capitalize truncate">{tx.type || "Unknown"}</span>
                        </div>
                        <span className={`font-semibold shrink-0 ${isEarning ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {isEarning ? "+" : "-"}{formatKES(isEarning ? tx.affliateAmount : tx.amount)}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground truncate">
                        {isEarning ? (
                          <>From: {tx.user?.username || tx.user?.phone || tx.user?.email || "Unknown User"}</>
                        ) : (
                          <>To: {tx.mpesaCode || "M-Pesa"} {tx.transId ? `(${tx.transId})` : ""}</>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy HH:mm") : "Unknown"}
                        </span>
                        {tx.status === true ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                          </Badge>
                        ) : tx.status === false ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                            <XCircle className="w-3 h-3" /> Failed
                          </Badge>
                        )}
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
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: any) => {
                      const isEarning = tx.type === "subscription";
                      return (
                        <TableRow key={tx._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isEarning ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <ArrowDownLeft className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <ArrowUpRight className="w-4 h-4" />
                              </div>
                            )}
                            <span className="font-medium capitalize">{tx.type || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy HH:mm") : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {isEarning ? (
                              <>
                                <span className="text-muted-foreground">From user: </span>
                                {tx.user?.username || tx.user?.phone || tx.user?.email || "Unknown User"}
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground">To: </span>
                                {tx.mpesaCode || "M-Pesa"} {tx.transId ? `(${tx.transId})` : ""}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={isEarning ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            {isEarning ? "+" : "-"}{formatKES(isEarning ? tx.affliateAmount : tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.status === true ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Confirmed
                            </Badge>
                          ) : tx.status === false ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                              <Clock className="w-3 h-3" /> Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                              <XCircle className="w-3 h-3" /> Failed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
