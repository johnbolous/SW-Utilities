import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { FloorsPageContent } from "./FloorsPageContent";

export const metadata = { title: "Floors — Silicon Waha Utilities Portal" };

export default async function AdminFloorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active || user.role !== "admin") redirect("/unauthorized");

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <FloorsPageContent />
    </DashboardShell>
  );
}
