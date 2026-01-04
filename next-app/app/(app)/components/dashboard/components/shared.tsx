import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyModule({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>
          <span>{"→"}</span>
        </Link>
      </Button>
    </div>
  );
}

type StatusBannerVariant = "error" | "warning" | "info";

function variantAccent(variant: StatusBannerVariant): string {
  switch (variant) {
    case "error":
      return "var(--destructive)";
    case "warning":
      return "var(--chart-3)";
    case "info":
      return "var(--chart-1)";
  }
}

function variantIcon(variant: StatusBannerVariant) {
  switch (variant) {
    case "error":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
  }
}

export function StatusBanner({
  title,
  description,
  actionHref,
  actionLabel,
  variant,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  variant: StatusBannerVariant;
}) {
  const accent = variantAccent(variant);
  const Icon = variantIcon(variant);

  return (
    <div
      style={{
        borderLeftColor: accent,
        backgroundColor: `color-mix(in oklab, ${accent} 10%, transparent)`,
      }}
      className="flex flex-col gap-2 rounded-lg border border-l-4 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4" style={{ color: accent }} />
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
