import { useState } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Purchases() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListPurchases({ page, limit: 20 });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
        <p className="text-muted-foreground">View all platform purchases.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchases List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading purchases...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((purchase) => (
                  <TableRow key={purchase._id}>
                    <TableCell className="font-medium">{purchase.invoiceNo}</TableCell>
                    <TableCell>{getShopName(purchase.shopId)}</TableCell>
                    <TableCell>{purchase.totalAmount}</TableCell>
                    <TableCell>{purchase.createAt ? new Date(purchase.createAt).toLocaleDateString() : 'N/A'}</TableCell>
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
