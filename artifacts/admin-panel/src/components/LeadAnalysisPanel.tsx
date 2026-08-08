/**
 * LeadAnalysisPanel
 *
 * Displays an AI-generated pipeline analysis streamed from POST /api/leads/analyze.
 * Renders the streamed markdown as formatted text. Opened from the Leads page.
 */
import { useState, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RotateCcw, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Minimal markdown → JSX renderer (headings, bullets, bold, paragraphs)
// ---------------------------------------------------------------------------
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={i} className="mt-5 mb-2 text-base font-semibold text-foreground first:mt-0">
          {line.slice(3)}
        </h2>,
      );
      i++;
      continue;
    }
    // H3
    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={i} className="mt-4 mb-1.5 text-sm font-semibold text-foreground">
          {line.slice(4)}
        </h3>,
      );
      i++;
      continue;
    }
    // Bullet
    if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(
        <li key={i} className="ml-4 list-disc text-sm text-foreground leading-relaxed">
          {inlineMarkdown(line.slice(2))}
        </li>,
      );
      i++;
      continue;
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      nodes.push(
        <li key={i} className="ml-4 list-decimal text-sm text-foreground leading-relaxed">
          {inlineMarkdown(line.replace(/^\d+\.\s/, ""))}
        </li>,
      );
      i++;
      continue;
    }
    // Empty line — paragraph break
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }
    // Plain paragraph
    nodes.push(
      <p key={i} className="text-sm text-foreground leading-relaxed">
        {inlineMarkdown(line)}
      </p>,
    );
    i++;
  }
  return nodes;
}

/** Bold (**text**) and inline code (`code`) */
function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3])
      parts.push(
        <code key={m.index} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
          {m[3]}
        </code>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export interface AnalysisFilters {
  partnerId?: string;
  stage?: string;
  search?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AnalysisFilters;
  /** Human-readable description of active filters for the header */
  filterLabel?: string;
}

type Status = "idle" | "loading" | "streaming" | "done" | "error";

export default function LeadAnalysisPanel({
  open,
  onOpenChange,
  filters,
  filterLabel,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus("loading");
    setStatusMsg("Fetching leads…");
    setMarkdown("");
    setError("");

    try {
      const token = localStorage.getItem("pointify_token");
      const res = await fetch("/api/leads/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
          ...(filters.stage ? { stage: filters.stage } : {}),
          ...(filters.search ? { search: filters.search } : {}),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setStatus("streaming");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              chunk?: string;
              status?: string;
              done?: boolean;
              error?: string;
            };
            if (payload.status) setStatusMsg(payload.status);
            if (payload.chunk) setMarkdown((m) => m + payload.chunk);
            if (payload.done) {
              setStatus("done");
            }
            if (payload.error) {
              setError(payload.error);
              setStatus("error");
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      if (status !== "error") setStatus("done");
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Analysis failed — please try again",
      );
      setStatus("error");
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run when the sheet opens (or filters change while open)
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    prevOpenRef.current = true;
    // Defer to avoid setState-during-render
    setTimeout(runAnalysis, 0);
  }
  if (!open) prevOpenRef.current = false;

  const isRunning = status === "loading" || status === "streaming";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Pipeline Analysis
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {filterLabel
              ? `Filtered: ${filterLabel}`
              : "All leads across all partners"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-6 py-5">
          {/* Status / loading */}
          {isRunning && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusMsg || "Analyzing…"}
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Streamed markdown */}
          {markdown && (
            <div className="prose-sm max-w-none">
              {renderMarkdown(markdown)}
              {isRunning && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-text-bottom" />
              )}
            </div>
          )}

          {/* Idle (shouldn't normally show, but just in case) */}
          {status === "idle" && !markdown && (
            <p className="text-sm text-muted-foreground">
              Starting analysis…
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={runAnalysis}
            disabled={isRunning}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Re-run
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
