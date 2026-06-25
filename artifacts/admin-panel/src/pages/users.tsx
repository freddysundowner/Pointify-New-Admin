import { useState, useEffect } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdmins,
  useUpdateAdmin,
  useDeleteAdmin,
  useResetAdminPassword,
  getListAdminsQueryKey,
  type Admin,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  KeyRound,
  Trash2,
  Store,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";

const LIMIT = 20;

type DialogMode = "view" | "edit" | "reset" | "delete" | null;

export default function Users() {
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Debounce the free-text search so we don't query upstream on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets back to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, from, to]);

  const params = {
    page,
    limit: LIMIT,
    ...(search ? { search } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const { data, isLoading, isFetching } = useListAdmins(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<Admin | null>(null);

  const hasDateFilter = Boolean(from || to);
  const hasAnyFilter = Boolean(search || from || to);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setFrom("");
    setTo("");
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey(params) });

  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();
  const resetPassword = useResetAdminPassword();

  const totalPages = data?.totalPages ?? 1;
  const count = data?.count ?? 0;
  const currentPage = data?.currentPage ?? page;
  const rangeStart = count === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const rangeEnd = Math.min(currentPage * LIMIT, count);

  const openDialog = (m: DialogMode, user: Admin) => {
    setSelected(user);
    setMode(m);
  };
  const closeDialog = () => {
    setMode(null);
    setSelected(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Users" description="Manage shop owners and platform users." />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar
            className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end"
            active={hasAnyFilter}
          >
              <div className="space-y-1.5">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Phone, email or username"
                    className="pl-8 sm:w-64"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="from">Registered from</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="sm:w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">Registered to</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="sm:w-40"
                />
              </div>
              {hasAnyFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
          </FilterBar>

          {hasDateFilter && !isLoading && (
            <div className="mb-4 rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <span className="font-semibold">{(data?.count ?? 0).toLocaleString()}</span>{" "}
              {(data?.count ?? 0) === 1 ? "user" : "users"} registered{" "}
              {from && to
                ? from === to
                  ? `on ${from}`
                  : `between ${from} and ${to}`
                : from
                  ? `on or after ${from}`
                  : `on or before ${to}`}
              .
            </div>
          )}

          {isLoading ? (
            <div className="p-4">Loading users...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Date Registered</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Shops</TableHead>
                      <TableHead className="w-[60px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.length ? (
                      data.data.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.phone}</TableCell>
                          <TableCell>{formatDate(user.createdAt)}</TableCell>
                          <TableCell>{formatDate(user.last_seen)}</TableCell>
                          <TableCell>{user.shopCount}</TableCell>
                          <TableCell className="text-right">
                            <UserActions user={user} openDialog={openDialog} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((user) => (
                    <div
                      key={user._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {user.username || "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {user.email || "—"}
                          </p>
                        </div>
                        <UserActions user={user} openDialog={openDialog} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Phone</dt>
                          <dd>{user.phone || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Shops</dt>
                          <dd>{user.shopCount ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Registered</dt>
                          <dd>{formatDate(user.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Last Seen</dt>
                          <dd>{formatDate(user.last_seen)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No users found.
                  </div>
                )}
              </div>

              <div className="flex flex-col items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {count > 0
                    ? `Showing ${rangeStart}–${rangeEnd} of ${count.toLocaleString()} users`
                    : "No users"}
                </p>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={currentPage >= totalPages || isFetching}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ViewDialog
          open={mode === "view"}
          onClose={closeDialog}
          user={selected}
        />
      )}

      {selected && (
        <EditDialog
          open={mode === "edit"}
          onClose={closeDialog}
          user={selected}
          onSave={(values) => {
            updateAdmin.mutate(
              { id: selected._id, data: values },
              {
                onSuccess: (res) => {
                  const err = (res as { error?: string } | undefined)?.error;
                  if (err) {
                    toast({ title: "Update failed", description: err, variant: "destructive" });
                    return;
                  }
                  toast({ title: "User updated" });
                  invalidate();
                  closeDialog();
                },
                onError: () =>
                  toast({ title: "Update failed", variant: "destructive" }),
              },
            );
          }}
          saving={updateAdmin.isPending}
        />
      )}

      {selected && (
        <ResetDialog
          open={mode === "reset"}
          onClose={closeDialog}
          user={selected}
          onReset={(password) => {
            resetPassword.mutate(
              { id: selected._id, data: { password } },
              {
                onSuccess: (res) => {
                  if (res?.reset === false || res?.error) {
                    toast({ title: "Reset failed", description: res?.error, variant: "destructive" });
                    return;
                  }
                  toast({
                    title: "Password reset",
                    description: "The new password was sent to the user by SMS.",
                  });
                  closeDialog();
                },
                onError: () =>
                  toast({ title: "Reset failed", variant: "destructive" }),
              },
            );
          }}
          resetting={resetPassword.isPending}
        />
      )}

      <AlertDialog open={mode === "delete"} onOpenChange={(o) => !o && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium">{selected?.username || selected?.email}</span> and cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAdmin.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAdmin.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!selected) return;
                deleteAdmin.mutate(
                  { id: selected._id },
                  {
                    onSuccess: () => {
                      toast({ title: "User deleted" });
                      invalidate();
                      closeDialog();
                    },
                    onError: () =>
                      toast({ title: "Delete failed", variant: "destructive" }),
                  },
                );
              }}
            >
              {deleteAdmin.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserActions({
  user,
  openDialog,
}: {
  user: Admin;
  openDialog: (m: DialogMode, user: Admin) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDialog("view", user)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog("edit", user)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/users/${user._id}/shops`}>
            <Store className="mr-2 h-4 w-4" />
            Shops
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog("reset", user)}>
          <KeyRound className="mr-2 h-4 w-4" />
          Reset Password
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => openDialog("delete", user)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 break-words">{value ?? "—"}</span>
    </div>
  );
}

function ViewDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: Admin;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.username || "User"}</DialogTitle>
          <DialogDescription>User details</DialogDescription>
        </DialogHeader>
        <div className="divide-y">
          <Row label="Username" value={user.username} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="Date Registered" value={formatDate(user.createdAt)} />
          <Row label="Last Seen" value={formatDate(user.last_seen)} />
          <Row label="Shops" value={user.shopCount} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onClose,
  user,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  user: Admin;
  onSave: (values: { username?: string; email?: string; phone?: string; status?: string }) => void;
  saving: boolean;
}) {
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [status, setStatus] = useState(user.status ?? "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update this user's details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Input id="status" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                username: username || undefined,
                email: email || undefined,
                phone: phone || undefined,
                status: status || undefined,
              })
            }
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({
  open,
  onClose,
  user,
  onReset,
  resetting,
}: {
  open: boolean;
  onClose: () => void;
  user: Admin;
  onReset: (password: string) => void;
  resetting: boolean;
}) {
  const [password, setPassword] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for{" "}
            <span className="font-medium">{user.username || user.email}</span>. It will be sent to
            them by SMS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a new password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resetting}>
            Cancel
          </Button>
          <Button onClick={() => onReset(password)} disabled={resetting || password.length < 4}>
            {resetting ? "Resetting..." : "Reset & send SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
