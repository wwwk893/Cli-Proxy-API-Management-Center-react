import { NextRequest, NextResponse } from "next/server";

import { fetchManagementJson, fetchManagementRaw, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

type AuthFileEntry = {
  name: string;
  type?: string;
  provider?: string;
  size?: number;
  modtime?: string;
  disabled?: boolean;
  runtime_only?: boolean;
  auth_index?: string | number;
  [key: string]: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeAuthFile(raw: unknown): AuthFileEntry | null {
  const obj = asRecord(raw);
  const name = asString(obj.name).trim();
  if (!name) return null;

  const type = asString(obj.type).trim();
  const provider = asString(obj.provider).trim();
  const modtime = asString(obj.modtime).trim();

  return {
    ...obj,
    name,
    type: type || undefined,
    provider: provider || undefined,
    size: asNumber(obj.size),
    modtime: modtime || undefined,
    disabled: asBoolean(obj.disabled) ? true : undefined,
    runtime_only: asBoolean(obj.runtime_only) ? true : undefined,
    auth_index: obj.auth_index as any,
  };
}

export async function GET() {
  try {
    const { data } = await fetchManagementJson<Record<string, unknown>>("/auth-files", { method: "GET" });
    const rawFiles = (data as any)?.files;
    const files = Array.isArray(rawFiles) ? rawFiles.map(normalizeAuthFile).filter(Boolean) : [];
    return NextResponse.json(ok({ files }));
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
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid form data"), { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing file"), { status: 400 });
  }
  if (!file.name.endsWith(".json")) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Only .json files are allowed"), { status: 400 });
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name);

  try {
    await fetchManagementRaw("/auth-files", { method: "POST", body: upstream });
    return NextResponse.json(ok({ uploaded: true }));
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
  const all = searchParams.get("all");
  const name = (searchParams.get("name") || "").trim();

  if (all === "true" || all === "1") {
    try {
      const { data } = await fetchManagementJson<Record<string, unknown>>("/auth-files?all=true", { method: "DELETE" });
      return NextResponse.json(ok(data));
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

  if (!name) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing name"), { status: 400 });
  }

  try {
    const { data } = await fetchManagementJson<Record<string, unknown>>(
      `/auth-files?name=${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    return NextResponse.json(ok(data));
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

