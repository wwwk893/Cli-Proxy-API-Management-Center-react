import { UsageClient } from "./usage-client";

export const dynamic = "force-dynamic";

export default function UsagePage({}: { searchParams: Record<string, string | string[] | undefined> }) {
  return <UsageClient />;
}
