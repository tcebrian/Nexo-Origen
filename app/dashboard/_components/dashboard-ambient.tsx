export function DashboardAmbient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="ambient-base absolute inset-0" />
      <div className="ambient-orb ambient-orb-violet absolute -left-[12%] top-[8%] h-[42vmin] w-[42vmin] rounded-full blur-[90px]" />
      <div className="ambient-orb ambient-orb-indigo absolute right-[-8%] top-[18%] h-[36vmin] w-[36vmin] rounded-full blur-[80px]" />
      <div className="ambient-orb ambient-orb-rose absolute bottom-[-6%] left-[22%] h-[32vmin] w-[32vmin] rounded-full blur-[88px]" />
      <div className="ambient-grid absolute inset-0 opacity-[0.35]" />
      <div className="ambient-vignette absolute inset-0" />
    </div>
  );
}
