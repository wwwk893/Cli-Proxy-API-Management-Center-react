import { NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";

type RawModel = {
  id?: string;
  name?: string;
  description?: string | null;
} & Record<string, unknown>;

type RawModelsResponse = {
  data?: RawModel[];
};

export async function GET() {
  try {
    const session = await requireSession();
    const url = `${session.serverBase}/v1/models`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${res.status} ${res.statusText}` },
        { status: res.status && res.status >= 400 ? res.status : 502 },
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
    const authError = asAuthError(err);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Models endpoint error: ${message}` }, { status: 502 });
  }
}
