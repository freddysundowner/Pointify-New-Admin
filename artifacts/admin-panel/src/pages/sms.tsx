import { useState } from "react";
import { useListSmsLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SMS() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSmsLogs({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SMS Hub</h1>
        <p className="text-muted-foreground">Manage platform communications.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMS Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading logs...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="font-medium">{log.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.status}</Badge>
                        </TableCell>
                        <TableCell>{log.smsType}</TableCell>
                        <TableCell>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((log) => (
                    <div
                      key={log._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{log.phone}</p>
                          <p className="text-sm text-muted-foreground">{log.message}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{log.status}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Type</dt>
                          <dd>{log.smsType}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Date</dt>
                          <dd>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A'}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No SMS logs found.
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
