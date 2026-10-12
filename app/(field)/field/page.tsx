import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReadingEntryScreen } from "@/components/reading/ReadingEntryScreen";

export const metadata = { title: "Field — Silicon Waha Utilities Portal" };

export default async function FieldPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/unauthorized");
  // Any active role may use the field module (technicians live here;
  // engineers/admins can also log a reading if needed) — matches
  // middleware.ts's ROLE_REQUIREMENTS for /field. Unchanged from before.

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <ReadingEntryScreen userId={user.id} />
    </DashboardShell>
  );
}
