import { Skeleton } from "@/components/ui/skeleton";

// Skeletons reaproveitados pelos loading.tsx de cada rota — aparecem só
// dentro de <main> (Sidebar/Header já ficam montados, ver AppShell), então
// não tem "flash" de tela em branco/piscando durante o carregamento dos
// dados, só o conteúdo pulsando suavemente até a página real chegar.

export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>

      <Skeleton className="h-12 w-full max-w-md rounded-xl" />

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="border-b border-outline-variant bg-surface-container-low px-6 py-3">
          <Skeleton className="h-4 w-full max-w-3xl" />
        </div>
        <div className="divide-y divide-outline-variant">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-stack-lg">
      <Skeleton className="h-5 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
        <div className="lg:col-span-8 space-y-stack-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-stack-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <div className="px-4 lg:px-6 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-card border border-border bg-card p-3.5 space-y-2.5">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    </div>
  );
}
