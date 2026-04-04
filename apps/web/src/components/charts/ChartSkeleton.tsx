'use client';

export function ChartSkeleton() {
  return (
    <div className="h-60 flex items-end gap-1 px-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-slate-100 animate-pulse rounded-t"
          style={{
            height: `${20 + Math.random() * 60}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}
