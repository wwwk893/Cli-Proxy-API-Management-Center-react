import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseJsonBody,
  modelPricingCreateSchema,
  modelPricingDeleteSchema,
} from "@/lib/api";

function serialize(entry: {
  id: string;
  modelId: string;
  inputCost: unknown;
  outputCost: unknown;
  cachedCost: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    modelId: entry.modelId,
    inputCost: Number(entry.inputCost),
    outputCost: Number(entry.outputCost),
    cachedCost: Number(entry.cachedCost),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function GET() {
  try {
    const rows = await prisma.modelPricing.findMany({ orderBy: { modelId: "asc" } });
    return NextResponse.json({ data: rows.map(serialize) });
  } catch (err) {
    console.error("Model pricing GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, modelPricingCreateSchema);
  if (!parsed.success) {
    return parsed.error;
  }

  const { modelId, inputCost, outputCost, cachedCost = 0 } = parsed.data;

  try {
    const saved = await prisma.modelPricing.upsert({
      where: { modelId },
      update: { inputCost, outputCost, cachedCost },
      create: { modelId, inputCost, outputCost, cachedCost },
    });
    return NextResponse.json({ data: serialize(saved) });
  } catch (err) {
    console.error("Model pricing POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const modelIdParam = searchParams.get("modelId");

  let modelId = modelIdParam?.trim() || "";

  if (!modelId) {
    const parsed = await parseJsonBody(req, modelPricingDeleteSchema);
    if (!parsed.success) {
      return parsed.error;
    }
    modelId = parsed.data.modelId;
  } else {
    const validation = modelPricingDeleteSchema.safeParse({ modelId });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: { modelId: validation.error.errors.map((e) => e.message) } },
        { status: 400 }
      );
    }
    modelId = validation.data.modelId;
  }

  try {
    await prisma.modelPricing.deleteMany({ where: { modelId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Model pricing DELETE error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
