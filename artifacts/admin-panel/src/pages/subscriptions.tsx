import { useState } from "react";
import { useListSubscriptions } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Subscriptions() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSubscriptions({ page, limit: 20 });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground">Manage all shop subscriptions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading subscriptions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((sub) => (
                  <TableRow key={sub._id}>
                    <TableCell className="font-medium">{getShopName(sub.shop)}</TableCell>
                    <TableCell>{sub.type}</TableCell>
                    <TableCell>{sub.amount}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status ? "default" : "destructive"}>
                        {sub.status ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
