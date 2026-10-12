import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { RoomsPageContent } from "./RoomsPageContent";

export const metadata = {
  title: "Rooms — Silicon Waha Utilities Portal",
};

export default async function AdminRoomsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.is_active || user.role !== "admin") {
    redirect("/unauthorized");
  }

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <RoomsPageContent />
    </DashboardShell>
  );
}