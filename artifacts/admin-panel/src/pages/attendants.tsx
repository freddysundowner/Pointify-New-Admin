import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useListAttendants,
  useResetAttendantPassword,
  type Attendant,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { ShopFilterBanner, useShopFilter } from "@/lib/shop-filter";

function getShopName(shop: unknown): string {
  if (!shop) return "N/A";
  if (typeof shop === "string") return shop;
  const s = shop as { name?: string; _id?: string };
  return s.name || s._id || "N/A";
}

const PAGE_SIZE = 20;

export default function Attendants() {
  const { shopId, shopName, from } = useShopFilter();
  const [resetTarget, setResetTarget] = useState<Attendant | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the username search so we don't hit the backend on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to the first page whenever the search term or shop filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, shopId]);

  const { data, isLoading, isFetching } = useListAttendants({
    shopId,
    username: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const attendants = data?.data ?? [];
  const query = debouncedSearch;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const totalCount = data?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendants" description="Manage shop attendants." />

      <Card>
        <CardHeader>
          <CardTitle>Attendants List</CardTitle>
        </CardHeader>
        <CardContent>
          {shopId && <ShopFilterBanner shopName={shopName} backHref={from} />}
          <div className="mb-4 max-w-sm">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username…"
            />
          </div>
          {isLoading ? (
            <div className="p-4">Loading attendants...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendants.length ? (
                      attendants.map((attendant) => (
                        <TableRow key={attendant._id}>
                          <TableCell className="font-medium">
                            {attendant.username || "—"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {attendant.uniqueDigits ?? "N/A"}
                          </TableCell>
                          <TableCell>{getShopName(attendant.shopId)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setResetTarget(attendant)}
                            >
                              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                              Reset password
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          {query ? "No attendants match your search." : "No attendants found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {attendants.length ? (
                  attendants.map((attendant) => (
                    <div
                      key={attendant._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {attendant.username || "—"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          User ID: {attendant.uniqueDigits ?? "N/A"}
                        </p>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Shop</dt>
                          <dd>{getShopName(attendant.shopId)}</dd>
                        </div>
                      </dl>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => setResetTarget(attendant)}
                      >
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                        Reset password
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    {query ? "No attendants match your search." : "No attendants found."}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {totalCount > 0
                    ? `Page ${page} of ${totalPages} · ${totalCount} attendant${totalCount === 1 ? "" : "s"}`
                    : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isFetching}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ResetPasswordDialog
        attendant={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}

function ResetPasswordDialog({
  attendant,
  onClose,
}: {
  attendant: Attendant | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const reset = useResetAttendantPassword();
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // The upstream only needs a fallback phone when the attendant has none on file.
  const hasPhone = Boolean(attendant?.phone);

  const handleClose = () => {
    setPassword("");
    setPhone("");
    onClose();
  };

  const handleSubmit = () => {
    if (!attendant) return;
    if (password.trim().length < 4) {
      toast({
        title: "Password too short",
        description: "Enter at least 4 characters.",
        variant: "destructive",
      });
      return;
    }
    if (!hasPhone && !phone.trim()) {
      toast({
        title: "Phone number required",
        description: "This attendant has no phone on file. Enter one to send the new password.",
        variant: "destructive",
      });
      return;
    }

    reset.mutate(
      {
        id: attendant._id,
        data: {
          password: password.trim(),
          phone: hasPhone ? undefined : phone.trim(),
        },
      },
      {
        onSuccess: (res) => {
          if (res && res.reset === false) {
            toast({ title: "Reset failed", variant: "destructive" });
            return;
          }
          toast({
            title: "Password reset",
            description: "The new password was sent to the attendant by SMS.",
          });
          handleClose();
        },
        onError: () => toast({ title: "Reset failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={Boolean(attendant)} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset password
          </DialogTitle>
          <DialogDescription>
            Set a new password for {attendant?.username || "this attendant"}. It will be
            sent to them by SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-password">New password</Label>
            <Input
              id="a-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a new password"
              autoComplete="off"
            />
          </div>
          {!hasPhone && (
            <div className="space-y-2">
              <Label htmlFor="a-phone">Phone number</Label>
              <Input
                id="a-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712345678"
              />
              <p className="text-xs text-muted-foreground">
                This attendant has no phone on file. The new password is sent here.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={reset.isPending}>
            {reset.isPending ? "Resetting…" : "Reset & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
