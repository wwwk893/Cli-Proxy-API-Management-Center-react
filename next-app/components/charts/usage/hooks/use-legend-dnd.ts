import { DragEndEvent, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";

type Props = {
  onReorder?: (fromId: string, toId: string) => void;
};

export function useLegendDnD({ onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active?.id;
    if (typeof id === "string") {
      setDraggingId(id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active?.id;
    const overId = event.over?.id;
    setDraggingId(null);
    if (!activeId || !overId) return;
    if (typeof activeId !== "string" || typeof overId !== "string") return;
    if (onReorder) {
      onReorder(activeId, overId);
    }
  };

  const handleDragCancel = () => setDraggingId(null);

  return {
    sensors,
    draggingId,
    collisionDetection: closestCenter,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } as const;
}
