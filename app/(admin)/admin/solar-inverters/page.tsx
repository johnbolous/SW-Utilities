import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SolarInvertersPageContent } from "./SolarInvertersPageContent";

export const metadata = { title: "Solar Inverters — Silicon Waha Utilities Portal" };

export default async function AdminSolarInvertersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active || user.role !== "admin") redirect("/unauthorized");

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <SolarInvertersPageContent />
    </DashboardShell>
  );
}
