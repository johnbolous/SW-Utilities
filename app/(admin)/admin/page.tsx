import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminDashboardContent } from "./AdminDashboardContent";

export const metadata = { title: "Admin — Silicon Waha Utilities Portal" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/unauthorized");
  if (user.role !== "admin") redirect("/unauthorized");

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <AdminDashboardContent />
    </DashboardShell>
  );
}
