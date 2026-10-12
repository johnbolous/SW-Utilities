"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Gauge,
  ShieldCheck,
  Users,
  Building2,
  Layers,
  Zap,
  Droplet,
  Sun,
  Store,
  MapPin,
  History,
  X,
} from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { UserRole } from "@/types/database";
import { DoorOpen } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  labelKey?: "navFieldEntry" | "navEngineerDesk" | "navAdministration";
  icon: typeof ClipboardList;
}

const TOP_NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  technician: [
    { href: "/field", label: "", labelKey: "navFieldEntry", icon: ClipboardList },
    { href: "/field/history", label: "History", icon: History },
  ],
  engineer: [
    { href: "/field", label: "", labelKey: "navFieldEntry", icon: ClipboardList },
    { href: "/desk", label: "", labelKey: "navEngineerDesk", icon: Gauge },
    { href: "/field/history", label: "History", icon: History },
  ],
  admin: [
    { href: "/field", label: "", labelKey: "navFieldEntry", icon: ClipboardList },
    { href: "/desk", label: "", labelKey: "navEngineerDesk", icon: Gauge },
    { href: "/admin", label: "", labelKey: "navAdministration", icon: ShieldCheck },
    { href: "/field/history", label: "History", icon: History },
  ],
};

const MASTER_DATA_NAV: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/parks", label: "Technology Parks", icon: MapPin },
  { href: "/admin/buildings", label: "Buildings", icon: Building2 },
  { href: "/admin/floors", label: "Floors", icon: Layers },
  { href: "/admin/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/admin/meters", label: "Electric Meters", icon: Zap },
  { href: "/admin/water-meters", label: "Water Meters", icon: Droplet },
  { href: "/admin/solar-inverters", label: "Solar Inverters", icon: Sun },
  { href: "/admin/kiosks", label: "Kiosks", icon: Store },
];

export function Sidebar({
  role,
  mobileOpen,
  onClose,
}: {
  role: UserRole;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { lang } = useThemeLang();
  const { t, dir } = useTranslation(lang);
  const topItems = TOP_NAV_BY_ROLE[role];

  function renderItem(item: NavItem) {
    const active = pathname === item.href || pathname?.startsWith(item.href + "/");
    const Icon = item.icon;
    const label = item.labelKey ? t(item.labelKey) : item.label;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-display font-semibold transition-colors ${
          active ? "bg-brand-navy text-white" : "text-brand-gray hover:bg-surface-soft"
        }`}
      >
        <Icon size={17} />
        {label}
      </Link>
    );
  }

  const content = (
    <div className="h-full flex flex-col bg-surface border-e border-border w-64">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <img src="/icons/icon-72.png" alt="" className="w-8 h-8 rounded-md" />
        <div className="font-display font-bold text-base leading-tight">{t("appName")}</div>
        <button onClick={onClose} className="ms-auto md:hidden p-1 text-brand-gray" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {topItems.map(renderItem)}

        {role === "admin" && (
          <>
            <div className="px-3 pt-4 pb-1.5 text-[11px] font-display font-semibold tracking-wide uppercase text-brand-gray opacity-70">
              Master Data
            </div>
            {MASTER_DATA_NAV.map(renderItem)}
          </>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop: static sidebar, always visible */}
      <aside className="hidden md:block shrink-0">{content}</aside>

      {/* Mobile: slide-in drawer with backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" dir={dir}>
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className={`absolute top-0 bottom-0 ${dir === "rtl" ? "right-0" : "left-0"} shadow-xl`}>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
