import { useState } from "react";
import { useListSales } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSales({ page, limit: 20 });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
        <p className="text-muted-foreground">View all platform sales.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading sales...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell className="font-medium">{sale.receiptNo}</TableCell>
                    <TableCell>{getShopName(sale.shopId)}</TableCell>
                    <TableCell>{sale.totalAmount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sale.status}</Badge>
                    </TableCell>
                    <TableCell>{sale.createAt ? new Date(sale.createAt).toLocaleDateString() : 'N/A'}</TableCell>
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
