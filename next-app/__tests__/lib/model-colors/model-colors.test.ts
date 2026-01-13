import { describe, it, expect } from "vitest";
import {
  getModelColor,
  getModelPalette,
  buildModelColorMap,
  resolveModelColor,
  toAlphaColor,
} from "@/lib/model-colors";

describe("model-colors", () => {
  describe("getModelColor", () => {
    it("should return a color from the palette for a valid model", () => {
      const color = getModelColor("gpt-4");
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should return consistent color for the same model", () => {
      const color1 = getModelColor("gpt-4");
      const color2 = getModelColor("gpt-4");
      expect(color1).toBe(color2);
    });

    it("should return different colors for different models", () => {
      const color1 = getModelColor("gpt-4");
      const color2 = getModelColor("claude-3");
      // They might be the same by chance, but usually different
      expect(typeof color1).toBe("string");
      expect(typeof color2).toBe("string");
    });

    it("should use indexHint when provided", () => {
      const palette = getModelPalette();
      const color = getModelColor("any-model", 0);
      expect(color).toBe(palette[0]);

      const color2 = getModelColor("any-model", 5);
      expect(color2).toBe(palette[5]);
    });

    it("should wrap indexHint around palette length", () => {
      const palette = getModelPalette();
      const color = getModelColor("any-model", palette.length);
      expect(color).toBe(palette[0]);

      const color2 = getModelColor("any-model", palette.length + 3);
      expect(color2).toBe(palette[3]);
    });

    it("should handle empty string model", () => {
      const color = getModelColor("");
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should trim whitespace from model id", () => {
      const color1 = getModelColor("gpt-4");
      const color2 = getModelColor("  gpt-4  ");
      expect(color1).toBe(color2);
    });
  });

  describe("getModelPalette", () => {
    it("should return an array of colors", () => {
      const palette = getModelPalette();
      expect(Array.isArray(palette)).toBe(true);
      expect(palette.length).toBeGreaterThan(0);
    });

    it("should return valid hex colors", () => {
      const palette = getModelPalette();
      palette.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it("should return a copy of the palette", () => {
      const palette1 = getModelPalette();
      const palette2 = getModelPalette();
      expect(palette1).not.toBe(palette2);
      expect(palette1).toEqual(palette2);
    });
  });

  describe("buildModelColorMap", () => {
    it("should build a color map for given models", () => {
      const models = ["gpt-4", "claude-3", "llama-2"];
      const colorMap = buildModelColorMap(models);

      expect(Object.keys(colorMap)).toHaveLength(3);
      expect(colorMap["gpt-4"]).toBeDefined();
      expect(colorMap["claude-3"]).toBeDefined();
      expect(colorMap["llama-2"]).toBeDefined();
    });

    it("should deduplicate models", () => {
      const models = ["gpt-4", "gpt-4", "claude-3"];
      const colorMap = buildModelColorMap(models);

      expect(Object.keys(colorMap)).toHaveLength(2);
    });

    it("should trim model names", () => {
      const models = ["  gpt-4  ", "gpt-4"];
      const colorMap = buildModelColorMap(models);

      expect(Object.keys(colorMap)).toHaveLength(1);
      expect(colorMap["gpt-4"]).toBeDefined();
    });

    it("should filter out empty/falsy models", () => {
      const models = ["gpt-4", "", "claude-3"];
      const colorMap = buildModelColorMap(models);

      expect(Object.keys(colorMap)).toHaveLength(2);
      expect(colorMap[""]).toBeUndefined();
    });

    it("should sort models alphabetically for consistent indexing", () => {
      const models1 = ["z-model", "a-model", "m-model"];
      const models2 = ["m-model", "z-model", "a-model"];

      const colorMap1 = buildModelColorMap(models1);
      const colorMap2 = buildModelColorMap(models2);

      expect(colorMap1).toEqual(colorMap2);
    });

    it("should handle empty array", () => {
      const colorMap = buildModelColorMap([]);
      expect(Object.keys(colorMap)).toHaveLength(0);
    });
  });

  describe("resolveModelColor", () => {
    it("should return color from colorMap if available", () => {
      const colorMap = { "gpt-4": "#ff0000" };
      const color = resolveModelColor("gpt-4", colorMap);
      expect(color).toBe("#ff0000");
    });

    it("should fall back to getModelColor if not in colorMap", () => {
      const colorMap = { "gpt-4": "#ff0000" };
      const color = resolveModelColor("claude-3", colorMap);
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should use indexHint when falling back", () => {
      const palette = getModelPalette();
      const color = resolveModelColor("unknown-model", {}, 2);
      expect(color).toBe(palette[2]);
    });

    it("should handle undefined colorMap", () => {
      const color = resolveModelColor("gpt-4", undefined);
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should trim model id", () => {
      const colorMap = { "gpt-4": "#ff0000" };
      const color = resolveModelColor("  gpt-4  ", colorMap);
      expect(color).toBe("#ff0000");
    });
  });

  describe("toAlphaColor", () => {
    it("should convert hex color to rgba with alpha", () => {
      const result = toAlphaColor("#ff0000", 0.5);
      expect(result).toBe("rgba(255, 0, 0, 0.50)");
    });

    it("should handle different hex colors", () => {
      expect(toAlphaColor("#00ff00", 0.5)).toBe("rgba(0, 255, 0, 0.50)");
      expect(toAlphaColor("#0000ff", 0.5)).toBe("rgba(0, 0, 255, 0.50)");
      expect(toAlphaColor("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.50)");
      expect(toAlphaColor("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.50)");
    });

    it("should clamp alpha to 0-1 range", () => {
      expect(toAlphaColor("#ff0000", -0.5)).toBe("rgba(255, 0, 0, 0.00)");
      expect(toAlphaColor("#ff0000", 1.5)).toBe("rgba(255, 0, 0, 1.00)");
    });

    it("should handle alpha at boundaries", () => {
      expect(toAlphaColor("#ff0000", 0)).toBe("rgba(255, 0, 0, 0.00)");
      expect(toAlphaColor("#ff0000", 1)).toBe("rgba(255, 0, 0, 1.00)");
    });

    it("should return original color for non-hex formats", () => {
      expect(toAlphaColor("rgb(255, 0, 0)", 0.5)).toBe("rgb(255, 0, 0)");
      expect(toAlphaColor("red", 0.5)).toBe("red");
      expect(toAlphaColor("var(--color)", 0.5)).toBe("var(--color)");
    });

    it("should handle lowercase hex colors", () => {
      const result = toAlphaColor("#abcdef", 0.5);
      expect(result).toBe("rgba(171, 205, 239, 0.50)");
    });

    it("should handle uppercase hex colors", () => {
      const result = toAlphaColor("#ABCDEF", 0.5);
      expect(result).toBe("rgba(171, 205, 239, 0.50)");
    });

    it("should not match 3-digit hex colors", () => {
      const result = toAlphaColor("#f00", 0.5);
      expect(result).toBe("#f00");
    });
  });
});
