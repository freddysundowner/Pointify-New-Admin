export function formatKES(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "KES 0.00";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
}
