import { cn } from "@/lib/utils";

type Props = {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
};

export function LegendPill({ label, color, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
        active
          ? "bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        className={cn("h-2 w-2 rounded-full transition-transform", active && "scale-110 shadow")}
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </button>
  );
}
