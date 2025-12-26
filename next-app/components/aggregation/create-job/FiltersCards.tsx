"use client";

import { useState } from "react";
import type { ComponentType, CSSProperties, WheelEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { AggregationChannel } from "@/app/pipeline/aggregation/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterOption = {
  id: string;
  label: string;
  description?: string;
  color?: string;
  Icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
};

type FiltersCardsProps = {
  modelOptions: FilterOption[];
  channelOptions: FilterOption[];
  selectedModels: string[];
  selectedChannels: AggregationChannel[];
  onModelsChange: (next: string[]) => void;
  onChannelsChange: (next: AggregationChannel[]) => void;
  disabled?: boolean;
  t: (key: string) => string;
};

type MultiSelectProps = {
  label: string;
  placeholder: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
  t: (key: string) => string;
};

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  searchPlaceholder,
  disabled,
  t,
}: MultiSelectProps) {
  const [openSelect, setOpenSelect] = useState(false);
  const allSelected = options.length > 0 && selected.length === options.length;
  const summary = !selected.length
    ? placeholder
    : allSelected
      ? t("all")
      : selected.length === 1
        ? options.find((opt) => opt.id === selected[0])?.label ?? selected[0]
        : `${selected.length} ${t("selected")}`;

  const toggle = (id: string) => {
    if (allSelected) {
      onChange([id]);
      return;
    }
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    onChange(next);
  };

  const renderBadges = () => {
    if (!selected.length) return null;
    const visible = selected
      .slice(0, 2)
      .map((id) => options.find((opt) => opt.id === id))
      .filter(Boolean) as FilterOption[];
    const rest = selected.length - visible.length;
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((opt) => (
          <Badge key={opt.id} variant="secondary" className="rounded-sm px-2 font-normal">
            {opt.label}
          </Badge>
        ))}
        {rest > 0 && (
          <Badge variant="outline" className="rounded-sm px-2 font-normal text-muted-foreground">
            +{rest}
          </Badge>
        )}
      </div>
    );
  };

  const handleListWheel = (event: WheelEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight <= target.clientHeight) return;
    event.stopPropagation();
    target.scrollTop += event.deltaY;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover open={openSelect} onOpenChange={setOpenSelect}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-10 w-full justify-between border-border/60 bg-background shadow-sm", "hover:bg-muted/40")}
            disabled={disabled}
          >
            <span className={cn("truncate text-sm", !selected.length && "text-muted-foreground")}>{summary}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 sm:w-[360px]" align="start" sideOffset={8}>
          <Command className="rounded-lg border shadow-sm max-h-[320px] min-h-0 sm:max-h-[360px]">
            {searchPlaceholder && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList className="flex-1 min-h-0 overflow-y-auto overscroll-contain" onWheel={handleListWheel}>
              <CommandEmpty>{t("noOptions")}</CommandEmpty>
              <CommandGroup heading={label}>
                <CommandItem value="__all__" onSelect={() => onChange(options.map((opt) => opt.id))}>
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      allSelected ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {allSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm">{t("all")}</span>
                </CommandItem>
                {options.map((opt) => {
                  const active = selected.includes(opt.id);
                  const Icon = opt.Icon;
                  return (
                    <CommandItem key={opt.id} value={`${opt.label} ${opt.id}`} onSelect={() => toggle(opt.id)}>
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                          active ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/40",
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </div>
                      {Icon ? <Icon className="h-4 w-4 shrink-0" style={{ color: opt.color }} /> : null}
                      <span className="truncate text-sm">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className="flex items-center justify-between border-t bg-muted/30 p-2">
              <span className="px-1 text-xs text-muted-foreground">
                {allSelected ? t("all") : `${t("selected")} ${selected.length}`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onChange(options.map((opt) => opt.id))}
                >
                  {t("all")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onChange([])}
                  disabled={!selected.length}
                >
                  {t("clear")}
                </Button>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {renderBadges()}
    </div>
  );
}

export function FiltersCards({
  modelOptions,
  channelOptions,
  selectedModels,
  selectedChannels,
  onModelsChange,
  onChannelsChange,
  disabled,
  t,
}: FiltersCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("aggregationModels")}</CardTitle>
          <CardDescription>{t("aggregationModelsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelect
            label={t("model")}
            placeholder={t("aggregationSelectModels")}
            options={modelOptions}
            selected={selectedModels}
            onChange={onModelsChange}
            searchPlaceholder={t("searchModel")}
            disabled={disabled}
            t={t}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("aggregationChannels")}</CardTitle>
          <CardDescription>{t("aggregationChannelsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelect
            label={t("channel")}
            placeholder={t("aggregationSelectChannels")}
            options={channelOptions}
            selected={selectedChannels}
            onChange={(next) => onChannelsChange(next as AggregationChannel[])}
            disabled={disabled}
            t={t}
          />
        </CardContent>
      </Card>
    </div>
  );
}
