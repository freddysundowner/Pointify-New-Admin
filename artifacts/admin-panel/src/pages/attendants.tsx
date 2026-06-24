import { useState } from "react";
import { useListAttendants } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Attendants() {
  const [shopId, setShopId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useListAttendants({ shopId });

  const getShopName = (shop: any) => {
    if (!shop) return "N/A";
    return typeof shop === "string" ? shop : shop.name || shop._id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendants</h1>
        <p className="text-muted-foreground">Manage shop attendants.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendants List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading attendants...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Shop</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((attendant) => (
                  <TableRow key={attendant._id}>
                    <TableCell className="font-medium">{attendant.username}</TableCell>
                    <TableCell>{attendant.email || "N/A"}</TableCell>
                    <TableCell>{attendant.phone || "N/A"}</TableCell>
                    <TableCell>{getShopName(attendant.shopId)}</TableCell>
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
