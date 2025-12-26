"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelOption } from "@/components/usage/filter-popover";

export function useUsageModels(initialModels: ModelOption[] = []) {
  const [models, setModels] = useState<ModelOption[]>(initialModels);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/models", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = (await res.json()) as { data?: ModelOption[] };
      setModels(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialModels.length) return;
    load();
  }, [initialModels.length, load]);

  return { models, loading, error, reload: load } as const;
}
