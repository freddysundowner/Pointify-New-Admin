import { Link, useSearch } from "wouter";
import { ArrowLeft, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shop-scoped pages (products, sales, purchases, subscriptions, attendants) are
 * the global list pages reused with a `?shop=<id>&shopName=<name>` query set by
 * the Shops table row actions. An optional `from` carries the originating Shops
 * URL (including its page/filters) so we can return the user exactly where they
 * left off.
 */
export function useShopFilter(): {
  shopId?: string;
  shopName?: string;
  from?: string;
} {
  const search = useSearch();
  const params = new URLSearchParams(search);
  return {
    shopId: params.get("shop") || undefined,
    shopName: params.get("shopName") || undefined,
    from: params.get("from") || undefined,
  };
}

/** Build a link to a domain list page scoped to a single shop. */
export function shopScopedHref(
  base: string,
  shop: { _id: string; name?: string | null },
  from?: string,
): string {
  const params = new URLSearchParams({ shop: shop._id });
  if (shop.name) params.set("shopName", shop.name);
  if (from) params.set("from", from);
  return `${base}?${params.toString()}`;
}

/** Banner shown on a list page when it is filtered to a single shop. */
export function ShopFilterBanner({
  shopName,
  backHref,
}: {
  shopName?: string;
  backHref?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Store className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">
          Showing records for shop:{" "}
          <span className="font-semibold">{shopName || "Selected shop"}</span>
        </span>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={backHref || "/shops"}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Shops
        </Link>
      </Button>
    </div>
  );
}
