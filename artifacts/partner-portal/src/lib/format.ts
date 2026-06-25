export function formatKES(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "KES 0.00";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
}

export type ShopSubStatus = "active" | "expiring" | "expired" | "unpaid" | "none";

export interface ShopSubInfo {
  status: ShopSubStatus;
  label: string;
  /** Short helper line, e.g. "Expires in 3 days" or "Expired Jul 16, 2026". */
  detail: string;
  endDate: Date | null;
  packageName: string | null;
  daysLeft: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const EXPIRING_SOON_DAYS = 7;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Derive a shop's subscription status from its embedded `subscription` document.
 *
 * A subscription is only "active" when it is BOTH paid AND its endDate is still
 * in the future (mirrors the upstream subscription-status semantics: the `status`
 * boolean is not authoritative — paid:true + endDate is). Paid subscriptions
 * within 7 days of expiry are flagged "expiring" so partners can nudge the shop.
 */
export function getShopSubscription(shop: any): ShopSubInfo {
  const sub = shop?.subscription;
  const pkg = sub?.packageId;
  const packageName =
    (pkg && typeof pkg === "object" ? pkg.newTitle || pkg.title : null) ?? null;

  if (!sub || typeof sub !== "object") {
    return {
      status: "none",
      label: "No subscription",
      detail: "Never subscribed",
      endDate: null,
      packageName: null,
      daysLeft: null,
    };
  }

  const endDate = sub.endDate ? new Date(sub.endDate) : null;
  const validEnd = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;

  if (sub.paid !== true) {
    return {
      status: "unpaid",
      label: "Unpaid",
      detail: "Awaiting payment",
      endDate: validEnd,
      packageName,
      daysLeft: null,
    };
  }

  // Paid but with no usable expiry date. Real upstream subscriptions always
  // carry an endDate, so this only happens on malformed/partial data. Surface it
  // as "expiring" (amber, needs attention) with an explicit note rather than a
  // confident green "Active" — the contract reserves Active for paid + a valid
  // future endDate, and we must not give partners false confidence.
  if (!validEnd) {
    return {
      status: "expiring",
      label: "Check status",
      detail: "Paid, but no expiry date on record",
      endDate: null,
      packageName,
      daysLeft: null,
    };
  }

  const now = Date.now();
  const daysLeft = Math.ceil((validEnd.getTime() - now) / MS_PER_DAY);

  if (validEnd.getTime() <= now) {
    return {
      status: "expired",
      label: "Expired",
      detail: `Expired ${formatDate(validEnd)}`,
      endDate: validEnd,
      packageName,
      daysLeft,
    };
  }

  if (daysLeft <= EXPIRING_SOON_DAYS) {
    return {
      status: "expiring",
      label: "Expiring soon",
      detail: daysLeft <= 1 ? "Expires today" : `Expires in ${daysLeft} days`,
      endDate: validEnd,
      packageName,
      daysLeft,
    };
  }

  return {
    status: "active",
    label: "Active",
    detail: `Expires ${formatDate(validEnd)}`,
    endDate: validEnd,
    packageName,
    daysLeft,
  };
}
