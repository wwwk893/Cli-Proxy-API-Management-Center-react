"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/i18n-context";
import { useLegendDnD } from "../hooks/use-legend-dnd";
import { getModelColor } from "@/lib/model-colors";

type Props = {
  items: string[];
  visibleSet: Set<string>;
  focusModels: string[];
  onToggle: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
  colorMap?: Record<string, string>;
};

export function DraggableLegend({ items, visibleSet, focusModels, onToggle, onReorder, colorMap }: Props) {
  const { t } = useI18n();
  const { sensors, draggingId, collisionDetection, handleDragStart, handleDragEnd, handleDragCancel } = useLegendDnD({ onReorder });

  if (!items.length) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="mt-3 w-full rounded-xl border border-border/40 bg-muted/10 p-3 shadow-inner">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="font-semibold">{t("model")}</span>
          <span className="text-muted-foreground/70">{items.length}</span>
        </div>
        <div className="max-h-40 overflow-y-auto pr-1 [\&::-webkit-scrollbar]:w-1.5 [\&::-webkit-scrollbar-track]:bg-transparent [\&::-webkit-scrollbar-thumb]:rounded-full [\&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [\&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/40">
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((id) => {
                const active = visibleSet.size === 0 || visibleSet.has(id);
                return (
                  <LegendChip
                    key={id}
                    id={id}
                    active={active}
                    focused={focusModels.includes(id)}
                    onToggle={() => onToggle(id)}
                    dragging={draggingId === id}
                    colorMap={colorMap}
                  />
                );
              })}
            </div>
          </SortableContext>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggingId ? <LegendChipOverlay id={draggingId} active focused={focusModels.includes(draggingId)} colorMap={colorMap} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

type ChipProps = {
  id: string;
  active: boolean;
  focused: boolean;
  onToggle: () => void;
  dragging: boolean;
  colorMap?: Record<string, string>;
};

function LegendChip({ id, active, focused, onToggle, dragging, colorMap }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortableItem(id);
  const style = {
    transform,
    transition,
  };
  const color = colorMap?.[id] ?? getModelColor(id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group flex h-9 w-full items-center rounded-md border text-[11px] font-medium transition-all",
        active ? "bg-card border-border text-card-foreground shadow-sm" : "bg-muted/30 border border-dashed border-border/60 text-muted-foreground opacity-70",
        focused && "ring-1 ring-primary/60 shadow-md",
        dragging && "z-50 scale-[1.02] border-primary/40 shadow-xl ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder model"
        className={cn(
          "flex h-full w-8 shrink-0 cursor-grab items-center justify-center rounded-l-md border-r border-border/70 bg-muted/40 text-muted-foreground transition-colors",
          dragging && "cursor-grabbing",
        )}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={(event) => { event.preventDefault(); onToggle(); }} className="flex flex-1 items-center gap-2 overflow-hidden px-2 py-1 text-left">
        <span className={cn("h-2 w-2 shrink-0 rounded-full ring-1 ring-white/10", !active && "opacity-50")} style={{ backgroundColor: color }} />
        <UiTooltip>
          <TooltipTrigger asChild>
            <span className="truncate font-mono text-[11px] leading-none">{id}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] font-mono">
            {id}
          </TooltipContent>
        </UiTooltip>
      </button>
    </div>
  );
}

type OverlayProps = {
  id: string;
  active: boolean;
  focused: boolean;
  colorMap?: Record<string, string>;
};

function LegendChipOverlay({ id, active, focused, colorMap }: OverlayProps) {
  const color = colorMap?.[id] ?? getModelColor(id);
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center rounded-md border px-2 text-[11px] font-medium",
        active ? "bg-card border-border text-card-foreground" : "bg-muted/40 border border-dashed border-border/60 text-muted-foreground",
        "shadow-2xl ring-1 ring-primary/30",
        focused && "ring-2",
      )}
    >
      <div className="mr-2 flex h-full w-8 items-center justify-center rounded-l-md border-r border-border/70 bg-muted/40">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <span className={cn("h-2 w-2 shrink-0 rounded-full ring-1 ring-white/10", !active && "opacity-50")} style={{ backgroundColor: color }} />
        <span className="truncate font-mono text-[11px] leading-none">{id}</span>
      </div>
    </div>
  );
}

function useSortableItem(id: string) {
  const sortable = useSortable({ id });
  return {
    ...sortable,
    transform: CSS.Transform.toString(sortable.transform),
  };
}
