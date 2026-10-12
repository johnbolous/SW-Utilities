import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { WaterMetersPageContent } from "./WaterMetersPageContent";

export const metadata = { title: "Water Meters — Silicon Waha Utilities Portal" };

export default async function AdminWaterMetersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active || user.role !== "admin") redirect("/unauthorized");

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <WaterMetersPageContent />
    </DashboardShell>
  );
}
