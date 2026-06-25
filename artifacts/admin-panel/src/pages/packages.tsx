import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPackages,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  useGetPackage,
  getListPackagesQueryKey,
  getGetPackageQueryKey,
  type Package,
  type PackageInput,
  type PackageUpdate,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatKes } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

const DURATION_UNITS = ["days", "weeks", "months", "years"] as const;
type DurationUnit = (typeof DURATION_UNITS)[number];

// The list endpoint shows `newTitle || title` as the title, so the customer-facing
// name lives in `newTitle`. We keep both in sync on save.
function displayName(pkg: Package): string {
  const newTitle = typeof pkg.newTitle === "string" ? pkg.newTitle.trim() : "";
  return newTitle || pkg.title?.trim() || "Untitled package";
}

export default function Packages() {
  const { data, isLoading } = useListPackages();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deletePackage = useDeletePackage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        toast({
          title: "Package deleted",
          description: deleteTarget ? displayName(deleteTarget) : undefined,
        });
        setDeleteTarget(null);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to delete package",
          description: "The package could not be deleted. Please try again.",
        });
      },
    },
  });

  const packages = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Create, edit and remove subscription packages."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New package
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Packages List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading packages...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[56px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.length ? (
                      packages.map((pkg) => (
                        <TableRow key={pkg._id}>
                          <TableCell className="font-medium">{displayName(pkg)}</TableCell>
                          <TableCell className="capitalize">{pkg.type || "—"}</TableCell>
                          <TableCell>
                            {pkg.durationValue} {pkg.durationUnit}
                          </TableCell>
                          <TableCell>{formatKes(pkg.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={pkg.status ? "default" : "secondary"}>
                              {pkg.status ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <PackageActions
                              onEdit={() => setEditId(pkg._id)}
                              onDelete={() => setDeleteTarget(pkg)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No packages found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {packages.length ? (
                  packages.map((pkg) => (
                    <div key={pkg._id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{displayName(pkg)}</p>
                          <p className="truncate text-sm capitalize text-muted-foreground">
                            {pkg.type || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant={pkg.status ? "default" : "secondary"}>
                            {pkg.status ? "Active" : "Inactive"}
                          </Badge>
                          <PackageActions
                            onEdit={() => setEditId(pkg._id)}
                            onDelete={() => setDeleteTarget(pkg)}
                          />
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Duration</dt>
                          <dd>
                            {pkg.durationValue} {pkg.durationUnit}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Amount</dt>
                          <dd>{formatKes(pkg.amount)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No packages found.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreatePackageDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <EditPackageDialog id={editId} onClose={() => setEditId(null)} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this package?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-semibold">
                {deleteTarget ? displayName(deleteTarget) : "this package"}
              </span>
              . Existing subscriptions are not affected, but the package can no longer be selected.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePackage.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePackage.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deletePackage.mutate({ id: deleteTarget._id });
              }}
            >
              {deletePackage.isPending ? "Deleting…" : "Delete package"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PackageActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open package actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit package
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete package
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function CreatePackageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            New package
          </DialogTitle>
          <DialogDescription>Add a new subscription package.</DialogDescription>
        </DialogHeader>
        {open && <PackageForm mode="create" onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

function EditPackageDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const open = Boolean(id);
  // The list mutates display values (computed price, forced 30-day duration,
  // newTitle as title), so load the raw stored package to seed accurate values.
  const { data, isLoading, isError } = useGetPackage(id ?? "", {
    query: {
      enabled: open && Boolean(id),
      queryKey: getGetPackageQueryKey(id ?? ""),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit package
          </DialogTitle>
          <DialogDescription>{data ? displayName(data) : "Package"}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            Loading package…
          </div>
        ) : isError || !data ? (
          <p className="py-10 text-center text-sm text-destructive">
            Could not load this package. Please try again.
          </p>
        ) : (
          <PackageForm key={data._id} mode="edit" detail={data} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared form (create + edit)
// ---------------------------------------------------------------------------

function numStr(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

// Optional numeric inputs: blank → omit; non-finite (e.g. a stray "-") → omit
// so we never send NaN upstream.
function optionalNum(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function PackageForm({
  mode,
  detail,
  onDone,
}: {
  mode: "create" | "edit";
  detail?: Package;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const create = useCreatePackage();
  const update = useUpdatePackage();
  const isPending = create.isPending || update.isPending;

  const initialUnit =
    detail && DURATION_UNITS.includes(detail.durationUnit as DurationUnit)
      ? (detail.durationUnit as DurationUnit)
      : "days";
  const initialType = detail?.type === "production" ? "production" : "trial";
  const newTitle = detail && typeof detail.newTitle === "string" ? detail.newTitle : "";

  const [name, setName] = useState(newTitle || detail?.title || "");
  const [description, setDescription] = useState(detail?.description ?? "");
  const [type, setType] = useState<"trial" | "production">(initialType);
  const [status, setStatus] = useState(detail ? detail.status !== false : true);
  const [amount, setAmount] = useState(numStr(detail?.amount));
  const [amountusd, setAmountusd] = useState(numStr(detail?.amountusd));
  const [newAmount, setNewAmount] = useState(numStr(detail?.newAmount));
  const [newAmountusd, setNewAmountusd] = useState(numStr(detail?.newAmountusd));
  const [newMaxShops, setNewMaxShops] = useState(numStr(detail?.newMaxShops));
  const [durationValue, setDurationValue] = useState(numStr(detail?.durationValue) || "30");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialUnit);
  const [maxShops, setMaxShops] = useState(numStr(detail?.maxShops));
  const [discount, setDiscount] = useState(numStr(detail?.discount));
  const [order, setOrder] = useState(numStr(detail?.order));
  const [features, setFeatures] = useState((detail?.features ?? []).join("\n"));

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const amountNum = Number(amount);
    const amountUsdNum = Number(amountusd);
    const durationNum = Number(durationValue);
    if (!Number.isFinite(amountNum) || amount === "") {
      toast({ title: "Amount (KES) is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amountUsdNum) || amountusd === "") {
      toast({ title: "Amount (USD) is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(durationNum) || durationValue === "") {
      toast({ title: "Duration is required", variant: "destructive" });
      return;
    }

    const featureList = features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    // Keep `title` and `newTitle` in sync: the list shows `newTitle || title`,
    // so a single Name field must write both for renames to appear everywhere.
    const base = {
      title: trimmedName,
      newTitle: trimmedName,
      description: description.trim(),
      type,
      status,
      amount: amountNum,
      amountusd: amountUsdNum,
      newAmount: optionalNum(newAmount),
      newAmountusd: optionalNum(newAmountusd),
      durationValue: durationNum,
      durationUnit,
      maxShops: optionalNum(maxShops),
      discount: optionalNum(discount),
      order: optionalNum(order),
      features: featureList,
    };

    if (mode === "create") {
      create.mutate(
        { data: base as PackageInput },
        {
          onSuccess: () => {
            toast({ title: "Package created", description: trimmedName });
            queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
            onDone();
          },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        },
      );
      return;
    }

    if (!detail) return;
    update.mutate(
      { id: detail._id, data: { ...base, newMaxShops: optionalNum(newMaxShops) } as PackageUpdate },
      {
        onSuccess: () => {
          toast({ title: "Package updated" });
          queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPackageQueryKey(detail._id) });
          onDone();
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="p-name">Name</Label>
          <Input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Starter"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-description">Description</Label>
          <Textarea
            id="p-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description shown to customers"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "trial" | "production")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-order">Display order</Label>
            <Input
              id="p-order"
              type="number"
              inputMode="numeric"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Current pricing</p>
              <p className="text-xs text-muted-foreground">
                What customers on the old pricing group pay.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-amount">Amount (KES)</Label>
                <Input
                  id="p-amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-amountusd">Amount (USD)</Label>
                <Input
                  id="p-amountusd"
                  type="number"
                  inputMode="decimal"
                  value={amountusd}
                  onChange={(e) => setAmountusd(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="p-maxshops">Max shops</Label>
                <Input
                  id="p-maxshops"
                  type="number"
                  inputMode="numeric"
                  value={maxShops}
                  onChange={(e) => setMaxShops(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <div>
              <p className="text-sm font-medium">New pricing</p>
              <p className="text-xs text-muted-foreground">
                Applied to customers on the new pricing group.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-newamount">New amount (KES)</Label>
                <Input
                  id="p-newamount"
                  type="number"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-newamountusd">New amount (USD)</Label>
                <Input
                  id="p-newamountusd"
                  type="number"
                  inputMode="decimal"
                  value={newAmountusd}
                  onChange={(e) => setNewAmountusd(e.target.value)}
                />
              </div>
              {mode !== "create" && (
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="p-newmaxshops">New max shops</Label>
                  <Input
                    id="p-newmaxshops"
                    type="number"
                    inputMode="numeric"
                    value={newMaxShops}
                    onChange={(e) => setNewMaxShops(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="p-duration">Duration</Label>
            <Input
              id="p-duration"
              type="number"
              inputMode="numeric"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="capitalize">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-discount">Discount (%)</Label>
            <Input
              id="p-discount"
              type="number"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-features">Features</Label>
          <Textarea
            id="p-features"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            rows={4}
            placeholder="One feature per line"
          />
          <p className="text-xs text-muted-foreground">One feature per line.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="p-status">Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive packages are hidden from customers.
            </p>
          </div>
          <Switch id="p-status" checked={status} onCheckedChange={setStatus} />
        </div>

        {type === "production" && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Note: for production packages the customer-facing price is calculated automatically from
            the number of shops (max shops). The amount above is kept on record but may not match the
            displayed price.
          </p>
        )}
      </div>

      <DialogFooter className="mt-2">
        <Button variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Create package"
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
