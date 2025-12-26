import { prisma } from "./db";
import { DEFAULT_PRICING, type PricingMap } from "./pricing";

export async function loadPricingMap(): Promise<PricingMap> {
  const rows = await prisma.modelPricing.findMany();
  const map: PricingMap = { ...DEFAULT_PRICING };
  rows.forEach((row) => {
    map[row.modelId] = {
      inputPerMillion: Number(row.inputCost ?? 0),
      outputPerMillion: Number(row.outputCost ?? 0),
      cachedPerMillion: Number(row.cachedCost ?? 0),
    };
  });
  return map;
}
