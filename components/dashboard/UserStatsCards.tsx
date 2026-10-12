"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, UserX } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card } from "@/components/ui/primitives";
import type { UserRole } from "@/types/database";

interface AdminUserRow {
  id: string;
  role: UserRole;
  is_active: boolean;
}

// Reads from the existing, unmodified /api/admin/users endpoint — this
// component only aggregates what that route already returns; it doesn't
// introduce any new query or business rule of its own.
export function UserStatsCards() {
  const { lang } = useThemeLang();
  const { t } = useTranslation(lang);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users?pageSize=100")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <Card className="text-sm text-danger">{t("loadFailed")}</Card>;
  }

  const total = users?.length ?? null;
  const active = users?.filter((u) => u.is_active).length ?? null;
  const disabled = users != null ? users.length - (active ?? 0) : null;
  const byRole = users
    ? { admin: users.filter((u) => u.role === "admin").length, engineer: users.filter((u) => u.role === "engineer").length, technician: users.filter((u) => u.role === "technician").length }
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard icon={Users} label={t("totalUsers")} value={total} />
      <StatCard icon={UserCheck} label={t("activeUsers")} value={active} tone="success" />
      <StatCard icon={UserX} label={t("disabledUsers")} value={disabled} tone={disabled ? "danger" : "neutral"} />
      <Card>
        <div className="text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-2">{t("usersByRole")}</div>
        {byRole ? (
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>{t("roleAdmin")}</span><span className="font-mono font-semibold">{byRole.admin}</span></div>
            <div className="flex justify-between"><span>{t("roleEngineer")}</span><span className="font-mono font-semibold">{byRole.engineer}</span></div>
            <div className="flex justify-between"><span>{t("roleTechnician")}</span><span className="font-mono font-semibold">{byRole.technician}</span></div>
          </div>
        ) : (
          <div className="text-sm text-brand-gray">…</div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: number | null;
  tone?: "neutral" | "success" | "danger";
}) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-brand-navy";
  return (
    <Card className="text-center">
      <Icon size={18} className={`mx-auto mb-1 ${color}`} />
      <div className={`font-display font-bold text-2xl ${color}`}>{value ?? "…"}</div>
      <div className="text-xs text-brand-gray">{label}</div>
    </Card>
  );
}
