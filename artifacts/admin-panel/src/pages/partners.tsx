import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  getListPartnersQueryKey,
  type Partner,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Handshake,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LIMIT = 20;

interface PartnerForm {
  name: string;
  email: string;
  phonenumber: string;
  country: string;
  address: string;
  commission: string;
  password: string;
  blocked: boolean;
}

const emptyForm: PartnerForm = {
  name: "",
  email: "",
  phonenumber: "",
  country: "",
  address: "",
  commission: "",
  password: "",
  blocked: false,
};

function shopsCount(p: Partner): number {
  return Array.isArray(p.shops) ? p.shops.length : 0;
}

export default function Partners() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useListPartners({
    page,
    limit: LIMIT,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  const create = useCreatePartner();
  const update = useUpdatePartner();
  const remove = useDeletePartner();

  const partners = data?.data ?? [];
  const count = data?.count ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.currentPage ?? page;
  const rangeStart = count === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const rangeEnd = Math.min(currentPage * LIMIT, count);

  const trimmedName = form.name.trim();
  const isSaving = create.isPending || update.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListPartnersQueryKey() });

  const setField = <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (partner: Partner) => {
    setEditing(partner);
    setForm({
      name: partner.name ?? "",
      email: partner.email ?? "",
      phonenumber: partner.phonenumber ?? "",
      country: partner.country ?? "",
      address: partner.address ?? "",
      commission:
        partner.commission === null || partner.commission === undefined
          ? ""
          : String(partner.commission),
      password: "",
      blocked: partner.blocked === true,
    });
    setFormOpen(true);
  };

  const parsedCommission = () => {
    const t = form.commission.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSave = () => {
    if (!trimmedName) return;

    if (editing) {
      update.mutate(
        {
          id: editing._id,
          data: {
            name: trimmedName,
            email: form.email.trim(),
            phonenumber: form.phonenumber.trim(),
            country: form.country.trim(),
            address: form.address.trim(),
            ...(parsedCommission() !== undefined
              ? { commission: parsedCommission() }
              : {}),
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
            blocked: form.blocked,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Partner updated" });
            setFormOpen(false);
            refresh();
          },
          onError: () =>
            toast({
              title: "Couldn't update partner",
              description: "Please try again.",
              variant: "destructive",
            }),
        },
      );
      return;
    }

    create.mutate(
      {
        data: {
          name: trimmedName,
          email: form.email.trim() || undefined,
          phonenumber: form.phonenumber.trim() || undefined,
          country: form.country.trim() || undefined,
          ...(parsedCommission() !== undefined
            ? { commission: parsedCommission() }
            : {}),
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Partner created",
            description: "A welcome email with login details was sent to the partner.",
          });
          setFormOpen(false);
          setPage(1);
          refresh();
        },
        onError: () =>
          toast({
            title: "Couldn't create partner",
            description:
              "The email may already be in use, or the request failed. Please try again.",
            variant: "destructive",
          }),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(
      { id: deleteTarget._id },
      {
        onSuccess: () => {
          toast({ title: "Partner deleted" });
          setDeleteTarget(null);
          refresh();
        },
        onError: () => {
          setDeleteTarget(null);
          toast({
            title: "Couldn't delete partner",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">
            Manage marketing program partners, their commission, and account access.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All partners</CardTitle>
          <CardDescription>
            Partners earn commission on the shops and users they refer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading partners...</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 p-10 text-center text-muted-foreground">
              <p>Couldn't load partners.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-muted-foreground">
              <Handshake className="h-8 w-8" />
              <p>No partners yet.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first partner
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Wallet</TableHead>
                      <TableHead className="text-center">Shops</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners
                      .filter((p) => p._id)
                      .map((p) => (
                        <TableRow key={p._id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{p.name || "—"}</span>
                              {p.code ? (
                                <span className="text-xs text-muted-foreground">
                                  Code: {p.code}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span>{p.email || "—"}</span>
                              <span className="text-muted-foreground">
                                {p.phonenumber || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.commission === null || p.commission === undefined
                              ? "—"
                              : `${p.commission}%`}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.wallet === null || p.wallet === undefined
                              ? "—"
                              : `KES ${Number(p.wallet).toLocaleString()}`}
                          </TableCell>
                          <TableCell className="text-center">
                            {shopsCount(p)}
                          </TableCell>
                          <TableCell>
                            {p.blocked ? (
                              <Badge variant="destructive">Blocked</Badge>
                            ) : (
                              <Badge variant="secondary">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(p)}
                                aria-label="Edit partner"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(p)}
                                aria-label="Delete partner"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {partners
                  .filter((p) => p._id)
                  .map((p) => (
                    <div
                      key={p._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name || "—"}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {p.email || "—"}
                          </p>
                          {p.phonenumber ? (
                            <p className="text-sm text-muted-foreground">
                              {p.phonenumber}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(p)}
                            aria-label="Edit partner"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete partner"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        {p.blocked ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                        <span className="text-muted-foreground">
                          {p.commission === null || p.commission === undefined
                            ? "No commission set"
                            : `${p.commission}% commission`}
                        </span>
                        <span className="text-muted-foreground">
                          · {shopsCount(p)} shops
                        </span>
                        {p.wallet !== null && p.wallet !== undefined ? (
                          <span className="text-muted-foreground">
                            · KES {Number(p.wallet).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex flex-col items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {count > 0
                    ? `Showing ${rangeStart}–${rangeEnd} of ${count.toLocaleString()} partners`
                    : "No partners"}
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

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit partner" : "Add partner"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this partner's details."
                : "Register a new partner. A welcome email with their login details will be sent."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="partner-name">Name *</Label>
              <Input
                id="partner-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Partner or company name"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-email">Email</Label>
                <Input
                  id="partner-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="partner@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-phone">Phone</Label>
                <Input
                  id="partner-phone"
                  value={form.phonenumber}
                  onChange={(e) => setField("phonenumber", e.target.value)}
                  placeholder="07XX XXX XXX"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-country">Country</Label>
                <Input
                  id="partner-country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  placeholder="Kenya"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-commission">Commission (%)</Label>
                <Input
                  id="partner-commission"
                  type="number"
                  inputMode="decimal"
                  value={form.commission}
                  onChange={(e) => setField("commission", e.target.value)}
                  placeholder="20"
                />
              </div>
            </div>
            {editing ? (
              <div className="space-y-2">
                <Label htmlFor="partner-address">Address</Label>
                <Input
                  id="partner-address"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="Street, city"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="partner-password">
                {editing ? "Reset password" : "Password"}
              </Label>
              <Input
                id="partner-password"
                type="text"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder={
                  editing
                    ? "Leave blank to keep current password"
                    : "Leave blank to auto-generate"
                }
              />
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "If set, the partner is emailed their new password."
                  : "If left blank, a password is generated and emailed to the partner."}
              </p>
            </div>
            {editing ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="partner-blocked">Block account</Label>
                  <p className="text-xs text-muted-foreground">
                    Blocked partners can't sign in to the partner portal.
                  </p>
                </div>
                <Switch
                  id="partner-blocked"
                  checked={form.blocked}
                  onCheckedChange={(v) => setField("blocked", v)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!trimmedName || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{deleteTarget?.name || "this partner"}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the partner and their account access. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
