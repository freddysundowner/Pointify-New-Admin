import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatKes } from "@/lib/utils";

type Rec = Record<string, unknown>;

export type ReceiptKind = "sale" | "purchase";

/** Read a display name off a populated ref (or fall back to a raw id / dash). */
function refName(value: unknown, key = "name"): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  const o = value as Rec;
  return (o[key] as string) || (o["_id"] as string) || "—";
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

function toLineItems(items: unknown): LineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const it = (raw ?? {}) as Rec;
    const quantity = num(it["quantity"]);
    const unitPrice = num(it["unitPrice"]);
    const discount = num(it["lineDiscount"]);
    return {
      name: refName(it["product"]),
      quantity,
      unitPrice,
      discount,
      total: quantity * unitPrice - discount,
    };
  });
}

interface Payment {
  amount: number;
  date: unknown;
  paymentNo: string;
  balance: number;
}

function toPayments(payments: unknown): Payment[] {
  if (!Array.isArray(payments)) return [];
  return payments.map((raw) => {
    const p = (raw ?? {}) as Rec;
    return {
      amount: num(p["amount"]),
      date: p["date"],
      paymentNo: (p["paymentNo"] as string) || "",
      balance: num(p["balance"]),
    };
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function ReceiptDialog({
  kind,
  record,
  onClose,
}: {
  kind: ReceiptKind;
  record: Rec | null;
  onClose: () => void;
}) {
  const isSale = kind === "sale";
  const rec = record ?? {};

  const number =
    (rec["receiptNo"] as string) ||
    (rec["invoiceNo"] as string) ||
    (rec["purchaseNo"] as string) ||
    "—";
  const items = toLineItems(rec["items"]);
  const payments = toPayments(rec["payments"]);
  const itemsSubtotal = items.reduce((sum, i) => sum + i.total, 0);

  const total = num(rec["totalWithDiscount"]) || num(rec["totalAmount"]);
  const amountPaid = num(rec["amountPaid"]);
  const balance = num(rec["outstandingBalance"]);
  const tax = num(rec["totaltax"]);
  const discount = num(rec["totalDiscount"]) || num(rec["saleDiscount"]);
  const note = (rec["salesnote"] as string) || "";

  return (
    <Dialog open={Boolean(record)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>
              {isSale ? "Sale receipt" : "Purchase invoice"} · {number}
            </span>
            {isSale && rec["status"] ? (
              <Badge variant="outline" className="shrink-0 capitalize">
                {String(rec["status"])}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Parties / meta */}
          <div className="rounded-lg border p-3">
            <Row label="Date & time" value={formatDateTime(rec["createdAt"] ?? rec["createAt"])} />
            <Row label="Shop" value={refName(rec["shopId"])} />
            <Row label="Attendant" value={refName(rec["attendantId"], "username")} />
            {isSale ? (
              <Row label="Customer" value={refName(rec["customerId"])} />
            ) : (
              <Row label="Supplier" value={refName(rec["supplierId"])} />
            )}
            <Row
              label="Payment type"
              value={
                <span className="capitalize">
                  {(rec["paymentType"] as string) || (rec["paymentTag"] as string) || "—"}
                </span>
              }
            />
          </div>

          {/* Line items */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Items ({items.length})</h4>
            {items.length ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Unit</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKes(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKes(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                No line items recorded.
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-lg border p-3">
            {items.length ? <Row label="Items subtotal" value={formatKes(itemsSubtotal)} /> : null}
            {discount > 0 ? <Row label="Discount" value={`- ${formatKes(discount)}`} /> : null}
            {tax > 0 ? <Row label="Tax" value={formatKes(tax)} /> : null}
            <div className="my-2 border-t" />
            <Row label="Total" value={<span className="text-base font-bold">{formatKes(total)}</span>} />
            <Row label="Amount paid" value={formatKes(amountPaid)} />
            {balance > 0 ? (
              <Row
                label="Outstanding balance"
                value={<span className="font-semibold text-destructive">{formatKes(balance)}</span>}
              />
            ) : null}
          </div>

          {/* Payments breakdown */}
          {payments.length ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Payments ({payments.length})</h4>
              <div className="space-y-1">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatDateTime(p.date)}
                      {p.paymentNo ? ` · ${p.paymentNo}` : ""}
                    </span>
                    <span className="font-medium tabular-nums">{formatKes(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {note ? (
            <div>
              <h4 className="mb-1 text-sm font-semibold">Note</h4>
              <p className="text-sm text-muted-foreground">{note}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
