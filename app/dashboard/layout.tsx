import { redirect } from "next/navigation";
import { AuthProvider } from "./_components/auth-context";
import { DateRangeProvider } from "./_components/date-range-context";
import { DashboardShell } from "./_components/dashboard-shell";
import { getAuthSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <AuthProvider session={session}>      <DateRangeProvider>
        <DashboardShell>{children}</DashboardShell>
      </DateRangeProvider>
    </AuthProvider>
  );
}
