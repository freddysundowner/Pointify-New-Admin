import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSale,
  useUpdateSaleDate,
  useCreateSaleReturn,
  getGetSaleQueryKey,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { formatKes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Rec = Record<string, unknown>;

// EAT is a fixed UTC+3 offset (no DST). The app displays all times in
// Africa/Nairobi, so the date editor reads and writes EAT wall-clock time
// regardless of the operator's own browser timezone.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** ISO instant -> "YYYY-MM-DDTHH:mm" string in EAT, for a datetime-local input. */
function toEatInputValue(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (interpreted as EAT) -> real UTC ISO string. */
function fromEatInputValue(input: string): string | null {
  if (!input) return null;
  const d = new Date(`${input}:00+03:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function refId(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as Rec)["_id"];
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

function refName(value: unknown): string {
  if (!value) return "Item";
  if (typeof value === "string") return value;
  const o = value as Rec;
  return (o["name"] as string) || (o["_id"] as string) || "Item";
}

interface RefundLine {
  product: string;
  name: string;
  sold: number;
  unitPrice: number;
  manageByPrice: boolean;
}

function toRefundLines(items: unknown): RefundLine[] {
  if (!Array.isArray(items)) return [];
  const lines: RefundLine[] = [];
  for (const raw of items) {
    const it = (raw ?? {}) as Rec;
    const product = refId(it["product"]);
    if (!product) continue;
    lines.push({
      product,
      name: refName(it["product"]),
      sold: num(it["quantity"]),
      unitPrice: num(it["unitPrice"]),
      manageByPrice: Boolean(it["manageByPrice"]),
    });
  }
  return lines;
}

function errMessage(err: unknown): string | undefined {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return undefined;
}

export function SaleManageDialog({
  sale,
  onClose,
}: {
  sale: Rec | null;
  onClose: () => void;
}) {
  const open = Boolean(sale);
  const saleId = (sale?.["_id"] as string) || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useGetSale(saleId, {
    query: { enabled: open && Boolean(saleId), queryKey: getGetSaleQueryKey(saleId) },
  });

  const rec = (detail ?? sale ?? {}) as Rec;
  const status = (rec["status"] as string) || "";
  const isCashed = status === "cashed";
  const receiptNo = (rec["receiptNo"] as string) || "—";

  const [dateValue, setDateValue] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [confirmRefund, setConfirmRefund] = useState(false);

  // Prefill / reset whenever a different receipt (or fresh detail) loads.
  useEffect(() => {
    setDateValue(toEatInputValue(rec["createdAt"] ?? rec["createAt"]));
    setReturnQty({});
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, detail]);

  const lines = useMemo(() => toRefundLines(rec["items"]), [rec]);

  const updateDate = useUpdateSaleDate();
  const createReturn = useCreateSaleReturn();

  const refundItems = lines
    .map((line) => {
      // Price-managed lines (sold by weight/value) may be returned in
      // fractional amounts; discrete lines are whole units only.
      const raw = num(returnQty[line.product]);
      const qty = line.manageByPrice ? raw : Math.floor(raw);
      return { line, qty };
    })
    .filter((x) => x.qty > 0);

  const estimatedRefund = refundItems.reduce((sum, { line, qty }) => {
    if (line.manageByPrice && line.sold > 0) {
      return sum + (qty / line.sold) * line.unitPrice;
    }
    return sum + qty * line.unitPrice;
  }, 0);

  const hasInvalidQty = lines.some((line) => {
    const qty = num(returnQty[line.product]);
    if (qty < 0 || qty > line.sold) return true;
    // Only price-managed lines may carry decimals.
    if (!line.manageByPrice && !Number.isInteger(qty)) return true;
    return false;
  });

  const saving = updateDate.isPending || createReturn.isPending;

  const handleSaveDate = () => {
    const iso = fromEatInputValue(dateValue);
    if (!iso) {
      toast({ title: "Enter a valid date and time", variant: "destructive" });
      return;
    }
    updateDate.mutate(
      { id: saleId, data: { createdAt: iso } },
      {
        onSuccess: () => {
          toast({ title: "Receipt date updated" });
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(saleId) });
        },
        onError: (err) =>
          toast({
            title: "Could not update date",
            description: errMessage(err),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRefund = () => {
    setConfirmRefund(false);
    createReturn.mutate(
      {
        id: saleId,
        data: {
          items: refundItems.map(({ line, qty }) => ({ product: line.product, quantity: qty })),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      },
      {
        onSuccess: (res) => {
          const e = (res as { error?: string } | undefined)?.error;
          if (e) {
            toast({ title: "Refund failed", description: e, variant: "destructive" });
            return;
          }
          toast({ title: "Refund processed" });
          setReturnQty({});
          setReason("");
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(saleId) });
        },
        onError: (err) =>
          toast({
            title: "Refund failed",
            description: errMessage(err),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              <span>Manage receipt · {receiptNo}</span>
              {status ? (
                <Badge variant="outline" className="shrink-0 capitalize">
                  {status}
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>Change the receipt date or refund returned items.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Loading receipt…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Change date */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Receipt date &amp; time</h4>
                {isCashed ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor="sale-date" className="sr-only">
                        Date and time
                      </Label>
                      <Input
                        id="sale-date"
                        type="datetime-local"
                        value={dateValue}
                        onChange={(e) => setDateValue(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSaveDate}
                      disabled={updateDate.isPending || !dateValue}
                    >
                      {updateDate.isPending ? "Saving…" : "Save date"}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Only completed (cashed) receipts can have their date changed.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Times are in East Africa Time (EAT).</p>
              </section>

              {/* Refund items */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Refund items</h4>
                {lines.length ? (
                  <>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Item</th>
                            <th className="px-3 py-2 text-right font-medium">Sold</th>
                            <th className="px-3 py-2 text-right font-medium">Unit</th>
                            <th className="px-3 py-2 text-right font-medium">Return qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.product} className="border-t">
                              <td className="px-3 py-2">{line.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{line.sold}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatKes(line.unitPrice)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  max={line.sold}
                                  step={line.manageByPrice ? "any" : 1}
                                  inputMode={line.manageByPrice ? "decimal" : "numeric"}
                                  className="ml-auto h-8 w-20 text-right"
                                  value={returnQty[line.product] ?? ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setReturnQty((prev) => ({
                                      ...prev,
                                      [line.product]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="refund-reason">Reason (optional)</Label>
                      <Textarea
                        id="refund-reason"
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Damaged goods, wrong item…"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <span className="text-sm text-muted-foreground">
                        Estimated refund:{" "}
                        <span className="font-semibold text-foreground">
                          {formatKes(estimatedRefund)}
                        </span>
                      </span>
                      <Button
                        variant="destructive"
                        disabled={refundItems.length === 0 || hasInvalidQty || saving}
                        onClick={() => setConfirmRefund(true)}
                      >
                        {createReturn.isPending ? "Processing…" : "Process refund"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Refunding restocks the returned items and reduces the receipt total. This cannot
                      be undone.
                    </p>
                  </>
                ) : (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    This receipt has no line items to refund.
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRefund} onOpenChange={setConfirmRefund}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process this refund?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to refund {refundItems.length} item
              {refundItems.length === 1 ? "" : "s"} (estimated {formatKes(estimatedRefund)}) on
              receipt {receiptNo}. This restocks the items and reduces the receipt total, and cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund}>Yes, refund</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
