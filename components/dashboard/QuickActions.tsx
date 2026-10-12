"use client";

import Link from "next/link";
import { ClipboardList, Gauge, ShieldCheck, ArrowRight } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card } from "@/components/ui/primitives";
import type { UserRole } from "@/types/database";

const ACTIONS: { href: string; labelKey: "goToField" | "goToDesk" | "goToAdmin"; icon: typeof ClipboardList; roles: UserRole[] }[] = [
  { href: "/field", labelKey: "goToField", icon: ClipboardList, roles: ["technician", "engineer", "admin"] },
  { href: "/desk", labelKey: "goToDesk", icon: Gauge, roles: ["engineer", "admin"] },
  { href: "/admin", labelKey: "goToAdmin", icon: ShieldCheck, roles: ["admin"] },
];

export function QuickActions({ role, exclude }: { role: UserRole; exclude?: string }) {
  const { lang } = useThemeLang();
  const { t } = useTranslation(lang);
  const actions = ACTIONS.filter((a) => a.roles.includes(role) && a.href !== exclude);

  if (actions.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-2">{t("quickActions")}</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="flex items-center gap-3 hover:border-brand-navy/50 transition-colors">
              <a.icon size={18} className="text-brand-navy" />
              <span className="text-sm font-display font-semibold flex-1">{t(a.labelKey)}</span>
              <ArrowRight size={16} className="text-brand-gray" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
