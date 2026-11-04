// Blocos de carregamento (shimmer) — substituem spinners e mantêm o layout
// estável. Use as variações prontas ou componha com <Skeleton className=…/>.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

// Card genérico com algumas linhas — bom placeholder de itens de lista.
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

// Lista de cards (placeholder de listagens: produtos, entregas, etc.)
export function SkeletonList({ count = 4, lines = 1 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

// Grade de "cartões de métrica" (placeholder de dashboards).
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ))}
    </div>
  );
}
