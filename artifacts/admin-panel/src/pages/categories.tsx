import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListShopCategories,
  useCreateShopCategory,
  useUpdateShopCategory,
  useDeleteShopCategory,
  getListShopCategoriesQueryKey,
  type ShopCategory,
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
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const { data, isLoading, isError, refetch } = useListShopCategories();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShopCategory | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ShopCategory | null>(null);

  const create = useCreateShopCategory();
  const update = useUpdateShopCategory();
  const remove = useDeleteShopCategory();

  const categories = data ?? [];
  const trimmed = name.trim();
  const isSaving = create.isPending || update.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListShopCategoriesQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setFormOpen(true);
  };

  const openEdit = (category: ShopCategory) => {
    setEditing(category);
    setName(category.name ?? "");
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!trimmed) return;

    if (editing) {
      update.mutate(
        { id: editing._id, data: { name: trimmed } },
        {
          onSuccess: () => {
            toast({ title: "Category updated" });
            setFormOpen(false);
            refresh();
          },
          onError: () =>
            toast({
              title: "Couldn't update category",
              description: "Please try again.",
              variant: "destructive",
            }),
        },
      );
      return;
    }

    create.mutate(
      { data: { name: trimmed } },
      {
        onSuccess: (result) => {
          // Upstream returns 201 with `{ error: "...already exists" }` on a
          // duplicate name rather than a real error status, so detect it here.
          const dupError = (result as { error?: unknown })?.error;
          if (typeof dupError === "string") {
            toast({
              title: "Category not created",
              description: dupError,
              variant: "destructive",
            });
            return;
          }
          toast({ title: "Category created" });
          setFormOpen(false);
          refresh();
        },
        onError: () =>
          toast({
            title: "Couldn't create category",
            description: "Please try again.",
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
          toast({ title: "Category deleted" });
          setDeleteTarget(null);
          refresh();
        },
        onError: () => {
          setDeleteTarget(null);
          toast({
            title: "Couldn't delete category",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Shop Categories"
        description="Manage the categories shops can be assigned to."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add category
          </Button>
        }
      />

      <Card className="page-card">
        <CardHeader>
          <CardTitle>All categories</CardTitle>
          <CardDescription>
            These categories are global and shared across every shop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading categories...</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 p-10 text-center text-muted-foreground">
              <p>Couldn't load categories.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-muted-foreground">
              <Tags className="h-8 w-8" />
              <p>No categories yet.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first category
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
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories
                      .filter((c) => c._id)
                      .map((c) => (
                        <TableRow key={c._id}>
                          <TableCell className="font-medium">
                            {c.name || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(c)}
                                aria-label="Edit category"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(c)}
                                aria-label="Delete category"
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
                {categories
                  .filter((c) => c._id)
                  .map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <p className="min-w-0 truncate font-semibold">
                        {c.name || "—"}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          aria-label="Edit category"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(c)}
                          aria-label="Delete category"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the category name."
                : "Create a new shop category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Restaurant, Pharmacy, Retail"
              onKeyDown={(e) => {
                if (e.key === "Enter" && trimmed && !isSaving) handleSave();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!trimmed || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
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
              Delete "{deleteTarget?.name || "this category"}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the category. Shops currently assigned to
              it will no longer have a category. This can't be undone.
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
