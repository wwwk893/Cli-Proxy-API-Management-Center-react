import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { fetchManagementJsonWithConfig, fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

type ApiKeyRow = {
  index: number;
  maskedKey: string;
};

type ApiKeysData = {
  keys: ApiKeyRow[];
};

function maskKey(value: string) {
  const v = value.trim();
  if (!v) return "****";
  if (v.length <= 8) return `${v.slice(0, 2)}****`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

async function readKeysRaw(config: { serverBase: string; key: string }): Promise<string[]> {
  const { data } = await fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/api-keys", { method: "GET" });
  const raw = data["api-keys"];
  const list = Array.isArray(raw) ? raw : [];
  return list.map((k) => (typeof k === "string" ? k : String(k ?? ""))).filter(Boolean);
}

function toMasked(rows: string[]): ApiKeysData {
  return {
    keys: rows.map((value, index) => ({
      index,
      maskedKey: maskKey(value),
    })),
  };
}

const createSchema = z
  .object({
    value: z.string().min(1),
  })
  .strict();

const patchSchema = z
  .object({
    index: z.number().int().min(0),
    value: z.string().min(1),
  })
  .strict();

export async function GET() {
  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const keys = await readKeysRaw(config);
    return NextResponse.json(ok(toMasked(keys)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
  }

  try {
    assertSameOrigin(req);
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const current = await readKeysRaw(config);
    const value = parsed.data.value.trim();
    if (current.includes(value)) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Key already exists"), { status: 400 });
    }

    const next = [...current, value];
    await fetchManagementRawWithConfig(config, "/api-keys", {
      method: "PUT",
      body: JSON.stringify(next),
    });

    return NextResponse.json(ok(toMasked(next)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
  }

  try {
    assertSameOrigin(req);
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    await fetchManagementRawWithConfig(config, "/api-keys", {
      method: "PATCH",
      body: JSON.stringify({ index: parsed.data.index, value: parsed.data.value.trim() }),
    });

    const after = await readKeysRaw(config);
    return NextResponse.json(ok(toMasked(after)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const indexRaw = searchParams.get("index");
  const index = indexRaw ? Number(indexRaw) : NaN;
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing or invalid index"), { status: 400 });
  }

  try {
    assertSameOrigin(req);
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    await fetchManagementRawWithConfig(
      config,
      `/api-keys?index=${encodeURIComponent(String(index))}`,
      { method: "DELETE" },
    );
    const after = await readKeysRaw(config);
    return NextResponse.json(ok(toMasked(after)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}
