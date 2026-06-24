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

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Nairobi",
})

/** Format a date value in EAT, e.g. 24 Jun 2026. Returns "—" when missing/invalid. */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  const d = new Date(value as string | number | Date)
  if (Number.isNaN(d.getTime())) return "—"
  return dateFormatter.format(d)
}
