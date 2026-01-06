"use client";

import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip";
import { resolveModelColor } from "@/lib/model-colors";
import { formatSourceLabel, getSourceColor, getSourceIcon } from "@/lib/source-utils";
import { ModelUsageDetail } from "@/components/charts/model-usage-detail";
import { ModelUsageDetailTrigger } from "@/components/charts/model-usage-detail-trigger";
import { EffortSparkBar } from "./effort-spark-bar";
import { CacheRateCell, MetricCell, formatCompact, formatCurrency } from "./cells";
import type { EffortFilterValue } from "@/lib/usage/model-normalize";
import type { Metrics, SourceNode, TableViewModel } from "./types";

type Props = {
  view: TableViewModel | null;
  locale?: string;
  isZh: boolean;
  t: (key: string) => string;
  modelColorMap?: Record<string, string>;
  maxTokens: number;
  maxCost: number;

  selectedSet: Set<string> | null;
  expandedKeys: Set<string>;
  toggleExpanded: (key: string) => void;
  inlineDetailKey: string | null;
  setInlineDetailKey: (next: string | null) => void;
  isTouch: boolean;

  onToggleModel: (model: string) => void;

  selectedEffortsCount: number;
  hasModelFilter: boolean;
  onClearEfforts: () => void;
  onClearModels: () => void;
};

export function UsageModelTableRows({
  view,
  locale,
  isZh,
  t,
  modelColorMap,
  maxTokens,
  maxCost,
  selectedSet,
  expandedKeys,
  toggleExpanded,
  inlineDetailKey,
  setInlineDetailKey,
  isTouch,
  onToggleModel,
  selectedEffortsCount,
  hasModelFilter,
  onClearEfforts,
  onClearModels,
}: Props) {
  const effortLabel = (value: EffortFilterValue) => {
    if (value === "unspecified") return isZh ? "未标注" : "Unspecified";
    return value;
  };

  const renderSourceRows = (params: {
    parentKey: string;
    parentMetrics: Metrics;
    sources: SourceNode[];
    indentClass: string;
  }) => {
    const { parentKey, parentMetrics, sources: sourceNodes, indentClass } = params;
    if (!expandedKeys.has(parentKey) || sourceNodes.length === 0) return null;
    return sourceNodes.map((child) => {
      const Icon = getSourceIcon(child.authSource ?? undefined);
      const color = getSourceColor(child.authSource ?? undefined);
      const percentOfParent = parentMetrics.totalTokens > 0
        ? (child.metrics.totalTokens / parentMetrics.totalTokens) * 100
        : 0;
      const percentCost = parentMetrics.costUsd > 0
        ? (child.metrics.costUsd / parentMetrics.costUsd) * 100
        : 0;

      return (
        <TableRow key={child.key} className="bg-muted/30">
          <TableCell className="w-64">
            <div className={cn("flex items-center gap-2", indentClass)}>
              <Icon className="h-4 w-4" style={{ color }} />
              <span className="text-muted-foreground truncate">{formatSourceLabel(child.authSource)}</span>
            </div>
          </TableCell>
          <TableCell className="w-28 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
            {child.metrics.requestCount}
          </TableCell>
          <TableCell className="w-28 text-right font-mono text-sm text-destructive hidden sm:table-cell">
            {child.metrics.failureCount ?? 0}
          </TableCell>
          <TableCell className="w-64">
            <MetricCell
              primary={formatCompact(child.metrics.totalTokens, locale)}
              secondary={child.metrics.cachedTokens > 0 ? formatCompact(child.metrics.cachedTokens, locale) : undefined}
              percent={percentOfParent}
              barColor={color}
              trackColor="var(--muted)"
            />
          </TableCell>
          <TableCell className="w-44 hidden md:table-cell">
            <CacheRateCell rate={child.metrics.cacheHitRate} cachedTokens={child.metrics.cachedTokens} locale={locale} />
          </TableCell>
          <TableCell className="w-44">
            <MetricCell
              primary={formatCurrency(child.metrics.costUsd, locale)}
              percent={percentCost}
              barColor={color}
              trackColor="var(--muted)"
            />
          </TableCell>
          <TableCell className="w-24 text-right hidden sm:table-cell" />
        </TableRow>
      );
    });
  };

  if (!view) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
          {t("loading")}
        </TableCell>
      </TableRow>
    );
  }

  const topCount = view.groupBy === "canonical" ? view.nodes.length : view.rows.length;
  if (topCount === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
          <div className="space-y-3">
            <div>{isZh ? "当前筛选无匹配模型" : "No results for current filters"}</div>
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={onClearEfforts}
                disabled={selectedEffortsCount === 0}
              >
                {isZh ? "清除 Effort 筛选" : "Clear effort filter"}
              </button>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={onClearModels}
                disabled={!hasModelFilter}
              >
                {isZh ? "清除 模型筛选" : "Clear model filter"}
              </button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (view.groupBy === "canonical") {
    return (
      <>
        {view.nodes.map((node, idx) => {
          const rowColor = resolveModelColor(node.modelCanonical, modelColorMap, idx);
          const isSelected = selectedSet?.has(node.modelCanonical) ?? false;
          const isExpanded = expandedKeys.has(node.key);
          const isInlineOpen = inlineDetailKey === node.key;
          const detailRow = {
            model: node.modelCanonical,
            inputTokens: node.metrics.inputTokens,
            outputTokens: node.metrics.outputTokens,
            reasoningTokens: node.metrics.reasoningTokens,
            cachedTokens: node.metrics.cachedTokens,
            inputCostUsd: node.metrics.inputCostUsd,
            outputCostUsd: node.metrics.outputCostUsd,
            cachedCostUsd: node.metrics.cachedCostUsd,
            pricingConfigured: node.metrics.pricingConfigured,
          };

          return (
            <Fragment key={node.key}>
              <TableRow
                aria-selected={isSelected}
                style={{ borderLeftColor: isSelected ? rowColor : "transparent" }}
                className={cn(
                  "cursor-pointer border-l-4 transition-colors",
                  isSelected ? "bg-primary/5 shadow-inner" : "hover:bg-accent/10",
                )}
                onClick={() => onToggleModel(node.modelCanonical)}
              >
                <TableCell className="font-medium text-card-foreground">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(node.key);
                      }}
                    >
                      <ChevronRight
                        className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                        aria-label={isExpanded ? t("collapseRow") : t("expandRow")}
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rowColor }} />
                      <UiTooltip>
                        <UiTooltipTrigger asChild>
                          <span className={cn("truncate", isSelected && "font-semibold")}>{node.modelCanonical}</span>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top" className="font-mono text-xs">
                          {node.modelCanonical}
                        </UiTooltipContent>
                      </UiTooltip>
                    </button>
                    <ModelUsageDetailTrigger
                      row={detailRow}
                      isTouch={isTouch}
                      inlineOpen={isInlineOpen}
                      onToggleInline={() => setInlineDetailKey(inlineDetailKey === node.key ? null : node.key)}
                    />
                  </div>
                </TableCell>

                <TableCell className="font-mono text-sm text-muted-foreground text-right hidden sm:table-cell">
                  {node.metrics.requestCount}
                </TableCell>
                <TableCell className="font-mono text-sm text-right text-destructive hidden sm:table-cell">
                  {node.metrics.failureCount ?? 0}
                </TableCell>
                <TableCell>
                  <MetricCell
                    primary={formatCompact(node.metrics.totalTokens, locale)}
                    secondary={node.metrics.cachedTokens > 0 ? formatCompact(node.metrics.cachedTokens, locale) : undefined}
                    percent={maxTokens ? (node.metrics.totalTokens / maxTokens) * 100 : 0}
                    barColor={rowColor}
                    trackColor="var(--muted)"
                  />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <CacheRateCell rate={node.metrics.cacheHitRate} cachedTokens={node.metrics.cachedTokens} locale={locale} />
                </TableCell>
                <TableCell>
                  <MetricCell
                    primary={formatCurrency(node.metrics.costUsd, locale)}
                    percent={maxCost ? (node.metrics.costUsd / maxCost) * 100 : 0}
                    barColor={rowColor}
                    trackColor="var(--muted)"
                  />
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell">
                  <EffortSparkBar distribution={node.distribution} locale={locale} className="justify-end" />
                </TableCell>
              </TableRow>

              {isTouch && isInlineOpen ? (
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={7}>
                    <ModelUsageDetail row={detailRow} variant="inline" />
                  </TableCell>
                </TableRow>
              ) : null}

              {isExpanded
                ? node.efforts.map((effortNode) => {
                    const effortKey = effortNode.label as EffortFilterValue;
                    const isEffortExpanded = expandedKeys.has(effortNode.key);
                    const isEffortInlineOpen = inlineDetailKey === effortNode.key;
                    const effortPercentTokens = node.metrics.totalTokens > 0
                      ? (effortNode.metrics.totalTokens / node.metrics.totalTokens) * 100
                      : 0;
                    const effortPercentCost = node.metrics.costUsd > 0
                      ? (effortNode.metrics.costUsd / node.metrics.costUsd) * 100
                      : 0;
                    const effortDetailRow = {
                      model: `${node.modelCanonical} (${effortLabel(effortKey)})`,
                      inputTokens: effortNode.metrics.inputTokens,
                      outputTokens: effortNode.metrics.outputTokens,
                      reasoningTokens: effortNode.metrics.reasoningTokens,
                      cachedTokens: effortNode.metrics.cachedTokens,
                      inputCostUsd: effortNode.metrics.inputCostUsd,
                      outputCostUsd: effortNode.metrics.outputCostUsd,
                      cachedCostUsd: effortNode.metrics.cachedCostUsd,
                      pricingConfigured: effortNode.metrics.pricingConfigured,
                    };

                    return (
                      <Fragment key={effortNode.key}>
                        <TableRow
                          className="bg-muted/20 hover:bg-muted/30 cursor-pointer"
                          onClick={() => toggleExpanded(effortNode.key)}
                        >
                          <TableCell className="w-64">
                            <div className="flex items-center gap-2 pl-7">
                              <ChevronRight
                                className={cn("h-4 w-4 transition-transform", isEffortExpanded && "rotate-90")}
                                aria-label={isEffortExpanded ? t("collapseRow") : t("expandRow")}
                              />
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {effortLabel(effortKey)}
                              </span>
                              <ModelUsageDetailTrigger
                                row={effortDetailRow}
                                isTouch={isTouch}
                                inlineOpen={isEffortInlineOpen}
                                onToggleInline={() =>
                                  setInlineDetailKey(isEffortInlineOpen ? null : effortNode.key)
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="w-28 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                            {effortNode.metrics.requestCount}
                          </TableCell>
                          <TableCell className="w-28 text-right font-mono text-sm text-destructive hidden sm:table-cell">
                            {effortNode.metrics.failureCount ?? 0}
                          </TableCell>
                          <TableCell className="w-64">
                            <MetricCell
                              primary={formatCompact(effortNode.metrics.totalTokens, locale)}
                              secondary={effortNode.metrics.cachedTokens > 0 ? formatCompact(effortNode.metrics.cachedTokens, locale) : undefined}
                              percent={effortPercentTokens}
                              barColor={rowColor}
                              trackColor="var(--muted)"
                            />
                          </TableCell>
                          <TableCell className="w-44 hidden md:table-cell">
                            <CacheRateCell
                              rate={effortNode.metrics.cacheHitRate}
                              cachedTokens={effortNode.metrics.cachedTokens}
                              locale={locale}
                            />
                          </TableCell>
                          <TableCell className="w-44">
                            <MetricCell
                              primary={formatCurrency(effortNode.metrics.costUsd, locale)}
                              percent={effortPercentCost}
                              barColor={rowColor}
                              trackColor="var(--muted)"
                            />
                          </TableCell>
                          <TableCell className="w-24 text-right hidden sm:table-cell" />
                        </TableRow>

                        {isTouch && isEffortInlineOpen ? (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={7}>
                              <ModelUsageDetail row={effortDetailRow} variant="inline" />
                            </TableCell>
                          </TableRow>
                        ) : null}

                        {renderSourceRows({
                          parentKey: effortNode.key,
                          parentMetrics: effortNode.metrics,
                          sources: effortNode.sources,
                          indentClass: "pl-12",
                        })}
                      </Fragment>
                    );
                  })
                : null}
            </Fragment>
          );
        })}
      </>
    );
  }

  if (view.groupBy === "canonical_effort") {
    return (
      <>
        {view.rows.map((row, idx) => {
          const rowColor = resolveModelColor(row.modelCanonical, modelColorMap, idx);
          const id = `${row.modelCanonical}::${row.effort ?? ""}`;
          const isSelected = selectedSet?.has(row.modelCanonical) ?? false;
          const isExpanded = expandedKeys.has(row.key);
          const isInlineOpen = inlineDetailKey === row.key;
          const detailRow = {
            model: row.modelCanonical,
            inputTokens: row.metrics.inputTokens,
            outputTokens: row.metrics.outputTokens,
            reasoningTokens: row.metrics.reasoningTokens,
            cachedTokens: row.metrics.cachedTokens,
            inputCostUsd: row.metrics.inputCostUsd,
            outputCostUsd: row.metrics.outputCostUsd,
            cachedCostUsd: row.metrics.cachedCostUsd,
            pricingConfigured: row.metrics.pricingConfigured,
          };

          return (
            <Fragment key={id}>
              <TableRow
                aria-selected={isSelected}
                style={{ borderLeftColor: isSelected ? rowColor : "transparent" }}
                className={cn(
                  "cursor-pointer border-l-4 transition-colors",
                  isSelected ? "bg-primary/5 shadow-inner" : "hover:bg-accent/10",
                )}
                onClick={() => onToggleModel(row.modelCanonical)}
              >
                <TableCell className="font-medium text-card-foreground">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(row.key);
                      }}
                    >
                      <ChevronRight
                        className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                        aria-label={isExpanded ? t("collapseRow") : t("expandRow")}
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rowColor }} />
                      <UiTooltip>
                        <UiTooltipTrigger asChild>
                          <span className={cn("truncate", isSelected && "font-semibold")}>{row.modelCanonical}</span>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top" className="font-mono text-xs">
                          {row.modelCanonical}
                        </UiTooltipContent>
                      </UiTooltip>
                    </button>
                    <ModelUsageDetailTrigger
                      row={detailRow}
                      isTouch={isTouch}
                      inlineOpen={isInlineOpen}
                      onToggleInline={() => setInlineDetailKey(inlineDetailKey === row.key ? null : row.key)}
                    />
                  </div>
                </TableCell>

                <TableCell className="font-mono text-sm text-muted-foreground text-right hidden sm:table-cell">
                  {row.metrics.requestCount}
                </TableCell>
                <TableCell className="font-mono text-sm text-right text-destructive hidden sm:table-cell">
                  {row.metrics.failureCount ?? 0}
                </TableCell>
                <TableCell>
                  <MetricCell
                    primary={formatCompact(row.metrics.totalTokens, locale)}
                    secondary={row.metrics.cachedTokens > 0 ? formatCompact(row.metrics.cachedTokens, locale) : undefined}
                    percent={maxTokens ? (row.metrics.totalTokens / maxTokens) * 100 : 0}
                    barColor={rowColor}
                    trackColor="var(--muted)"
                  />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <CacheRateCell rate={row.metrics.cacheHitRate} cachedTokens={row.metrics.cachedTokens} locale={locale} />
                </TableCell>
                <TableCell>
                  <MetricCell
                    primary={formatCurrency(row.metrics.costUsd, locale)}
                    percent={maxCost ? (row.metrics.costUsd / maxCost) * 100 : 0}
                    barColor={rowColor}
                    trackColor="var(--muted)"
                  />
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                  {effortLabel((row.effort ?? "unspecified") as EffortFilterValue)}
                </TableCell>
              </TableRow>

              {isTouch && isInlineOpen ? (
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={7}>
                    <ModelUsageDetail row={detailRow} variant="inline" />
                  </TableCell>
                </TableRow>
              ) : null}

              {renderSourceRows({
                parentKey: row.key,
                parentMetrics: row.metrics,
                sources: row.sources,
                indentClass: "pl-7",
              })}
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {view.rows.map((row, idx) => {
        const rowColor = resolveModelColor(row.modelRaw, modelColorMap, idx);
        const isSelected = selectedSet?.has(row.modelRaw) ?? false;
        const isExpanded = expandedKeys.has(row.key);
        const isInlineOpen = inlineDetailKey === row.key;
        const detailRow = {
          model: row.modelRaw,
          inputTokens: row.metrics.inputTokens,
          outputTokens: row.metrics.outputTokens,
          reasoningTokens: row.metrics.reasoningTokens,
          cachedTokens: row.metrics.cachedTokens,
          inputCostUsd: row.metrics.inputCostUsd,
          outputCostUsd: row.metrics.outputCostUsd,
          cachedCostUsd: row.metrics.cachedCostUsd,
          pricingConfigured: row.metrics.pricingConfigured,
        };

        return (
          <Fragment key={row.key}>
            <TableRow
              aria-selected={isSelected}
              style={{ borderLeftColor: isSelected ? rowColor : "transparent" }}
              className={cn(
                "cursor-pointer border-l-4 transition-colors",
                isSelected ? "bg-primary/5 shadow-inner" : "hover:bg-accent/10",
              )}
              onClick={() => onToggleModel(row.modelRaw)}
            >
              <TableCell className="font-medium text-card-foreground">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-left"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(row.key);
                    }}
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                      aria-label={isExpanded ? t("collapseRow") : t("expandRow")}
                    />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rowColor }} />
                    <UiTooltip>
                      <UiTooltipTrigger asChild>
                        <span className={cn("truncate", isSelected && "font-semibold")}>{row.modelRaw}</span>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top" className="font-mono text-xs">
                        {row.modelRaw}
                      </UiTooltipContent>
                    </UiTooltip>
                  </button>
                  <ModelUsageDetailTrigger
                    row={detailRow}
                    isTouch={isTouch}
                    inlineOpen={isInlineOpen}
                    onToggleInline={() => setInlineDetailKey(inlineDetailKey === row.key ? null : row.key)}
                  />
                </div>
              </TableCell>

              <TableCell className="font-mono text-sm text-muted-foreground text-right hidden sm:table-cell">
                {row.metrics.requestCount}
              </TableCell>
              <TableCell className="font-mono text-sm text-right text-destructive hidden sm:table-cell">
                {row.metrics.failureCount ?? 0}
              </TableCell>
              <TableCell>
                <MetricCell
                  primary={formatCompact(row.metrics.totalTokens, locale)}
                  secondary={row.metrics.cachedTokens > 0 ? formatCompact(row.metrics.cachedTokens, locale) : undefined}
                  percent={maxTokens ? (row.metrics.totalTokens / maxTokens) * 100 : 0}
                  barColor={rowColor}
                  trackColor="var(--muted)"
                />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <CacheRateCell rate={row.metrics.cacheHitRate} cachedTokens={row.metrics.cachedTokens} locale={locale} />
              </TableCell>
              <TableCell>
                <MetricCell
                  primary={formatCurrency(row.metrics.costUsd, locale)}
                  percent={maxCost ? (row.metrics.costUsd / maxCost) * 100 : 0}
                  barColor={rowColor}
                  trackColor="var(--muted)"
                />
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                —
              </TableCell>
            </TableRow>

            {isTouch && isInlineOpen ? (
              <TableRow className="bg-muted/20">
                <TableCell colSpan={7}>
                  <ModelUsageDetail row={detailRow} variant="inline" />
                </TableCell>
              </TableRow>
            ) : null}

            {renderSourceRows({
              parentKey: row.key,
              parentMetrics: row.metrics,
              sources: row.sources,
              indentClass: "pl-7",
            })}
          </Fragment>
        );
      })}
    </>
  );
}
