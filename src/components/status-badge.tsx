import { cn } from "@/lib/utils";
import { statusTone, titleize, toneClass } from "@/lib/domain";

export function StatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = statusTone[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {titleize(value)}
    </span>
  );
}
