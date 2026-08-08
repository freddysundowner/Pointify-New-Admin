/**
 * POST /api/leads/analyze
 *
 * Admin-only SSE endpoint. Fetches all leads matching the supplied filter
 * params, aggregates the data, and streams an AI analysis (pipeline health +
 * pattern insights) via Server-Sent Events.
 *
 * Each SSE event is: `data: {"chunk":"...markdown text..."}\n\n`
 * On completion:    `data: {"done":true}\n\n`
 * On error:         `data: {"error":"..."}\n\n`
 */

import { Router } from "express";
import OpenAI from "openai";
import {
  upstreamFetch,
  authHeaderFrom,
  normalizeList,
} from "../lib/upstream";

const router = Router();

// ---------------------------------------------------------------------------
// OpenAI key resolution
// Priority: upstream settings AI_CONFIG.OPENAI_API_KEY → env var OPENAI_API_KEY
// ---------------------------------------------------------------------------
async function resolveOpenAIKey(authHeader: string | undefined): Promise<string> {
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/settings/",
      authHeader,
    });
    if (result.status < 400) {
      const settings = (result.data ?? {}) as Record<string, unknown>;
      const aiCfg = settings["AI_CONFIG"];
      if (aiCfg && typeof aiCfg === "object") {
        const key = (aiCfg as Record<string, unknown>)["OPENAI_API_KEY"];
        if (typeof key === "string" && key.trim()) return key.trim();
      }
    }
  } catch {
    // fall through to env var
  }
  const envKey = process.env["OPENAI_API_KEY"]?.trim();
  if (envKey) return envKey;
  throw new Error(
    "No OpenAI API key configured. Add one in Settings → AI Integration, or set the OPENAI_API_KEY environment variable.",
  );
}

function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// Re-use the same auth helpers as the other leads routes.
function requireBearer(req: any, res: any): boolean {
  const auth = authHeaderFrom(req);
  if (!auth || !/^Bearer\s+\S+/.test(auth)) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }
  return true;
}

function adminIdFromAuth(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) return undefined;
  const segments = match[1].split(".");
  if (segments.length < 2) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as { _id?: unknown; id?: unknown };
    const id = payload._id ?? payload.id;
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)
      ? id
      : undefined;
  } catch {
    return undefined;
  }
}

function leadsProxyHeaders(): Record<string, string> | undefined {
  const secret = process.env.LEADS_PROXY_SECRET;
  return secret ? { "x-proxy-secret": secret } : undefined;
}

// ---------------------------------------------------------------------------
// Data aggregation helpers
// ---------------------------------------------------------------------------
type LeadRow = Record<string, unknown>;

function affiliateName(row: LeadRow): string {
  const aff = row["affiliate"];
  if (aff && typeof aff === "object") {
    return String((aff as Record<string, unknown>)["name"] ?? "") || "unknown";
  }
  return "unknown";
}

function isOverdue(row: LeadRow): boolean {
  const raw = row["nextFollowUpDate"];
  if (!raw) return false;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return false;
  // EAT UTC+3 calendar comparison
  const eatOffset = 3 * 60 * 60_000;
  const followUpDay = Math.floor((d.getTime() + eatOffset) / 86_400_000);
  const todayDay = Math.floor((Date.now() + eatOffset) / 86_400_000);
  return followUpDay < todayDay;
}

interface AggregatedData {
  totalLeads: number;
  byStage: Record<string, number>;
  overdueCount: number;
  noFollowUp: number;
  topBusinessTypes: Array<{ name: string; count: number }>;
  topLocations: Array<{ name: string; count: number }>;
  partnerStats: Array<{
    name: string;
    total: number;
    won: number;
    lost: number;
    conversionRate: string;
  }>;
  sourceBreakdown: Record<string, number>;
}

function aggregateLeads(leads: LeadRow[]): AggregatedData {
  const byStage: Record<string, number> = {};
  const businessTypes: Record<string, number> = {};
  const locations: Record<string, number> = {};
  const sources: Record<string, number> = {};
  const partnerMap: Record<
    string,
    { total: number; won: number; lost: number }
  > = {};

  let overdueCount = 0;
  let noFollowUp = 0;

  for (const lead of leads) {
    // Stage
    const stage = String(lead["stage"] ?? "New Lead");
    byStage[stage] = (byStage[stage] ?? 0) + 1;

    // Follow-up status
    if (!lead["nextFollowUpDate"]) noFollowUp++;
    else if (isOverdue(lead)) overdueCount++;

    // Business type
    const bt = String(lead["businessType"] ?? "").trim();
    if (bt) businessTypes[bt] = (businessTypes[bt] ?? 0) + 1;

    // Location
    const loc = String(lead["location"] ?? "").trim();
    if (loc) locations[loc] = (locations[loc] ?? 0) + 1;

    // Source
    const src = String(lead["source"] ?? "").trim();
    if (src) sources[src] = (sources[src] ?? 0) + 1;

    // Partner
    const pName = affiliateName(lead);
    if (!partnerMap[pName]) partnerMap[pName] = { total: 0, won: 0, lost: 0 };
    partnerMap[pName].total++;
    if (stage === "Won (Converted)") partnerMap[pName].won++;
    if (stage === "Lost") partnerMap[pName].lost++;
  }

  const topN = <T extends { count: number }>(arr: T[], n = 8) =>
    arr.sort((a, b) => b.count - a.count).slice(0, n);

  const partnerStats = Object.entries(partnerMap)
    .map(([name, s]) => ({
      name,
      total: s.total,
      won: s.won,
      lost: s.lost,
      conversionRate:
        s.total > 0 ? ((s.won / s.total) * 100).toFixed(1) + "%" : "0%",
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalLeads: leads.length,
    byStage,
    overdueCount,
    noFollowUp,
    topBusinessTypes: topN(
      Object.entries(businessTypes).map(([name, count]) => ({ name, count })),
    ),
    topLocations: topN(
      Object.entries(locations).map(([name, count]) => ({ name, count })),
    ),
    partnerStats,
    sourceBreakdown: sources,
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
router.post("/leads/analyze", async (req, res) => {
  if (!requireBearer(req, res)) return;
  if (!adminIdFromAuth(authHeaderFrom(req))) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (payload: Record<string, unknown>) =>
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    // 1. Resolve affiliate scope (all partners, or one if partnerId supplied)
    const q = (req.body ?? {}) as Record<string, unknown>;
    const partnerId = typeof q["partnerId"] === "string" ? q["partnerId"].trim() : "";

    let affiliate = partnerId;
    if (!affiliate) {
      const partners = await upstreamFetch({
        method: "GET",
        path: "/affiliates/",
        authHeader: authHeaderFrom(req),
      });
      if (partners.status >= 400) {
        send({ error: "Could not fetch partner list from upstream" });
        res.end();
        return;
      }
      const ids = normalizeList(partners.data)
        .data.map((p) =>
          p && typeof p === "object"
            ? String((p as Record<string, unknown>)["_id"] ?? "")
            : "",
        )
        .filter((id) => id !== "");
      if (ids.length === 0) {
        send({ error: "No partners found — nothing to analyze" });
        res.end();
        return;
      }
      affiliate = ids.join(",");
    }

    // 2. Fetch up to 500 leads (10 pages × 50) for analysis
    const allLeads: LeadRow[] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await upstreamFetch({
        method: "GET",
        path: "/leads",
        query: {
          affiliate,
          page,
          limit: 50,
          ...(q["stage"] ? { stage: q["stage"] } : {}),
          ...(q["search"] ? { search: q["search"] } : {}),
        },
        authHeader: authHeaderFrom(req),
        headers: leadsProxyHeaders(),
      });
      if (result.status >= 400) break;
      const norm = normalizeList(result.data);
      allLeads.push(...(norm.data as LeadRow[]));
      if (page >= norm.totalPages) break;
    }

    if (allLeads.length === 0) {
      send({ error: "No leads found matching the current filters" });
      res.end();
      return;
    }

    // 3. Aggregate
    const data = aggregateLeads(allLeads);
    send({ status: `Analyzing ${data.totalLeads} leads…` });

    // 4. Build prompt
    const prompt = buildPrompt(data);

    // 5. Stream OpenAI response
    const apiKey = await resolveOpenAIKey(authHeaderFrom(req));
    const openai = getOpenAIClient(apiKey);
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are a sales pipeline analyst for Pointify POS, a point-of-sale platform in Kenya. " +
            "You analyze partner leads data and provide concise, actionable insights. " +
            "Write in clear, direct language. Use markdown formatting with ## headings and bullet points. " +
            "Focus on what is actionable, not just descriptive.",
        },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) send({ chunk: content });
    }

    send({ done: true });
    res.end();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Analysis failed — please try again";
    send({ error: message });
    res.end();
  }
});

function buildPrompt(data: AggregatedData): string {
  const stageLines = Object.entries(data.byStage)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => `  - ${stage}: ${count}`)
    .join("\n");

  const bizLines = data.topBusinessTypes
    .map((b) => `  - ${b.name}: ${b.count}`)
    .join("\n");

  const locLines = data.topLocations
    .map((l) => `  - ${l.name}: ${l.count}`)
    .join("\n");

  const partnerLines = data.partnerStats
    .map(
      (p) =>
        `  - ${p.name}: ${p.total} leads, ${p.won} won, ${p.lost} lost (${p.conversionRate} conversion)`,
    )
    .join("\n");

  const sourceLines = Object.entries(data.sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([src, count]) => `  - ${src}: ${count}`)
    .join("\n");

  return `Analyze the following Pointify partner leads pipeline data and provide:
1. A concise pipeline health assessment (2-3 sentences)
2. Key insights about stage distribution and bottlenecks
3. Pattern analysis: which business types, locations, and partners perform best
4. 3-5 specific, prioritized action recommendations

## Data Summary
Total leads: ${data.totalLeads}
Overdue follow-ups: ${data.overdueCount}
Leads with no follow-up date set: ${data.noFollowUp}

### Stage Breakdown
${stageLines || "  (none)"}

### Top Business Types
${bizLines || "  (no data)"}

### Top Locations
${locLines || "  (no data)"}

### Partner Performance
${partnerLines || "  (no data)"}

### Lead Sources
${sourceLines || "  (no data)"}

Be specific and reference the actual numbers from the data above.`;
}

export default router;
