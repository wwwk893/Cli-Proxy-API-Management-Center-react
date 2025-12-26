import { RefObject, useEffect } from "react";

type Params = {
  focusedId: string | null;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  containerRef: RefObject<HTMLDivElement>;
  watchKey?: string | number | boolean | null;
};

export function useFocusScroll({ focusedId, cardRefs, containerRef, watchKey }: Params) {
  useEffect(() => {
    if (!focusedId) return;
    const node = cardRefs.current.get(focusedId);
    const container = containerRef.current;
    if (!node || !container) return;
    const nodeRect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isAbove = nodeRect.top < containerRect.top;
    const isBelow = nodeRect.bottom > containerRect.bottom;
    if (isAbove || isBelow) {
      const offset = node.offsetTop - container.offsetTop;
      const targetScroll = offset - container.clientHeight / 3;
      if (Number.isFinite(targetScroll)) {
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
      } else {
        node.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedId, cardRefs, containerRef, watchKey]);
}
