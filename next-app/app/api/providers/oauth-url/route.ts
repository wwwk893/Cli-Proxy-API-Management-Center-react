import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchManagementJson, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

const providerEnum = z.enum([
  "codex",
  "anthropic",
  "antigravity",
  "gemini-cli",
  "qwen",
  "iflow",
]);

function mapProviderToEndpoint(provider: z.infer<typeof providerEnum>) {
  switch (provider) {
    case "codex":
      return "/codex-auth-url?is_webui=1";
    case "anthropic":
      return "/anthropic-auth-url?is_webui=1";
    case "antigravity":
      return "/antigravity-auth-url?is_webui=1";
    case "gemini-cli":
      return "/gemini-cli-auth-url?is_webui=1";
    case "qwen":
      return "/qwen-auth-url?is_webui=1";
    case "iflow":
      return "/iflow-auth-url?is_webui=1";
  }
}

function extractStateFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.searchParams.get("state");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerRaw = searchParams.get("provider");
  const providerParsed = providerEnum.safeParse(providerRaw);
  if (!providerParsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid provider"), { status: 400 });
  }

  try {
    const endpoint = mapProviderToEndpoint(providerParsed.data);
    const { data } = await fetchManagementJson<{ url: string }>(endpoint);
    const url = data?.url || "";
    const state = url ? extractStateFromUrl(url) : null;
    return NextResponse.json(ok({ provider: providerParsed.data, url, state }));
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
