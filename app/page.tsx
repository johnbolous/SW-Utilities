import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  engineer: "/desk",
  technician: "/field",
};

export default async function RootPage() {
  const supabase = createAdminClient();
  const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(ROLE_HOME[user.role] ?? "/field");
}
