"use client";

import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UserStatsCards } from "@/components/dashboard/UserStatsCards";
import { StructureStatsCards } from "@/components/dashboard/StructureStatsCards";
import { QuickActions } from "@/components/dashboard/QuickActions";

export function AdminDashboardContent() {
  const { lang } = useThemeLang();
  const { t, dir } = useTranslation(lang);

  return (
    <div dir={dir} className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="font-display font-bold text-2xl">{t("admin")}</div>
        <div className="text-sm text-brand-gray">{t("adminDashboardTitle")}</div>
      </div>

      <UserStatsCards />
      <StructureStatsCards />
      <QuickActions role="admin" exclude="/admin" />
    </div>
  );
}
