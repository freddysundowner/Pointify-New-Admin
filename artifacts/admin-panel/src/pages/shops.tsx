import { useState } from "react";
import { useListShops } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Shops() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListShops({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shops</h1>
        <p className="text-muted-foreground">Manage all shops registered on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shops</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading shops...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((shop) => (
                  <TableRow key={shop._id}>
                    <TableCell className="font-medium">{shop.name}</TableCell>
                    <TableCell>{shop.contact}</TableCell>
                    <TableCell>{shop.currency}</TableCell>
                    <TableCell>
                      <Badge variant={shop.production ? "default" : "secondary"}>
                        {shop.production ? "Production" : "Trial"}
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
