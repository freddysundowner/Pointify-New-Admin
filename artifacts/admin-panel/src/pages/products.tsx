import { useState } from "react";
import { useListProducts, useListShops } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Products() {
  const [page, setPage] = useState(1);
  const [shopId, setShopId] = useState<string | undefined>(undefined);
  
  const { data, isLoading } = useListProducts({ page, limit: 20, shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Manage all products across shops.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading products...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{getShopName(product.shopId)}</TableCell>
                    <TableCell>{product.sellingPrice}</TableCell>
                    <TableCell>
                      <Badge variant={product.quantity && product.quantity > 0 ? "default" : "destructive"}>
                        {product.quantity || 0}
                      </Badge>
                    </TableCell>
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
