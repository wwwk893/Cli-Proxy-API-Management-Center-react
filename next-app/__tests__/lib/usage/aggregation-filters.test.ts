import { describe, it, expect } from "vitest";

import { CODEX_API_PATHS } from "@/lib/usage/aggregation-constants";
import { buildFiltersHash, buildUsageEventWhere, normalizeAggregationFilters } from "@/lib/usage/aggregation-filters";

describe("Aggregation filters", () => {
  it("normalizes models and removes full channel selection", () => {
    const result = normalizeAggregationFilters({
      models: [" gpt-4 ", "gpt-3.5", "gpt-4"],
      channels: ["codex", "cliproxy"],
    });

    expect(result).toEqual({ models: ["gpt-3.5", "gpt-4"] });
  });

  it("treats all models as undefined when allModels provided", () => {
    const result = normalizeAggregationFilters(
      { models: ["gpt-3.5", "gpt-4"] },
      { allModels: ["gpt-4", "gpt-3.5"] },
    );

    expect(result).toBeUndefined();
  });

  it("builds stable hash regardless of input order", () => {
    const { hash: first } = buildFiltersHash({ models: ["b", "a"], channels: ["codex"] });
    const { hash: second } = buildFiltersHash({ models: ["a", "b"], channels: ["codex"] });

    expect(first).toBe(second);
  });

  it("builds UsageEvent where clause for codex and cliproxy", () => {
    expect(buildUsageEventWhere({ channels: ["codex"] })).toEqual({
      apiPath: { in: [...CODEX_API_PATHS] },
    });

    expect(buildUsageEventWhere({ channels: ["cliproxy"] })).toEqual({
      NOT: { apiPath: { in: [...CODEX_API_PATHS] } },
    });
  });
});
