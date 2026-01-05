import { describe, it, expect } from "vitest";

import { buildFiltersHash, buildUsageEventWhere, normalizeAggregationFilters } from "@/lib/usage/aggregation-filters";

describe("Aggregation filters", () => {
  it("normalizes models and removes full channel selection", () => {
    const result = normalizeAggregationFilters({
      models: [" gpt-4 ", "gpt-3.5", "gpt-4"],
      channels: ["codex", "cliproxy", "opencode"],
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

  it("builds UsageEvent where clause for channels", () => {
    expect(buildUsageEventWhere({ channels: ["codex"] })).toEqual({
      sourceType: "codex",
    });

    expect(buildUsageEventWhere({ channels: ["cliproxy"] })).toEqual({
      sourceType: "cliproxy",
    });

    expect(buildUsageEventWhere({ channels: ["opencode"] })).toEqual({
      sourceType: "opencode",
    });
  });
});
