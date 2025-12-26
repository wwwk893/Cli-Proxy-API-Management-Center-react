'use client';

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-context";

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams.toString());
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  });
  return next.toString();
}

export function UsageFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [from, setFrom] = useState(() => searchParams.get("from") ?? "");
  const [to, setTo] = useState(() => searchParams.get("to") ?? "");
  const [model, setModel] = useState(() => searchParams.get("model") ?? "");
  const [apiPath, setApiPath] = useState(() => searchParams.get("apiPath") ?? "");

  const setParams = (updates: Record<string, string | null>) => {
    const query = buildQuery(searchParams, updates);
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url);
  };

  const filtersSummary = useMemo(
    () =>
      [
        from && `From ${from}`,
        to && `To ${to}`,
        model && `Model ${model}`,
        apiPath && `API ${apiPath}`,
      ]
        .filter(Boolean)
        .join(" · "),
    [from, to, model, apiPath],
  );

  const apply = () =>
    setParams({
      from: from || null,
      to: to || null,
      model: model || null,
      apiPath: apiPath || null,
    });

  const reset = () => {
    setFrom("");
    setTo("");
    setModel("");
    setApiPath("");
    setParams({ from: null, to: null, model: null, apiPath: null });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px]">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            {t("from")}
          </label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            {t("to")}
          </label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="model" className="text-xs text-muted-foreground">
            {t("model")}
          </label>
          <Input
            id="model"
            placeholder="e.g. gpt-4o-mini"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="apiPath" className="text-xs text-muted-foreground">
            {t("apiPath")}
          </label>
          <Input
            id="apiPath"
            placeholder="/v1/chat/completions"
            value={apiPath}
            onChange={(e) => setApiPath(e.target.value)}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <Button
            onClick={apply}
            className="bg-white text-black hover:bg-white/90 font-semibold"
          >
            {t("apply")}
          </Button>
          <Button variant="ghost" onClick={reset} className="text-muted-foreground">
            {t("reset")}
          </Button>
          <Button variant="ghost" size="icon" onClick={apply} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {filtersSummary ? `${t("filters")} · ${filtersSummary}` : t("filtersNone")}
      </p>
    </div>
  );
}
