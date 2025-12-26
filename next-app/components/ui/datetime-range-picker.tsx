"use client";

import * as React from "react";
import { ChevronRight, Clock } from "lucide-react";
import type { DateRange, DayPickerProps } from "react-day-picker";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

// ---------- 简易时间 Select ----------
type TimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: number[];
  placeholder?: string;
  disabled?: boolean;
};

const TimeSelect: React.FC<TimeSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "--",
  disabled,
}) => {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-8 w-[60px] items-center justify-between rounded-md border border-input bg-transparent px-2 py-1",
          "text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "hover:bg-accent/50 transition-colors",
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          className="relative z-50 max-h-[200px] min-w-[60px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1">
            {options.map((option) => {
              const display = option.toString().padStart(2, "0");
              return (
                <SelectPrimitive.Item
                  key={display}
                  value={display}
                  className="relative flex w-full cursor-default select-none items-center justify-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <SelectPrimitive.ItemText>{display}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};

// ---------- 工具函数 + 内置预设 ----------
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isSameDay = (d1?: Date, d2?: Date) =>
  !!d1 && !!d2 && d1.toDateString() === d2.toDateString();

const isSameRange = (a?: DateRange, b?: DateRange) => {
  if (!a?.from || !a.to || !b?.from || !b.to) return false;
  return isSameDay(a.from, b.from) && isSameDay(a.to, b.to);
};

const PRESETS: { label: string; getValue: () => DateRange }[] = [
  {
    label: "今天",
    getValue: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    label: "昨天",
    getValue: () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  {
    label: "最近 7 天",
    getValue: () => {
      const now = new Date();
      const prev = new Date();
      prev.setDate(prev.getDate() - 6); // 包含今天
      return { from: startOfDay(prev), to: endOfDay(now) };
    },
  },
  {
    label: "最近 30 天",
    getValue: () => {
      const now = new Date();
      const prev = new Date();
      prev.setDate(prev.getDate() - 29);
      return { from: startOfDay(prev), to: endOfDay(now) };
    },
  },
  {
    label: "本月",
    getValue: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(first), to: endOfDay(now) };
    },
  },
];

// ---------- 主组件 ----------
export type DateTimeRangePickerProps = {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  minuteStep?: number;
} & Omit<DayPickerProps, "mode" | "selected" | "onSelect">;

export function DateTimeRangePicker({
  value,
  onChange,
  className,
  minuteStep = 5,
  numberOfMonths = 2,
  ...props
}: DateTimeRangePickerProps) {
  const safeStep = Math.min(30, Math.max(1, minuteStep));

  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => i),
    [],
  );

  const minutes = React.useMemo(() => {
    const result: number[] = [];
    for (let m = 0; m < 60; m += safeStep) result.push(m);
    return result;
  }, [safeStep]);

  const handleTimeChange = (
    type: "from" | "to",
    unit: "hours" | "minutes",
    val: string,
  ) => {
    if (!value?.[type]) return;

    const newDate = new Date(value[type]!);
    const intVal = parseInt(val, 10);

    if (unit === "hours") newDate.setHours(intVal);
    if (unit === "minutes") newDate.setMinutes(intVal);

    onChange({
      ...value,
      [type]: newDate,
    });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange(undefined);
      return;
    }

    let newFrom = range.from ? new Date(range.from) : undefined;
    let newTo = range.to ? new Date(range.to) : undefined;

    if (newFrom) {
      if (value?.from) {
        newFrom.setHours(
          value.from.getHours(),
          value.from.getMinutes(),
          value.from.getSeconds(),
          value.from.getMilliseconds(),
        );
      } else {
        newFrom = startOfDay(newFrom);
      }
    }

    if (newTo) {
      if (value?.to) {
        newTo.setHours(
          value.to.getHours(),
          value.to.getMinutes(),
          value.to.getSeconds(),
          value.to.getMilliseconds(),
        );
      } else {
        newTo = endOfDay(newTo);
      }
    }

    onChange({ from: newFrom, to: newTo });
  };

  const handlePresetClick = (preset: (typeof PRESETS)[number]) => {
    onChange(preset.getValue());
  };

  const formatDisplay = (d?: Date) => {
    if (!d) return "选择日期";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row overflow-hidden rounded-xl border bg-popover shadow-xl",
        className,
      )}
    >
      {/* 左侧预设 */}
      <div className="flex flex-col border-b sm:border-b-0 sm:border-r bg-muted/30 p-2 sm:w-36 overflow-y-auto">
        <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          快捷选择
        </div>
        <div className="flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
          {PRESETS.map((preset) => {
            const presetRange = preset.getValue();
            const isSelected = isSameRange(value, presetRange);

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "relative flex cursor-pointer items-center justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected && "bg-accent text-accent-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 右侧：日历 + 时间条 */}
      <div className="flex flex-col">
        {/* 日历 */}
        <div className="p-2">
          <Calendar
            mode="range"
            selected={value}
            onSelect={handleDateSelect}
            numberOfMonths={numberOfMonths}
            className="p-1"
            {...props}
          />
        </div>

        {/* 底部时间条 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/10 p-4">
          {/* 开始时间 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">开始</span>
            </div>
            <div className="flex items-center gap-1">
              <TimeSelect
                value={
                  value?.from
                    ? value.from.getHours().toString().padStart(2, "0")
                    : ""
                }
                onChange={(v) => handleTimeChange("from", "hours", v)}
                options={hours}
                disabled={!value?.from}
                placeholder="HH"
              />
              <span className="text-muted-foreground">:</span>
              <TimeSelect
                value={
                  value?.from
                    ? value.from.getMinutes().toString().padStart(2, "0")
                    : ""
                }
                onChange={(v) => handleTimeChange("from", "minutes", v)}
                options={minutes}
                disabled={!value?.from}
                placeholder="MM"
              />
            </div>
          </div>

          <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground/30" />

          {/* 结束时间 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">结束</span>
            </div>
            <div className="flex items-center gap-1">
              <TimeSelect
                value={
                  value?.to
                    ? value.to.getHours().toString().padStart(2, "0")
                    : ""
                }
                onChange={(v) => handleTimeChange("to", "hours", v)}
                options={hours}
                disabled={!value?.to}
                placeholder="HH"
              />
              <span className="text-muted-foreground">:</span>
              <TimeSelect
                value={
                  value?.to
                    ? value.to.getMinutes().toString().padStart(2, "0")
                    : ""
                }
                onChange={(v) => handleTimeChange("to", "minutes", v)}
                options={minutes}
                disabled={!value?.to}
                placeholder="MM"
              />
            </div>
          </div>
        </div>

        {/* 底部 summary（可选） */}
        <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground flex justify-between gap-2">
          <span>开始：{formatDisplay(value?.from)}</span>
          <span>结束：{formatDisplay(value?.to)}</span>
        </div>
      </div>
    </div>
  );
}
