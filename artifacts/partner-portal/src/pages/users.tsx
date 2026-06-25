import { useState, useEffect } from "react";
import { useListPortalUsers, getListPortalUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Loader2, Phone, Mail, Store, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function ReferredUsers() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, isError } = useListPortalUsers(
    { page, limit: PAGE_SIZE },
    { query: { queryKey: getListPortalUsersQueryKey({ page, limit: PAGE_SIZE }) } }
  );

  const users = result?.data || [];
  const totalPages = result?.totalPages || 1;
  const totalCount = result?.count || 0;
  const currentPage = result?.currentPage || page;

  // Mirror the server's reported page back into local state so Prev/Next resume
  // from the correct page if the request was out of range.
  useEffect(() => {
    if (result?.currentPage && result.currentPage !== page) {
      setPage(result.currentPage);
    }
  }, [result?.currentPage, page]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referred Users</h1>
        <p className="text-muted-foreground mt-1">Shop owners who registered using your referral code.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>You earn commission whenever these users pay for a subscription.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive">
              Failed to load users. Please try again later.
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No referred users yet</h3>
              <p className="text-muted-foreground">Share your referral code to start earning commissions.</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {users.map((user: any) => (
                  <div key={user._id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-foreground truncate">{user.username || 'Unnamed User'}</div>
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className={`shrink-0 ${user.status === 'active' ? 'bg-primary hover:bg-primary/90' : ''}`}>
                        {user.status || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {user.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      )}
                      {user.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{user.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted font-medium">
                        <Store className="w-3.5 h-3.5" />
                        {user.shopCount || 0} shops
                      </div>
                      <span className="text-muted-foreground">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "Unknown"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>User Details</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Shops</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{user.username || 'Unnamed User'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            {user.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" />
                                {user.email}
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className={user.status === 'active' ? 'bg-primary hover:bg-primary/90' : ''}>
                            {user.status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-xs font-medium">
                            <Store className="w-3.5 h-3.5" />
                            {user.shopCount || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "Unknown"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} · {totalCount} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
