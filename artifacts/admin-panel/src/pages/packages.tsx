import { useListPackages } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKes } from "@/lib/utils";

export default function Packages() {
  const { data, isLoading } = useListPackages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
        <p className="text-muted-foreground">Manage subscription packages.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Packages List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading packages...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((pkg) => (
                      <TableRow key={pkg._id}>
                        <TableCell className="font-medium">{pkg.title}</TableCell>
                        <TableCell>{pkg.type}</TableCell>
                        <TableCell>{pkg.durationValue} {pkg.durationUnit}</TableCell>
                        <TableCell>{formatKes(pkg.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={pkg.status ? "default" : "secondary"}>
                            {pkg.status ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((pkg) => (
                    <div
                      key={pkg._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{pkg.title}</p>
                          <p className="truncate text-sm text-muted-foreground">{pkg.type}</p>
                        </div>
                        <Badge
                          variant={pkg.status ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {pkg.status ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Duration</dt>
                          <dd>{pkg.durationValue} {pkg.durationUnit}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Amount</dt>
                          <dd>{formatKes(pkg.amount)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No packages found.
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
