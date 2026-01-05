"use client";

import { useMemo, useState } from "react";
import { Check, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-context";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";
import { formatChannelLabel, getChannelColor, getChannelIcon } from "@/lib/channel-utils";

const CHANNEL_OPTIONS = [
  { id: "cliproxy", labelKey: "cliproxyGateway" },
  { id: "codex", labelKey: "codexCli" },
  { id: "opencode", labelKey: "opencodeCli" },
] as const;

export function ChannelFilter() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const {
    state: { selectedChannels },
    actions: { setSelectedChannels },
  } = useUsageFilters();

  const label = useMemo(() => {
    if (!selectedChannels.length || selectedChannels.length === CHANNEL_OPTIONS.length) {
      return t("allChannels");
    }
    if (selectedChannels.length === 1) {
      const one = selectedChannels[0];
      const opt = CHANNEL_OPTIONS.find((o) => o.id === one);
      return opt ? t(opt.labelKey) : formatChannelLabel(one);
    }
    return `${selectedChannels.length} ${t("channel")}`;
  }, [selectedChannels, t]);

  const toggle = (id: string) => {
    const next = selectedChannels.includes(id)
      ? selectedChannels.filter((c) => c !== id)
      : [...selectedChannels, id];
    setSelectedChannels(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 border-dashed gap-2 px-3"
          title={t("channelTooltip")}
        >
          <Filter className="h-4 w-4" />
          <span className="truncate max-w-[160px]">{label}</span>
          {selectedChannels.length > 0 && selectedChannels.length < CHANNEL_OPTIONS.length ? (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selectedChannels.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start" sideOffset={8}>
        <Command className="rounded-lg border shadow-sm">
          <CommandList className="max-h-[260px]">
            <CommandEmpty> </CommandEmpty>
            <CommandGroup heading={t("channel")}>
              {CHANNEL_OPTIONS.map((opt) => {
                const isSelected = selectedChannels.includes(opt.id);
                const Icon = getChannelIcon(opt.id);
                const color = getChannelColor(opt.id);
                return (
                  <CommandItem
                    key={opt.id}
                    value={`${formatChannelLabel(opt.id)} ${opt.id}`}
                    onSelect={() => toggle(opt.id)}
                    className="flex items-center gap-2 pr-3"
                  >
                    <div
                      className={cn(
                        "mr-1 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="truncate flex-1">{t(opt.labelKey)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t bg-accent/20 p-2">
            <span className="px-2 text-xs text-muted-foreground">
              {selectedChannels.length > 0 && selectedChannels.length < CHANNEL_OPTIONS.length
                ? `${t("selected")} ${selectedChannels.length}`
                : t("allChannels")}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={() => setSelectedChannels(CHANNEL_OPTIONS.map((o) => o.id))}
              >
                {t("all")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setSelectedChannels([])}
                disabled={!selectedChannels.length}
              >
                {t("clear")}
              </Button>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
