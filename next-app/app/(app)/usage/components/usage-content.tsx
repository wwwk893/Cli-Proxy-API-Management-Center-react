"use client";

import { useMemo } from "react";
import { UsageSummaryCards } from "@/components/usage/usage-summary-cards";
import { UsageModelTable } from "@/components/charts/usage-model-table";
import { UsageMainChart } from "@/components/charts/usage-main-chart";
import { FilterPopover, type ModelOption } from "@/components/usage/filter-popover";
import { SourceFilter } from "@/components/usage/source-filter";
import { useI18n } from "@/components/i18n-context";
import { useUsageModels } from "@/lib/usage/hooks/use-usage-models";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";
import { buildModelColorMap } from "@/lib/model-colors";

export function UsageContent({ initialModels }: { initialModels?: ModelOption[] }) {
  const { t } = useI18n();
  const { models, loading, error, reload } = useUsageModels(initialModels ?? []);
  const {
    state: { dateRange, granularity, selectedModels, selectedSources, selectedChannels, focusModels, viewMode, refreshKey },
    actions,
  } = useUsageFilters();

  const filtersSummary = useMemo(() => {
    const formatLocal = (d: Date) =>
      d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    const fromStr = dateRange?.from ? formatLocal(dateRange.from) : "";
    const toStr = dateRange?.to ? formatLocal(dateRange.to) : "";
    const modelSummary = selectedModels.length === 1
      ? `${t("model")} ${selectedModels[0]}`
      : selectedModels.length > 1
        ? `${t("model")} ${selectedModels.length} ${t("models")}`
        : "";
    const sourceSummary = selectedSources.length
      ? `${t("source") ?? "source"} ${selectedSources.length}`
      : "";
    const channelSummary = selectedChannels.length && selectedChannels.length < 2
      ? `${t("channel")} ${selectedChannels.length}`
      : "";
    return [
      fromStr && `${t("from")} ${fromStr.slice(0, 16)}`,
      toStr && `${t("to")} ${toStr.slice(0, 16)}`,
      modelSummary,
      sourceSummary,
      channelSummary,
      granularity && `${t("granularity")} ${t(granularity)}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [dateRange, selectedModels, selectedSources, granularity, t]);

  const modelColorMap = useMemo(() => buildModelColorMap(models.map((m) => m.id)), [models]);

  return (
    <div className="space-y-6">
      <UsageSummaryCards />

      <UsageModelTable
        modelColorMap={modelColorMap}
        selectedModels={focusModels}
        filterModels={selectedModels}
        from={dateRange?.from ? dateRange.from.toISOString() : null}
        to={dateRange?.to ? dateRange.to.toISOString() : null}
        granularity={granularity}
        refreshKey={refreshKey}
        sources={selectedSources}
        onToggleModel={(model) => actions.toggleFocusModel(model)}
        extraHeader={
          <div className="flex items-center gap-2">
            <FilterPopover
              selectedModels={selectedModels}
              models={models}
              loading={loading}
              error={error}
              onRetry={reload}
              onChangeModels={(next) => actions.setSelectedModels(next)}
              modelColorMap={modelColorMap}
            />
            <SourceFilter
              selected={selectedSources}
              onChange={(next) => actions.setSelectedSources(next)}
              from={dateRange?.from ? dateRange.from.toISOString() : undefined}
              to={dateRange?.to ? dateRange.to.toISOString() : undefined}
              channels={selectedChannels}
            />
          </div>
        }
        filtersSummary={filtersSummary}
      />

      <UsageMainChart
        filterModels={selectedModels}
        viewMode={viewMode}
        onChangeViewMode={(mode) => actions.setViewMode(mode)}
        granularity={granularity}
        focusModels={focusModels}
        from={dateRange?.from ? dateRange.from.toISOString() : null}
        to={dateRange?.to ? dateRange.to.toISOString() : null}
        refreshKey={refreshKey}
        modelColorMap={modelColorMap}
        sources={selectedSources}
      />
    </div>
  );
}
