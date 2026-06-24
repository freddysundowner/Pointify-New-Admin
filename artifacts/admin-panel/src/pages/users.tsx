import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdmins,
  useUpdateAdmin,
  useDeleteAdmin,
  useResetAdminPassword,
  getListAdminsQueryKey,
  type Admin,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const LIMIT = 20;

type DialogMode = "view" | "edit" | "reset" | "delete" | null;

export default function Users() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListAdmins({ page, limit: LIMIT });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<Admin | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey({ page, limit: LIMIT }) });

  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();
  const resetPassword = useResetAdminPassword();

  const totalPages = data?.totalPages ?? 1;
  const count = data?.count ?? 0;
  const currentPage = data?.currentPage ?? page;
  const from = count === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const to = Math.min(currentPage * LIMIT, count);

  const openDialog = (m: DialogMode, user: Admin) => {
    setSelected(user);
    setMode(m);
  };
  const closeDialog = () => {
    setMode(null);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Users</h1>
        <p className="text-muted-foreground">Manage shop owners and platform users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading users...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
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
                        <TableCell>
                          <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                            {user.status || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.shopCount}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {count > 0
                    ? `Showing ${from}–${to} of ${count.toLocaleString()} users`
                    : "No users"}
                </p>
                <div className="flex items-center gap-2">
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
          <Row
            label="Status"
            value={
              <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                {user.status || "Unknown"}
              </Badge>
            }
          />
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
