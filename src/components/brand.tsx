import { cn } from "@/lib/utils";

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent font-display text-sm font-bold text-accent-foreground">
        81
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block font-display text-sm font-bold tracking-tight">
            UNIFORM STUDIO
          </span>
          <span className="label-caps block">Order Management</span>
        </span>
      ) : null}
    </div>
  );
}
