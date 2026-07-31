import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-card" />
      ))}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
