import { describe, it, expect } from "vitest";
import { parseSearchParams, parseJsonBody, createErrorResponse } from "@/lib/api/validation";
import { z } from "zod";

describe("API Validation", () => {
  describe("createErrorResponse", () => {
    it("should create error response with message only", () => {
      const response = createErrorResponse("Test error", 400);
      expect(response.status).toBe(400);
    });

    it("should create error response with details", () => {
      const response = createErrorResponse("Validation failed", 400, {
        field1: ["error1", "error2"],
      });
      expect(response.status).toBe(400);
    });
  });

  describe("parseSearchParams", () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.coerce.number().optional(),
      tags: z.array(z.string()).optional().default([]),
    });

    it("should parse valid search params", () => {
      const params = new URLSearchParams();
      params.set("name", "John");
      params.set("age", "25");

      const result = parseSearchParams(params, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John");
        expect(result.data.age).toBe(25);
      }
    });

    it("should handle array params", () => {
      const params = new URLSearchParams();
      params.set("name", "John");
      params.append("tags", "tag1");
      params.append("tags", "tag2");

      const result = parseSearchParams(params, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["tag1", "tag2"]);
      }
    });

    it("should return error for invalid params", () => {
      const params = new URLSearchParams();
      // name is missing which is required

      const result = parseSearchParams(params, testSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(400);
      }
    });
  });

  describe("parseJsonBody", () => {
    const testSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    it("should parse valid JSON body", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "test", value: 42 }),
        headers: { "Content-Type": "application/json" },
      });

      const result = await parseJsonBody(request, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("test");
        expect(result.data.value).toBe(42);
      }
    });

    it("should return error for invalid JSON", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });

      const result = await parseJsonBody(request, testSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(400);
      }
    });

    it("should return error for schema validation failure", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "test", value: "not a number" }),
        headers: { "Content-Type": "application/json" },
      });

      const result = await parseJsonBody(request, testSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(400);
      }
    });
  });
});
