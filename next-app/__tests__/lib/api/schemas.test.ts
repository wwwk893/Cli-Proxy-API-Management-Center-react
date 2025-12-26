import { describe, it, expect } from "vitest";
import {
  usageQuerySchema,
  usageByModelQuerySchema,
  modelPricingCreateSchema,
  modelPricingDeleteSchema,
  usageIngestQuerySchema,
  granularitySchema,
  viewModeSchema,
  dimensionSchema,
} from "@/lib/api/schemas";

describe("API Schemas", () => {
  describe("granularitySchema", () => {
    it("should accept valid granularity values", () => {
      expect(granularitySchema.parse("day")).toBe("day");
      expect(granularitySchema.parse("hour")).toBe("hour");
      expect(granularitySchema.parse("minute")).toBe("minute");
      expect(granularitySchema.parse("second")).toBe("second");
    });

    it("should default to day", () => {
      expect(granularitySchema.parse(undefined)).toBe("day");
    });

    it("should reject invalid values", () => {
      expect(() => granularitySchema.parse("week")).toThrow();
      expect(() => granularitySchema.parse("invalid")).toThrow();
    });
  });

  describe("viewModeSchema", () => {
    it("should accept valid view modes", () => {
      expect(viewModeSchema.parse("aggregate")).toBe("aggregate");
      expect(viewModeSchema.parse("per-model")).toBe("per-model");
      expect(viewModeSchema.parse("source")).toBe("source");
      expect(viewModeSchema.parse("source-model")).toBe("source-model");
    });

    it("should default to aggregate", () => {
      expect(viewModeSchema.parse(undefined)).toBe("aggregate");
    });

    it("should reject invalid values", () => {
      expect(() => viewModeSchema.parse("invalid")).toThrow();
    });
  });

  describe("dimensionSchema", () => {
    it("should accept valid dimensions", () => {
      expect(dimensionSchema.parse("model")).toBe("model");
      expect(dimensionSchema.parse("source")).toBe("source");
      expect(dimensionSchema.parse("model+source")).toBe("model+source");
      expect(dimensionSchema.parse("overall")).toBe("overall");
    });

    it("should default to model", () => {
      expect(dimensionSchema.parse(undefined)).toBe("model");
    });
  });

  describe("usageQuerySchema", () => {
    it("should parse valid query with all fields", () => {
      const result = usageQuerySchema.parse({
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-31T23:59:59.999Z",
        model: ["gpt-4", "claude-3"],
        apiPath: "/v1/chat/completions",
        granularity: "hour",
        view: "per-model",
        sources: ["cli", "web"],
        groupBySource: true,
        dimension: "source",
      });

      expect(result.from).toBe("2024-01-01T00:00:00.000Z");
      expect(result.to).toBe("2024-01-31T23:59:59.999Z");
      expect(result.model).toEqual(["gpt-4", "claude-3"]);
      expect(result.apiPath).toBe("/v1/chat/completions");
      expect(result.granularity).toBe("hour");
      expect(result.view).toBe("per-model");
      expect(result.sources).toEqual(["cli", "web"]);
      expect(result.groupBySource).toBe(true);
      expect(result.dimension).toBe("source");
    });

    it("should use defaults for optional fields", () => {
      const result = usageQuerySchema.parse({});

      expect(result.granularity).toBe("day");
      expect(result.view).toBe("aggregate");
      expect(result.model).toEqual([]);
      expect(result.sources).toEqual([]);
      expect(result.groupBySource).toBe(false);
      expect(result.dimension).toBe("model");
    });

    it("should accept null for optional date fields", () => {
      const result = usageQuerySchema.parse({
        from: null,
        to: null,
      });

      expect(result.from).toBeNull();
      expect(result.to).toBeNull();
    });
  });

  describe("usageByModelQuerySchema", () => {
    it("should parse valid query", () => {
      const result = usageByModelQuerySchema.parse({
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-31T23:59:59.999Z",
        apiPath: "/v1/chat/completions",
        sources: ["cli"],
        groupBySource: true,
      });

      expect(result.from).toBe("2024-01-01T00:00:00.000Z");
      expect(result.to).toBe("2024-01-31T23:59:59.999Z");
      expect(result.apiPath).toBe("/v1/chat/completions");
      expect(result.sources).toEqual(["cli"]);
      expect(result.groupBySource).toBe(true);
    });

    it("should accept empty query", () => {
      const result = usageByModelQuerySchema.parse({});
      expect(result).toBeDefined();
    });
  });

  describe("modelPricingCreateSchema", () => {
    it("should parse valid pricing data", () => {
      const result = modelPricingCreateSchema.parse({
        modelId: "gpt-4",
        inputCost: 0.03,
        outputCost: 0.06,
        cachedCost: 0.015,
      });

      expect(result.modelId).toBe("gpt-4");
      expect(result.inputCost).toBe(0.03);
      expect(result.outputCost).toBe(0.06);
      expect(result.cachedCost).toBe(0.015);
    });

    it("should default cachedCost to 0", () => {
      const result = modelPricingCreateSchema.parse({
        modelId: "gpt-4",
        inputCost: 0.03,
        outputCost: 0.06,
      });

      expect(result.cachedCost).toBe(0);
    });

    it("should trim modelId", () => {
      const result = modelPricingCreateSchema.parse({
        modelId: "  gpt-4  ",
        inputCost: 0.03,
        outputCost: 0.06,
      });

      expect(result.modelId).toBe("gpt-4");
    });

    it("should reject empty modelId", () => {
      expect(() =>
        modelPricingCreateSchema.parse({
          modelId: "",
          inputCost: 0.03,
          outputCost: 0.06,
        })
      ).toThrow();
    });

    it("should reject negative costs", () => {
      expect(() =>
        modelPricingCreateSchema.parse({
          modelId: "gpt-4",
          inputCost: -0.03,
          outputCost: 0.06,
        })
      ).toThrow();
    });

    it("should coerce string numbers", () => {
      const result = modelPricingCreateSchema.parse({
        modelId: "gpt-4",
        inputCost: "0.03",
        outputCost: "0.06",
      });

      expect(result.inputCost).toBe(0.03);
      expect(result.outputCost).toBe(0.06);
    });
  });

  describe("modelPricingDeleteSchema", () => {
    it("should parse valid delete request", () => {
      const result = modelPricingDeleteSchema.parse({
        modelId: "gpt-4",
      });

      expect(result.modelId).toBe("gpt-4");
    });

    it("should reject empty modelId", () => {
      expect(() =>
        modelPricingDeleteSchema.parse({
          modelId: "",
        })
      ).toThrow();
    });
  });

  describe("usageIngestQuerySchema", () => {
    it("should parse valid ingest query", () => {
      const result = usageIngestQuerySchema.parse({
        since: "2024-01-01T00:00:00.000Z",
        max: "100",
        dryRun: "true",
      });

      expect(result.since).toBe("2024-01-01T00:00:00.000Z");
      expect(result.max).toBe(100);
      expect(result.dryRun).toBe(true);
    });

    it("should handle dryRun false", () => {
      const result = usageIngestQuerySchema.parse({
        dryRun: "false",
      });

      expect(result.dryRun).toBe(false);
    });

    it("should accept empty query", () => {
      const result = usageIngestQuerySchema.parse({});
      expect(result).toBeDefined();
    });
  });
});
