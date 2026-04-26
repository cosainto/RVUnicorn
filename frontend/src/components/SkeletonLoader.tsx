// ── Reusable Skeleton Loader Components ─────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="h-40 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          style={{ width: i === lines - 1 ? '60%' : `${85 + Math.random() * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
