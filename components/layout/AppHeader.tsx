"use client";

import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { UserRole } from "@/types/database";

const ROLE_LABEL_KEY: Record<UserRole, "roleTechnician" | "roleEngineer" | "roleAdmin"> = {
  technician: "roleTechnician",
  engineer: "roleEngineer",
  admin: "roleAdmin",
};

export function AppHeader({
  fullName,
  role,
  onMenuClick,
}: {
  fullName: string;
  role: UserRole;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const { lang, theme, setLang, setTheme } = useThemeLang();
  const { t, dir } = useTranslation(lang);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header dir={dir} className="border-b border-border">
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden p-1.5 -ms-1.5 text-brand-gray" aria-label="Open menu">
              <Menu size={20} />
            </button>
          )}
          <img src="/icons/icon-72.png" alt="" className="w-9 h-9 rounded-md hidden sm:block" />
          <div>
            <div className="font-display font-bold text-lg leading-none">{t("appName")}</div>
            <div className="text-xs text-brand-gray leading-none mt-1">
              {t("signedInAs")}: {fullName} · {t(ROLE_LABEL_KEY[role])}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ltr-only" dir="ltr">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-soft border border-border"
          >
            {lang === "en" ? "العربية" : "English"}
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-soft border border-border"
          >
            {theme === "dark" ? t("light") : t("dark")}
          </button>
          <button
            onClick={handleSignOut}
            className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/30"
          >
            {t("signOut")}
          </button>
        </div>
      </div>
    </header>
  );
}
