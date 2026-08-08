/**
 * Shared utilities for leads: stage styles, badges, date helpers, and field
 * extractors. Import from here instead of duplicating in leads.tsx /
 * LeadDetailDialog.tsx.
 */
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@workspace/api-client-react";

// Kept in sync with the partner portal pipeline and the upstream lead store.
export const STAGES = [
  "New Lead",
  "Contacted",
  "Interested",
  "Visit/Demo Scheduled",
  "Negotiating",
  "Won (Converted)",
  "Lost",
] as const;

export const STAGE_STYLES: Record<string, string> = {
  "New Lead": "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Contacted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Interested: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  "Visit/Demo Scheduled": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Negotiating: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  "Won (Converted)": "bg-green-100 text-green-700 hover:bg-green-100",
  Lost: "bg-red-100 text-red-700 hover:bg-red-100",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge
      variant="secondary"
      className={STAGE_STYLES[stage] ?? "bg-muted text-foreground"}
    >
      {stage}
    </Badge>
  );
}

export function fmtDate(raw: unknown): string {
  if (!raw) return "—";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(raw: unknown): string {
  if (!raw) return "";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Returns { id, name } of the affiliate that owns a lead.
 * `affiliate` may be a populated object or a bare id string.
 */
export function leadPartnerName(lead: Lead): { id: string; name: string } {
  const aff = (lead as Record<string, unknown>)["affiliate"];
  if (aff && typeof aff === "object") {
    const obj = aff as Record<string, unknown>;
    return {
      id: String(obj["_id"] ?? ""),
      name: String(obj["name"] ?? "") || "—",
    };
  }
  return { id: String(aff ?? ""), name: "—" };
}

/**
 * Classifies a follow-up date relative to today (EAT calendar day).
 *   "overdue"  — before today
 *   "today"    — same calendar day
 *   "upcoming" — in the future
 *   null       — no date set
 */
export function followUpStatus(
  raw: unknown,
): "overdue" | "today" | "upcoming" | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;

  // Compare using EAT (UTC+3) calendar days.
  const eatOffset = 3 * 60; // minutes
  const toEATDay = (dt: Date) => {
    const utc = dt.getTime() + dt.getTimezoneOffset() * 60_000;
    const eat = new Date(utc + eatOffset * 60_000);
    return new Date(eat.getFullYear(), eat.getMonth(), eat.getDate()).getTime();
  };

  const followUpDay = toEATDay(d);
  const todayDay = toEATDay(new Date());

  if (followUpDay < todayDay) return "overdue";
  if (followUpDay === todayDay) return "today";
  return "upcoming";
}
