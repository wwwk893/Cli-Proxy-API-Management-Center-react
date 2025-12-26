"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";

import type { AggregationChannel, AggregationFilters, AggregationMeta } from "@/app/pipeline/aggregation/types";
import { fetchAggregationEarliest, fetchAggregationMeta } from "@/components/aggregation/aggregation-jobs.api";
import { DataBoundaryCard } from "@/components/aggregation/create-job/DataBoundaryCard";
import { DateRangeCard } from "@/components/aggregation/create-job/DateRangeCard";
import { FiltersCards, type FilterOption } from "@/components/aggregation/create-job/FiltersCards";
import { PreviewCard } from "@/components/aggregation/create-job/PreviewCard";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-context";
import { getChannelColor, getChannelIcon } from "@/lib/channel-utils";

type CreateJobDialogProps = {
  open: boolean;
  defaultFrom: string;
  defaultTo: string;
  error: string | null;
  onError: (err: string | null) => void;
  onCreated: (params: { from: string; to: string; force: boolean; filters?: AggregationFilters }) => Promise<void>;
  onCancel: () => void;
};

type EarliestState = {
  eventTime: string | null;
  utcDate: string | null;
};

const toUtcDateString = (date: Date) => date.toISOString().slice(0, 10);
const parseUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
const formatLocalDateTime = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "-");
const MAX_RANGE_DAYS = 90;

export function CreateJobDialog({ open, defaultFrom, defaultTo, error, onError, onCreated, onCancel }: CreateJobDialogProps) {
  const { t } = useI18n();
  const [meta, setMeta] = useState<AggregationMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [earliest, setEarliest] = useState<EarliestState>({ eventTime: null, utcDate: null });
  const [earliestLoading, setEarliestLoading] = useState(false);
  const [earliestError, setEarliestError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<AggregationChannel[]>([]);
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [force, setForce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earliestRequestIdRef = useRef(0);

  useEffect(() => {
    if (open) return;
    onError(null);
    earliestRequestIdRef.current += 1;
    setInitialized(false);
    setMeta(null);
    setMetaError(null);
    setEarliest({ eventTime: null, utcDate: null });
    setEarliestError(null);
    setEarliestLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMetaLoading(true);
    setMetaError(null);
    onError(null);
    fetchAggregationMeta()
      .then((data) => {
        if (!active) return;
        setMeta(data);
      })
      .catch((err) => {
        if (!active) return;
        setMetaError(err instanceof Error ? err.message : t("aggregationMetaLoadFailed"));
      })
      .finally(() => {
        if (!active) return;
        setMetaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open || !meta || initialized) return;
    setSelectedModels(meta.models);
    setSelectedChannels(meta.channels);
    setFromDate(meta.earliestUtcDate ?? defaultFrom);
    setToDate(meta.yesterdayUtcDate ?? defaultTo);
    setEarliest({ eventTime: meta.earliestEventTime, utcDate: meta.earliestUtcDate });
    setForce(false);
    setSubmitting(false);
    setInitialized(true);
  }, [defaultFrom, defaultTo, initialized, meta, open]);

  const hasValidSelections = selectedModels.length > 0 && selectedChannels.length > 0;

  const maxDate = meta?.yesterdayUtcDate ?? defaultTo;
  const earliestUtcDate = earliest.utcDate ?? meta?.earliestUtcDate ?? null;
  const hasData = Boolean(earliestUtcDate);
  const minDate = earliestUtcDate ?? defaultFrom;
  const hasAvailableRange = Boolean(hasData && maxDate && minDate <= maxDate);

  useEffect(() => {
    if (!open || !meta || !initialized) return;
    if (!hasValidSelections) {
      earliestRequestIdRef.current += 1;
      setEarliest({ eventTime: null, utcDate: null });
      setEarliestError(null);
      setEarliestLoading(false);
      return;
    }
    const allModelsSelected = selectedModels.length === meta.models.length;
    const allChannelsSelected = selectedChannels.length === meta.channels.length;
    if (allModelsSelected && allChannelsSelected) {
      earliestRequestIdRef.current += 1;
      setEarliest({ eventTime: meta.earliestEventTime, utcDate: meta.earliestUtcDate });
      setEarliestError(null);
      setEarliestLoading(false);
      return;
    }
    const filters: AggregationFilters = {
      models: allModelsSelected ? undefined : selectedModels,
      channels: allChannelsSelected ? undefined : selectedChannels,
    };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++earliestRequestIdRef.current;
      setEarliestLoading(true);
      setEarliestError(null);
      try {
        const data = await fetchAggregationEarliest(filters);
        if (requestId !== earliestRequestIdRef.current || !open) return;
        setEarliest({ eventTime: data.earliestEventTime, utcDate: data.earliestUtcDate });
      } catch (err) {
        if (requestId !== earliestRequestIdRef.current || !open) return;
        setEarliestError(err instanceof Error ? err.message : t("aggregationEarliestLoadFailed"));
      } finally {
        if (requestId === earliestRequestIdRef.current && open) {
          setEarliestLoading(false);
        }
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [hasValidSelections, initialized, meta, open, selectedChannels, selectedModels, t]);

  useEffect(() => {
    if (!earliest.utcDate) return;
    if (!fromDate || fromDate < earliest.utcDate) {
      setFromDate(earliest.utcDate);
    }
  }, [earliest.utcDate, fromDate]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) {
      setToDate(fromDate);
    }
  }, [fromDate, toDate]);

  const dayCount = useMemo(() => {
    if (!hasAvailableRange || !fromDate || !toDate) return 0;
    return differenceInCalendarDays(parseUtcDate(toDate), parseUtcDate(fromDate)) + 1;
  }, [fromDate, hasAvailableRange, toDate]);
  const rangeTooLarge = hasAvailableRange && dayCount > MAX_RANGE_DAYS;
  const rangeTooLargeMessage = t("aggregationRangeTooLarge").replace("{max}", String(MAX_RANGE_DAYS));

  const modelOptions: FilterOption[] = (meta?.models ?? []).map((model) => ({
    id: model,
    label: model,
    description: model,
  }));

  const channelOptions: FilterOption[] = (meta?.channels ?? []).map((channel) => {
    const labelKey = channel === "cliproxy" ? "cliproxyGateway" : "codexCli";
    return {
      id: channel,
      label: t(labelKey),
      description: channel,
      Icon: getChannelIcon(channel),
      color: getChannelColor(channel),
    };
  });

  const applyRange = (days: number) => {
    if (!maxDate) return;
    const end = parseUtcDate(maxDate);
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    if (minDate) {
      const min = parseUtcDate(minDate);
      if (start < min) {
        setFromDate(minDate);
        setToDate(maxDate);
        return;
      }
    }
    setFromDate(toUtcDateString(start));
    setToDate(maxDate);
  };

  const applyAllRange = () => {
    if (!hasData || !maxDate) return;
    setFromDate(minDate);
    setToDate(maxDate);
  };

  const buildFilters = (): AggregationFilters | undefined => {
    if (!meta) return undefined;
    const allModelsSelected = selectedModels.length === meta.models.length;
    const allChannelsSelected = selectedChannels.length === meta.channels.length;
    if (allModelsSelected && allChannelsSelected) return undefined;
    return {
      models: allModelsSelected ? undefined : selectedModels,
      channels: allChannelsSelected ? undefined : selectedChannels,
    };
  };

  const submit = async () => {
    onError(null);
    if (!hasValidSelections) {
      onError(t("aggregationSelectRequired"));
      return;
    }
    if (!hasAvailableRange) {
      onError(t("aggregationNoAvailableRange"));
      return;
    }
    if (!fromDate || !toDate) {
      onError(t("aggregationDateRequired"));
      return;
    }
    if (rangeTooLarge) {
      onError(rangeTooLargeMessage);
      return;
    }
    setSubmitting(true);
    try {
      const fromIso = new Date(`${fromDate}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${toDate}T00:00:00.000Z`).toISOString();
      await onCreated({ from: fromIso, to: toIso, force, filters: buildFilters() });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("aggregationCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="w-[96vw] max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("triggerAggregation")}</DialogTitle>
        <DialogDescription>{t("aggregationSubtitle")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <DataBoundaryCard
          metaLoading={metaLoading}
          metaError={metaError}
          earliestLoading={earliestLoading}
          earliestError={earliestError}
          hasAvailableRange={hasAvailableRange}
          earliestEventTime={earliest.eventTime}
          formatLocalDateTime={formatLocalDateTime}
          t={t}
        />

        <FiltersCards
          modelOptions={modelOptions}
          channelOptions={channelOptions}
          selectedModels={selectedModels}
          selectedChannels={selectedChannels}
          onModelsChange={setSelectedModels}
          onChannelsChange={setSelectedChannels}
          disabled={metaLoading || Boolean(metaError)}
          t={t}
        />

        <DateRangeCard
          fromDate={fromDate}
          toDate={toDate}
          minDate={minDate}
          maxDate={maxDate}
          hasAvailableRange={hasAvailableRange}
          force={force}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onApplyRange={applyRange}
          onApplyAll={applyAllRange}
          onForceChange={setForce}
          t={t}
        />

        <PreviewCard
          modelCount={selectedModels.length}
          channelCount={selectedChannels.length}
          dayCount={dayCount}
          fromDate={fromDate}
          toDate={toDate}
          t={t}
        />

        {rangeTooLarge && <div className="text-xs text-destructive">{rangeTooLargeMessage}</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      <DialogFooter className="gap-2">
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            onError(null);
            onCancel();
          }}
          disabled={submitting}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={submitting || metaLoading || !hasAvailableRange || !hasValidSelections || rangeTooLarge}
        >
          {submitting ? t("loading") : t("create")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
