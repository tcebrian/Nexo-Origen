export default function DashboardLoading() {
  return (
    <div className="space-y-5 pt-2">
      <div className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}
