"use client";

import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  t: (key: string) => string;
};

function DatePicker({ label, value, onChange, min, max, disabled, t }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : undefined;
  const minDateValue = min ? parseISO(min) : undefined;
  const maxDateValue = max ? parseISO(max) : undefined;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-10 w-full justify-between border-border/60 bg-background", "hover:bg-muted/40")}
            disabled={disabled}
          >
            <span className={cn("text-sm", !value && "text-muted-foreground")}>
              {value || t("aggregationSelectDate")}
            </span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-none p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
            disabled={(date) => {
              if (disabled) return true;
              if (minDateValue && date < minDateValue) return true;
              if (maxDateValue && date > maxDateValue) return true;
              return false;
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type DateRangeCardProps = {
  fromDate: string;
  toDate: string;
  minDate?: string | null;
  maxDate?: string | null;
  hasAvailableRange: boolean;
  force: boolean;
  onFromChange: (next: string) => void;
  onToChange: (next: string) => void;
  onApplyRange: (days: number) => void;
  onApplyAll: () => void;
  onForceChange: (next: boolean) => void;
  t: (key: string) => string;
};

export function DateRangeCard({
  fromDate,
  toDate,
  minDate,
  maxDate,
  hasAvailableRange,
  force,
  onFromChange,
  onToChange,
  onApplyRange,
  onApplyAll,
  onForceChange,
  t,
}: DateRangeCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("aggregationRangeTitle")}</CardTitle>
        <CardDescription>{t("aggregationRangeHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            label={t("from")}
            value={fromDate}
            onChange={onFromChange}
            min={minDate ?? undefined}
            max={maxDate ?? undefined}
            disabled={!hasAvailableRange}
            t={t}
          />
          <DatePicker
            label={t("to")}
            value={toDate}
            onChange={onToChange}
            min={minDate ?? undefined}
            max={maxDate ?? undefined}
            disabled={!hasAvailableRange}
            t={t}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onApplyRange(7)} disabled={!hasAvailableRange}>
            {t("aggregationQuick7")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onApplyRange(30)} disabled={!hasAvailableRange}>
            {t("aggregationQuick30")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onApplyRange(90)} disabled={!hasAvailableRange}>
            {t("aggregationQuick90")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onApplyAll} disabled={!hasAvailableRange}>
            {t("aggregationQuickAll")}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={force} onChange={(e) => onForceChange(e.target.checked)} />
          {t("forceRerunExisting")}
        </label>
      </CardContent>
    </Card>
  );
}
