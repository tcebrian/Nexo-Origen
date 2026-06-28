type PremiumSkeletonProps = {
  className?: string;
};

export function PremiumSkeleton({ className = "" }: PremiumSkeletonProps) {
  return <div className={`nexo-skeleton ${className}`} aria-hidden />;
}

export function PremiumSkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="nexo-skeleton h-3 rounded-md"
          style={{ width: `${Math.max(42, 100 - index * 14)}%` }}
        />
      ))}
    </div>
  );
}
