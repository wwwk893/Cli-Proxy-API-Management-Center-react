import { NextResponse } from "next/server";

type RawModel = {
  id?: string;
  name?: string;
  description?: string | null;
} & Record<string, unknown>;

type RawModelsResponse = {
  data?: RawModel[];
};

const DEFAULT_BASE = "http://127.0.0.1:3818";

function getBaseUrl() {
  const env = process.env.CLIPROXY_BASE_URL?.trim();
  if (env && env.length > 0) return env.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export async function GET() {
  const base = getBaseUrl();
  const url = `${base}/v1/models`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${res.status} ${res.statusText}` },
        { status: res.status || 502 },
      );
    }

    const json = (await res.json()) as RawModelsResponse;
    const raw = Array.isArray(json?.data) ? json.data : [];

    const data = raw
      .map((m): { id: string; description?: string } | null => {
        const id = m.id ?? m.name;
        if (!id) return null;
        const description = typeof m.description === "string" ? m.description : undefined;
        return { id: String(id), description };
      })
      .filter((m): m is { id: string; description?: string } => m !== null);

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Models endpoint error: ${message}` }, { status: 502 });
  }
}
