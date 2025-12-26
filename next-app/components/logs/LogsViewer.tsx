"use client";

import { useMemo } from "react";

import { Loader2 } from "lucide-react";

import { useI18n } from "@/components/i18n-context";

type LogsViewerProps = {
  lines: string[];
  isLoading: boolean;
  isIncrementalLoading: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type Highlight = {
  start: number;
  end: number;
  className: string;
  priority: number;
};

type StatusBucket = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

const statusClassMap: Record<StatusBucket, string> = {
  "1xx": "text-sky-300",
  "2xx": "text-emerald-300",
  "3xx": "text-amber-300",
  "4xx": "text-orange-300",
  "5xx": "text-rose-400",
};

function detectHttpStatus(line: string) {
  const patterns = [
    /\|\s*([1-5]\d{2})\s*\|/,
    /\b([1-5]\d{2})\s*-/,
    /\b(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+\s+([1-5]\d{2})\b/,
    /\b(?:status|code|http)[:\s]+([1-5]\d{2})\b/i,
    /\b([1-5]\d{2})\s+(?:OK|Created|Accepted|No Content|Moved|Found|Bad Request|Unauthorized|Forbidden|Not Found|Method Not Allowed|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const code = parseInt(match[1], 10);
      if (Number.isNaN(code)) continue;
      if (code >= 500) return { code, bucket: "5xx" as const };
      if (code >= 400) return { code, bucket: "4xx" as const };
      if (code >= 300) return { code, bucket: "3xx" as const };
      if (code >= 200) return { code, bucket: "2xx" as const };
      if (code >= 100) return { code, bucket: "1xx" as const };
    }
  }
  return null;
}

function buildHighlights(line: string): Highlight[] {
  const highlights: Highlight[] = [];

  const statusInfo = detectHttpStatus(line);
  if (statusInfo) {
    const statusPattern = new RegExp(`\\b${statusInfo.code}\\b`);
    const match = statusPattern.exec(line);
    if (match) {
      highlights.push({
        start: match.index,
        end: match.index + match[0].length,
        className: statusClassMap[statusInfo.bucket],
        priority: 10,
      });
    }
  }

  const timestampPattern = /\d{4}[-/]\d{2}[-/]\d{2}[T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?|\[\d{2}:\d{2}:\d{2}\]/g;
  let match: RegExpExecArray | null;
  while ((match = timestampPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-amber-300/80", priority: 5 });
  }

  const bracketTimestampPattern = /\[\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\]/g;
  while ((match = bracketTimestampPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-amber-300/80", priority: 5 });
  }

  const levelPattern = /\[(ERROR|ERRO|ERR|FATAL|CRITICAL|CRIT|WARN|WARNING|INFO|DEBUG|TRACE|PANIC)\]/gi;
  while ((match = levelPattern.exec(line)) !== null) {
    const level = match[1].toUpperCase();
    let className = "text-sky-300";
    if (["ERROR", "ERRO", "ERR", "FATAL", "CRITICAL", "CRIT", "PANIC"].includes(level)) {
      className = "text-rose-400 bg-rose-500/10 px-1 rounded";
    } else if (["WARN", "WARNING"].includes(level)) {
      className = "text-amber-300";
    } else if (level === "INFO") {
      className = "text-sky-300";
    } else if (["DEBUG", "TRACE"].includes(level)) {
      className = "text-slate-400";
    }
    highlights.push({ start: match.index, end: match.index + match[0].length, className, priority: 8 });
  }

  const methodPattern = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\b/g;
  while ((match = methodPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-emerald-300", priority: 6 });
  }

  const urlPattern = /(https?:\/\/[^\s<>"]+)/g;
  while ((match = urlPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-indigo-300 underline decoration-dotted", priority: 4 });
  }

  const ipPattern = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
  while ((match = ipPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-fuchsia-300", priority: 7 });
  }

  const successPattern = /\b(success|successful|succeeded|completed|ok|done|passed)\b/gi;
  while ((match = successPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-emerald-300 font-semibold", priority: 3 });
  }

  const errorPattern = /\b(failed|failure|error|exception|panic|fatal|critical|aborted|denied|refused|timeout|invalid)\b/gi;
  while ((match = errorPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-rose-400 font-semibold", priority: 3 });
  }

  const headersPattern = /\b(x-[a-z0-9-]+|authorization|content-type|user-agent)\b/gi;
  while ((match = headersPattern.exec(line)) !== null) {
    highlights.push({ start: match.index, end: match.index + match[0].length, className: "text-slate-300", priority: 2 });
  }

  highlights.sort((a, b) => {
    if (a.start === b.start) {
      return b.priority - a.priority;
    }
    return a.start - b.start;
  });

  return highlights;
}

function renderLine(line: string) {
  const processedLine = line.replace(/\[GIN\]\s+\d{4}\/\d{2}\/\d{2}\s+-\s+\d{2}:\d{2}:\d{2}\s+/g, "");
  const highlights = buildHighlights(processedLine);

  if (highlights.length === 0) {
    return processedLine;
  }

  let cursor = 0;
  const segments: React.ReactNode[] = [];

  highlights.forEach((highlight, index) => {
    if (highlight.start < cursor) return;
    const before = processedLine.slice(cursor, highlight.start);
    if (before) segments.push(before);
    const content = processedLine.slice(highlight.start, highlight.end);
    segments.push(
      <span key={`h-${index}`} className={highlight.className}>
        {content}
      </span>,
    );
    cursor = highlight.end;
  });

  const tail = processedLine.slice(cursor);
  if (tail) segments.push(tail);

  return segments;
}

export function LogsViewer({ lines, isLoading, isIncrementalLoading, containerRef }: LogsViewerProps) {
  const { t } = useI18n();
  const content = useMemo(() => {
    return lines.map((line, index) => (
      <div key={`${index}-${line}`} className="whitespace-pre text-xs leading-relaxed text-slate-100">
        {renderLine(line)}
      </div>
    ));
  }, [lines]);

  return (
    <div className="relative mt-2 h-[calc(100vh-260px)] min-h-[320px] overflow-auto rounded-lg bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-3 font-mono shadow-[0_0_0_1px_rgba(148,163,184,0.15)]" ref={containerRef}>
      {isLoading ? (
        <div className="flex h-full flex-col gap-2 animate-pulse text-slate-500">
          <div className="h-3 w-3/4 rounded bg-slate-800" />
          <div className="h-3 w-5/6 rounded bg-slate-800" />
          <div className="h-3 w-2/3 rounded bg-slate-800" />
          <div className="h-3 w-4/5 rounded bg-slate-800" />
        </div>
      ) : (
        content
      )}

      {isIncrementalLoading ? (
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200 shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("logs.updating")}
        </div>
      ) : null}
    </div>
  );
}
