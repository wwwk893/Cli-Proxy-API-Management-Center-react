import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { fetchManagementJsonWithConfig, fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

type ProviderKeyEntry = {
  index: number;
  maskedKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  hasHeaders?: boolean;
};

type OpenAIKeyEntry = {
  index: number;
  maskedKey: string;
  proxyUrl?: string;
};

type OpenAIProviderEntry = {
  index: number;
  name: string;
  baseUrl?: string;
  keys: OpenAIKeyEntry[];
  modelsCount?: number;
  hasHeaders?: boolean;
};

type ProvidersData = {
  gemini: ProviderKeyEntry[];
  codex: ProviderKeyEntry[];
  claude: ProviderKeyEntry[];
  openaiCompat: OpenAIProviderEntry[];
};

function maskKey(value: string) {
  const v = value.trim();
  if (!v) return "****";
  if (v.length <= 8) return `${v.slice(0, 2)}****`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeKeyList(items: unknown[]): ProviderKeyEntry[] {
  return items.map((raw, index) => {
    const obj = asRecord(raw);
    const apiKey = asString(obj["api-key"]);
    const baseUrl = asString(obj["base-url"] || obj["base_url"]).trim();
    const proxyUrl = asString(obj["proxy-url"] || obj["proxy_url"]).trim();
    const headers = asRecord(obj.headers);
    return {
      index,
      maskedKey: maskKey(apiKey),
      baseUrl: baseUrl || undefined,
      proxyUrl: proxyUrl || undefined,
      hasHeaders: Object.keys(headers).length > 0 ? true : undefined,
    };
  });
}

function normalizeOpenAIKeyEntriesRaw(rawProvider: Record<string, unknown>): Record<string, unknown>[] {
  const entries = rawProvider["api-key-entries"];
  if (Array.isArray(entries)) {
    return entries
      .map((entry) => asRecord(entry))
      .filter((entry) => Object.keys(entry).length > 0);
  }

  const legacyKeys = rawProvider["api-keys"];
  if (Array.isArray(legacyKeys)) {
    return legacyKeys
      .map((key) => asString(key).trim())
      .filter(Boolean)
      .map((apiKey) => ({ "api-key": apiKey }));
  }

  return [];
}

function normalizeOpenAIProviders(items: unknown[]): OpenAIProviderEntry[] {
  return items.map((raw, index) => {
    const obj = asRecord(raw);
    const name = asString(obj.name).trim();
    const baseUrl = asString(obj["base-url"] || obj["base_url"]).trim();
    const headers = asRecord(obj.headers);
    const modelsCount = Array.isArray(obj.models) ? obj.models.length : 0;

    const keysRaw = normalizeOpenAIKeyEntriesRaw(obj);
    const keys = keysRaw.map((entry, keyIndex) => {
      const rec = asRecord(entry);
      const apiKey = asString(rec["api-key"]);
      const proxyUrl = asString(rec["proxy-url"] || rec["proxy_url"]).trim();
      return {
        index: keyIndex,
        maskedKey: maskKey(apiKey),
        proxyUrl: proxyUrl || undefined,
      };
    });

    return {
      index,
      name,
      baseUrl: baseUrl || undefined,
      keys,
      modelsCount: modelsCount || undefined,
      hasHeaders: Object.keys(headers).length > 0 ? true : undefined,
    };
  });
}

async function readProviderList(
  config: { serverBase: string; key: string },
  endpoint: string,
  responseKey: string,
): Promise<unknown[]> {
  const { data } = await fetchManagementJsonWithConfig<Record<string, unknown>>(config, endpoint, { method: "GET" });
  const raw = data[responseKey];
  return Array.isArray(raw) ? raw : [];
}

async function putProviderList(config: { serverBase: string; key: string }, endpoint: string, payload: unknown[]) {
  await fetchManagementRawWithConfig(config, endpoint, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function patchProviderItem(
  config: { serverBase: string; key: string },
  endpoint: string,
  index: number,
  value: unknown,
) {
  await fetchManagementRawWithConfig(config, endpoint, {
    method: "PATCH",
    body: JSON.stringify({ index, value }),
  });
}

function keyProviderToEndpoint(provider: "gemini" | "codex" | "claude") {
  switch (provider) {
    case "gemini":
      return { endpoint: "/gemini-api-key", responseKey: "gemini-api-key" };
    case "codex":
      return { endpoint: "/codex-api-key", responseKey: "codex-api-key" };
    case "claude":
      return { endpoint: "/claude-api-key", responseKey: "claude-api-key" };
  }
}

const OPENAI_COMPAT = { endpoint: "/openai-compatibility", responseKey: "openai-compatibility" } as const;

async function readAllProviders(config: { serverBase: string; key: string }): Promise<ProvidersData> {
  const [geminiRaw, codexRaw, claudeRaw, openaiRaw] = await Promise.all([
    readProviderList(config, "/gemini-api-key", "gemini-api-key"),
    readProviderList(config, "/codex-api-key", "codex-api-key"),
    readProviderList(config, "/claude-api-key", "claude-api-key"),
    readProviderList(config, OPENAI_COMPAT.endpoint, OPENAI_COMPAT.responseKey),
  ]);

  return {
    gemini: normalizeKeyList(geminiRaw),
    codex: normalizeKeyList(codexRaw),
    claude: normalizeKeyList(claudeRaw),
    openaiCompat: normalizeOpenAIProviders(openaiRaw),
  };
}

const providerEnum = z.enum(["gemini", "codex", "claude", "openaiCompat"]);
const keyProviderEnum = z.enum(["gemini", "codex", "claude"]);

const keyEntrySchema = z
  .object({
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    proxyUrl: z.string().optional(),
  })
  .strict();

const upsertKeySchema = z
  .object({
    provider: keyProviderEnum,
    index: z.number().int().min(0).optional(),
    entry: keyEntrySchema,
  })
  .strict();

const openaiKeyEntrySchema = z
  .object({
    apiKey: z.string().min(1),
    proxyUrl: z.string().optional(),
  })
  .strict();

const openaiKeysPatchSchema = z
  .object({
    update: z
      .array(
        z
          .object({
            index: z.number().int().min(0),
            proxyUrl: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    delete: z.array(z.number().int().min(0)).optional(),
    add: z.array(openaiKeyEntrySchema).optional(),
  })
  .strict();

const openaiEntrySchema = z
  .object({
    name: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKeyEntries: z.array(openaiKeyEntrySchema).min(1).optional(),
    keys: openaiKeysPatchSchema.optional(),
  })
  .strict();

const upsertOpenaiSchema = z
  .object({
    provider: z.literal("openaiCompat"),
    index: z.number().int().min(0).optional(),
    entry: openaiEntrySchema,
  })
  .strict();

function mergeKeyEntry(existing: Record<string, unknown>, next: z.infer<typeof keyEntrySchema>) {
  const merged: Record<string, unknown> = { ...existing };

  if (next.apiKey !== undefined) {
    const v = next.apiKey.trim();
    if (v) merged["api-key"] = v;
  }

  if (next.baseUrl !== undefined) {
    const v = next.baseUrl.trim();
    if (v) merged["base-url"] = v;
    else delete merged["base-url"];
  }

  if (next.proxyUrl !== undefined) {
    const v = next.proxyUrl.trim();
    if (v) merged["proxy-url"] = v;
    else delete merged["proxy-url"];
  }

  return merged;
}

export async function GET() {
  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    return NextResponse.json(ok(await readAllProviders(config)));
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
  let config: { serverBase: string; key: string };
  try {
    assertSameOrigin(req);
    const session = await requireSession();
    config = { serverBase: session.serverBase, key: session.adminKey };
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const providerParsed = providerEnum.safeParse((body as any)?.provider);
  if (!providerParsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid provider"), { status: 400 });
  }

  if (providerParsed.data === "openaiCompat") {
    const parsed = upsertOpenaiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
    }

    const name = (parsed.data.entry.name || "").trim();
    const baseUrl = (parsed.data.entry.baseUrl || "").trim();
    const apiKeyEntries = parsed.data.entry.apiKeyEntries || [];

    if (!name) return NextResponse.json(fail("VALIDATION_ERROR", "name is required"), { status: 400 });
    if (!baseUrl) return NextResponse.json(fail("VALIDATION_ERROR", "baseUrl is required"), { status: 400 });
    if (apiKeyEntries.length === 0) {
      return NextResponse.json(fail("VALIDATION_ERROR", "apiKeyEntries is required"), { status: 400 });
    }

    const keys = apiKeyEntries.map((entry) => {
      const apiKey = entry.apiKey.trim();
      const proxyUrl = (entry.proxyUrl || "").trim();
      const out: Record<string, unknown> = { "api-key": apiKey };
      if (proxyUrl) out["proxy-url"] = proxyUrl;
      return out;
    });

    try {
      const current = await readProviderList(config, OPENAI_COMPAT.endpoint, OPENAI_COMPAT.responseKey);
      const next = [...current, { name, "base-url": baseUrl, "api-key-entries": keys }];
      await putProviderList(config, OPENAI_COMPAT.endpoint, next);
      return NextResponse.json(ok(await readAllProviders(config)));
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

  const parsed = upsertKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
  }

  const apiKey = (parsed.data.entry.apiKey || "").trim();
  const baseUrl = (parsed.data.entry.baseUrl || "").trim();
  const proxyUrl = (parsed.data.entry.proxyUrl || "").trim();

  if (!apiKey) return NextResponse.json(fail("VALIDATION_ERROR", "apiKey is required"), { status: 400 });
  if (parsed.data.provider === "codex" && !baseUrl) {
    return NextResponse.json(fail("VALIDATION_ERROR", "baseUrl is required"), { status: 400 });
  }

  const { endpoint, responseKey } = keyProviderToEndpoint(parsed.data.provider);

  try {
    const current = await readProviderList(config, endpoint, responseKey);
    const exists = current.some((raw) => asString(asRecord(raw)["api-key"]).trim() === apiKey);
    if (exists) {
      return NextResponse.json(fail("VALIDATION_ERROR", "apiKey already exists"), { status: 400 });
    }

    const nextItem: Record<string, unknown> = { "api-key": apiKey };
    if (baseUrl) nextItem["base-url"] = baseUrl;
    if (proxyUrl) nextItem["proxy-url"] = proxyUrl;

    await putProviderList(config, endpoint, [...current, nextItem]);
    return NextResponse.json(ok(await readAllProviders(config)));
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
  let config: { serverBase: string; key: string };
  try {
    assertSameOrigin(req);
    const session = await requireSession();
    config = { serverBase: session.serverBase, key: session.adminKey };
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const providerParsed = providerEnum.safeParse((body as any)?.provider);
  if (!providerParsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid provider"), { status: 400 });
  }

  if (providerParsed.data === "openaiCompat") {
    const parsed = upsertOpenaiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
    }
    const index = parsed.data.index;
    if (index === undefined) {
      return NextResponse.json(fail("VALIDATION_ERROR", "index is required"), { status: 400 });
    }

    const name = parsed.data.entry.name !== undefined ? parsed.data.entry.name.trim() : undefined;
    const baseUrl = parsed.data.entry.baseUrl !== undefined ? parsed.data.entry.baseUrl.trim() : undefined;

    if (name !== undefined && !name) return NextResponse.json(fail("VALIDATION_ERROR", "name cannot be empty"), { status: 400 });
    if (baseUrl !== undefined && !baseUrl) {
      return NextResponse.json(fail("VALIDATION_ERROR", "baseUrl cannot be empty"), { status: 400 });
    }

    try {
      const current = await readProviderList(config, OPENAI_COMPAT.endpoint, OPENAI_COMPAT.responseKey);
      if (index < 0 || index >= current.length) {
        return NextResponse.json(fail("VALIDATION_ERROR", "index out of range"), { status: 400 });
      }

      const currentObj = asRecord(current[index]);
      const merged: Record<string, unknown> = { ...currentObj };

      if (name !== undefined) merged.name = name;
      if (baseUrl !== undefined) merged["base-url"] = baseUrl;

      if (parsed.data.entry.keys) {
        const currentKeys = normalizeOpenAIKeyEntriesRaw(merged).map((entry) => ({ ...entry }));

        const updates = parsed.data.entry.keys.update || [];
        for (const u of updates) {
          if (u.index < 0 || u.index >= currentKeys.length) {
            return NextResponse.json(fail("VALIDATION_ERROR", "key index out of range"), { status: 400 });
          }
          if (u.proxyUrl !== undefined) {
            const v = u.proxyUrl.trim();
            const entry = asRecord(currentKeys[u.index]);
            if (v) entry["proxy-url"] = v;
            else delete entry["proxy-url"];
            currentKeys[u.index] = entry;
          }
        }

        const deleteSet = new Set(parsed.data.entry.keys.delete || []);
        for (const d of deleteSet) {
          if (d < 0 || d >= currentKeys.length) {
            return NextResponse.json(fail("VALIDATION_ERROR", "key index out of range"), { status: 400 });
          }
        }
        const keptKeys = currentKeys.filter((_, i) => !deleteSet.has(i));

        const add = parsed.data.entry.keys.add || [];
        const addedKeys = add.map((entry) => {
          const apiKey = entry.apiKey.trim();
          const proxyUrl = (entry.proxyUrl || "").trim();
          const out: Record<string, unknown> = { "api-key": apiKey };
          if (proxyUrl) out["proxy-url"] = proxyUrl;
          return out;
        });

        const nextKeys = [...keptKeys, ...addedKeys].filter((entry) => asString(asRecord(entry)["api-key"]).trim());
        if (nextKeys.length === 0) {
          return NextResponse.json(fail("VALIDATION_ERROR", "At least one api key entry is required"), { status: 400 });
        }

        merged["api-key-entries"] = nextKeys;
        delete merged["api-keys"];
      }

      await patchProviderItem(config, OPENAI_COMPAT.endpoint, index, merged);
      return NextResponse.json(ok(await readAllProviders(config)));
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

  const parsed = upsertKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Validation failed"), { status: 400 });
  }
  const index = parsed.data.index;
  if (index === undefined) {
    return NextResponse.json(fail("VALIDATION_ERROR", "index is required"), { status: 400 });
  }

  const { endpoint, responseKey } = keyProviderToEndpoint(parsed.data.provider);
  try {
    const current = await readProviderList(config, endpoint, responseKey);
    if (index < 0 || index >= current.length) {
      return NextResponse.json(fail("VALIDATION_ERROR", "index out of range"), { status: 400 });
    }

    const currentObj = asRecord(current[index]);
    const merged = mergeKeyEntry(currentObj, parsed.data.entry);

    const nextApiKey = asString(merged["api-key"]).trim();
    if (!nextApiKey) {
      return NextResponse.json(fail("VALIDATION_ERROR", "apiKey is required"), { status: 400 });
    }

    if (parsed.data.provider === "codex") {
      const baseUrl = asString(merged["base-url"] || merged["base_url"]).trim();
      if (!baseUrl) {
        return NextResponse.json(fail("VALIDATION_ERROR", "baseUrl is required"), { status: 400 });
      }
    }

    const duplicateIndex = current.findIndex((raw, i) => i !== index && asString(asRecord(raw)["api-key"]).trim() === nextApiKey);
    if (duplicateIndex >= 0) {
      return NextResponse.json(fail("VALIDATION_ERROR", "apiKey already exists"), { status: 400 });
    }

    await patchProviderItem(config, endpoint, index, merged);
    return NextResponse.json(ok(await readAllProviders(config)));
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
  let config: { serverBase: string; key: string };
  try {
    assertSameOrigin(req);
    const session = await requireSession();
    config = { serverBase: session.serverBase, key: session.adminKey };
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

  const { searchParams } = new URL(req.url);
  const providerParsed = providerEnum.safeParse(searchParams.get("provider"));
  if (!providerParsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid provider"), { status: 400 });
  }

  const indexRaw = searchParams.get("index");
  const index = indexRaw ? Number(indexRaw) : NaN;
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing or invalid index"), { status: 400 });
  }

  if (providerParsed.data === "openaiCompat") {
    try {
      const current = await readProviderList(config, OPENAI_COMPAT.endpoint, OPENAI_COMPAT.responseKey);
      if (index < 0 || index >= current.length) {
        return NextResponse.json(fail("VALIDATION_ERROR", "index out of range"), { status: 400 });
      }

      const obj = asRecord(current[index]);
      const name = asString(obj.name).trim();
      if (name) {
        await fetchManagementRawWithConfig(
          config,
          `${OPENAI_COMPAT.endpoint}?name=${encodeURIComponent(name)}`,
          { method: "DELETE" },
        );
        return NextResponse.json(ok(await readAllProviders(config)));
      }

      const next = current.filter((_, i) => i !== index);
      await putProviderList(config, OPENAI_COMPAT.endpoint, next);
      return NextResponse.json(ok(await readAllProviders(config)));
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

  const { endpoint, responseKey } = keyProviderToEndpoint(providerParsed.data);
  try {
    const current = await readProviderList(config, endpoint, responseKey);
    if (index < 0 || index >= current.length) {
      return NextResponse.json(fail("VALIDATION_ERROR", "index out of range"), { status: 400 });
    }

    const obj = asRecord(current[index]);
    const apiKey = asString(obj["api-key"]).trim();
    if (apiKey) {
      await fetchManagementRawWithConfig(config, `${endpoint}?api-key=${encodeURIComponent(apiKey)}`, { method: "DELETE" });
      return NextResponse.json(ok(await readAllProviders(config)));
    }

    const next = current.filter((_, i) => i !== index);
    await putProviderList(config, endpoint, next);
    return NextResponse.json(ok(await readAllProviders(config)));
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

