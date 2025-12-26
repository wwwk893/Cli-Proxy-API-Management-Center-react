"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useI18n } from "@/components/i18n-context";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip";
import { ModelUsageDetail, type ModelUsageDetailRow } from "@/components/charts/model-usage-detail";

type Props = {
  row: ModelUsageDetailRow;
  isTouch: boolean;
  inlineOpen: boolean;
  onToggleInline: () => void;
};

export function ModelUsageDetailTrigger({ row, isTouch, inlineOpen, onToggleInline }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isTouch) {
      onToggleInline();
    }
  };

  if (isTouch) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
          inlineOpen ? "bg-accent/40 text-foreground" : "hover:bg-accent/20 hover:text-foreground",
        )}
        aria-haspopup="dialog"
        aria-expanded={inlineOpen}
        aria-label={t("detailToggle")}
        onClick={handleClick}
      >
        <Info className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <UiTooltip>
        <UiTooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={t("detailToggle")}
              onClick={(event) => event.stopPropagation()}
            >
              <Info className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </UiTooltipTrigger>
        {!open ? (
          <UiTooltipContent side="top" className="max-w-[340px] p-3">
            <ModelUsageDetail row={row} variant="tooltip" />
          </UiTooltipContent>
        ) : null}
      </UiTooltip>
      <PopoverContent side="right" align="start" className="w-[360px]">
        <ModelUsageDetail row={row} variant="popover" />
      </PopoverContent>
    </Popover>
  );
}
