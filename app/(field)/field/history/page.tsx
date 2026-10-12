import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReadingHistory } from "@/components/reading/ReadingHistory";

export const metadata = { title: "Reading History — Silicon Waha Utilities Portal" };

export default async function FieldHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/unauthorized");

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <ReadingHistory />
    </DashboardShell>
  );
}
