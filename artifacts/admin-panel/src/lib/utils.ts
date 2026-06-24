import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
})

/** Format a number as Kenyan Shillings, e.g. KES 31,500. */
export function formatKes(value: unknown): string {
  const n = Number(value)
  return kesFormatter.format(Number.isFinite(n) ? n : 0)
}

/** Thousands-separated number formatting, e.g. 1,918. */
const compactNumber = new Intl.NumberFormat("en-KE", { notation: "standard" })
export function formatNumber(value: unknown): string {
  const n = Number(value)
  return compactNumber.format(Number.isFinite(n) ? n : 0)
}
