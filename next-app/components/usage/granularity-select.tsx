"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/i18n-context";

export type Granularity = "day" | "hour" | "minute" | "second";

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function allowedGranularities(from?: string | null, to?: string | null): Granularity[] {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return ["day", "hour", "minute"];

  const diffHours = Math.max(0, (end.getTime() - start.getTime()) / 36e5);

  if (diffHours > 24 * 30) return ["day"]; // > 30 days
  if (diffHours > 24 * 7) return ["day", "hour"]; // 7-30 days
  if (diffHours > 24) return ["day", "hour"]; // 1-7 days
  if (diffHours > 1) return ["hour", "minute", "day"]; // 1-24 hours
  return ["minute", "second", "hour", "day"]; // < 1 hour
}

export function GranularitySelect({
  from,
  to,
  value,
  onChange,
}: {
  from?: string | null;
  to?: string | null;
  value: Granularity;
  onChange: (val: Granularity) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const allowed = useMemo(() => allowedGranularities(from, to), [from, to]);
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);

  useEffect(() => {
    if (!allowedSet.has(value)) {
      onChange(allowed[0]);
      const next = new URLSearchParams(searchParams.toString());
      next.set("granularity", allowed[0]);
      const url = `${pathname}?${next.toString()}`;
      router.replace(url, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedSet, value]);

  const options: { value: Granularity; label: string }[] = [
    { value: "day", label: t("day") },
    { value: "hour", label: t("hour") },
    { value: "minute", label: t("minute") },
    { value: "second", label: t("second") },
  ];

  return (
    <div className="w-full sm:w-[140px]">
      <label className="sr-only">{t("granularity")}</label>
      <Select value={value} onValueChange={(val) => onChange(val as Granularity)}>
        <SelectTrigger className="h-9 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2">
          <SelectValue placeholder={t("granularity")} className="text-xs font-mono" />
        </SelectTrigger>
        <SelectContent align="end" className="w-44">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={!allowedSet.has(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
