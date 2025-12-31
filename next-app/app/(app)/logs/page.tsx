import LogsClient, { LogsInitialData, LogsInitialFilters } from "./logs-client";

export const dynamic = "force-dynamic";

type LogsPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const level = (typeof searchParams.level === "string" ? searchParams.level : "all") as LogsInitialFilters["level"];
  const search = typeof searchParams.q === "string" ? searchParams.q : "";
  const limitParam = typeof searchParams.limit === "string" ? Number(searchParams.limit) : undefined;
  const limit = Number.isFinite(limitParam) ? Number(limitParam) : 1000;

  const initialFilters: LogsInitialFilters = {
    search,
    level: ["error", "warn", "info", "debug", "all"].includes(level) ? level : "all",
    limit,
  };

  const initialData: LogsInitialData = null;

  return (
    <LogsClient initialData={initialData} initialFilters={initialFilters} />
  );
}
