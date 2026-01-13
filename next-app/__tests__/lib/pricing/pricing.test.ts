import { describe, it, expect } from "vitest";
import { calcCostUsd, DEFAULT_PRICING, type PricingMap } from "@/lib/pricing";

describe("pricing", () => {
  describe("calcCostUsd", () => {
    it("should return 0 for unknown model", () => {
      const result = calcCostUsd({
        model: "unknown-model",
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(result).toBe(0);
    });

    it("should calculate cost for gpt-4.1-mini with input and output tokens", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      // inputPerMillion: 0.15, outputPerMillion: 0.6
      // 1M input * 0.15 + 1M output * 0.6 = 0.15 + 0.6 = 0.75
      expect(result).toBe(0.75);
    });

    it("should calculate cost for gpt-4.1 with input and output tokens", () => {
      const result = calcCostUsd({
        model: "gpt-4.1",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      // inputPerMillion: 5.0, outputPerMillion: 15.0
      // 1M input * 5.0 + 1M output * 15.0 = 5.0 + 15.0 = 20.0
      expect(result).toBe(20);
    });

    it("should include reasoning tokens in output cost", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 0,
        outputTokens: 500_000,
        reasoningTokens: 500_000,
      });
      // outputPerMillion: 0.6
      // (500k + 500k) output * 0.6 / 1M = 0.6
      expect(result).toBe(0.6);
    });

    it("should include cached tokens in cost calculation", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 1_000_000,
      });
      // cachedPerMillion: 0.075
      // 1M cached * 0.075 = 0.075
      expect(result).toBe(0.075);
    });

    it("should calculate combined cost with all token types", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        reasoningTokens: 500_000,
        cachedTokens: 1_000_000,
      });
      // input: 1M * 0.15 = 0.15
      // output: (500k + 500k) * 0.6 / 1M = 0.6
      // cached: 1M * 0.075 = 0.075
      // total: 0.15 + 0.6 + 0.075 = 0.825
      expect(result).toBe(0.825);
    });

    it("should use custom pricing map when provided", () => {
      const customPricing: PricingMap = {
        "custom-model": {
          inputPerMillion: 1.0,
          outputPerMillion: 2.0,
          cachedPerMillion: 0.5,
        },
      };

      const result = calcCostUsd({
        model: "custom-model",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        pricingMap: customPricing,
      });
      // 1M * 1.0 + 1M * 2.0 = 3.0
      expect(result).toBe(3);
    });

    it("should handle zero tokens", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 0,
        outputTokens: 0,
      });
      expect(result).toBe(0);
    });

    it("should handle small token counts with precision", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 100,
        outputTokens: 100,
      });
      // input: 100 * 0.15 / 1M = 0.000015
      // output: 100 * 0.6 / 1M = 0.00006
      // total: 0.000075
      expect(result).toBe(0.000075);
    });

    it("should round result to 6 decimal places", () => {
      const result = calcCostUsd({
        model: "gpt-4.1-mini",
        inputTokens: 1,
        outputTokens: 1,
      });
      // Very small values should be rounded properly
      expect(typeof result).toBe("number");
      expect(result.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(6);
    });
  });

  describe("DEFAULT_PRICING", () => {
    it("should have pricing for gpt-4.1-mini", () => {
      expect(DEFAULT_PRICING["gpt-4.1-mini"]).toBeDefined();
      expect(DEFAULT_PRICING["gpt-4.1-mini"].inputPerMillion).toBe(0.15);
      expect(DEFAULT_PRICING["gpt-4.1-mini"].outputPerMillion).toBe(0.6);
      expect(DEFAULT_PRICING["gpt-4.1-mini"].cachedPerMillion).toBe(0.075);
    });

    it("should have pricing for gpt-4.1", () => {
      expect(DEFAULT_PRICING["gpt-4.1"]).toBeDefined();
      expect(DEFAULT_PRICING["gpt-4.1"].inputPerMillion).toBe(5.0);
      expect(DEFAULT_PRICING["gpt-4.1"].outputPerMillion).toBe(15.0);
      expect(DEFAULT_PRICING["gpt-4.1"].cachedPerMillion).toBe(2.5);
    });

    it("should have pricing for gpt-4o-mini", () => {
      expect(DEFAULT_PRICING["gpt-4o-mini"]).toBeDefined();
      expect(DEFAULT_PRICING["gpt-4o-mini"].inputPerMillion).toBe(0.15);
      expect(DEFAULT_PRICING["gpt-4o-mini"].outputPerMillion).toBe(0.6);
      expect(DEFAULT_PRICING["gpt-4o-mini"].cachedPerMillion).toBe(0.075);
    });
  });
});
