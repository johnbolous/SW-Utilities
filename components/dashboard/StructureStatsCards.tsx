"use client";

import { useEffect, useState } from "react";
import { Building2, Zap, Gauge, Sun, Droplet, Store } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card } from "@/components/ui/primitives";
import { fetchStructure } from "@/lib/client/api";

// Reads from the existing, unmodified /api/structure endpoint — same data
// the technician's reading form already loads. Pure presentation-layer
// counting, no new query.
export function StructureStatsCards() {
  const { lang } = useThemeLang();
  const { t } = useTranslation(lang);
  const [counts, setCounts] = useState<{
    buildings: number; low: number; medium: number; solar: number; water: number; kiosks: number;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStructure()
      .then((s) =>
        setCounts({
          buildings: s.buildings.length,
          low: s.meters.filter((m) => m.category === "LOW").length,
          medium: s.meters.filter((m) => m.category === "MEDIUM").length,
          solar: s.solarInverters.length,
          water: s.waterMeters.length,
          kiosks: s.kiosks.length,
        })
      )
      .catch(() => setError(true));
  }, []);

  if (error) return <Card className="text-sm text-danger">{t("loadFailed")}</Card>;

  const items: { icon: typeof Building2; label: string; value: number | undefined; color: string }[] = [
    { icon: Building2, label: t("totalBuildings"), value: counts?.buildings, color: "text-brand-navy" },
    { icon: Zap, label: t("low"), value: counts?.low, color: "text-low" },
    { icon: Gauge, label: t("medium"), value: counts?.medium, color: "text-medium" },
    { icon: Sun, label: t("solar"), value: counts?.solar, color: "text-solar" },
    { icon: Droplet, label: t("water"), value: counts?.water, color: "text-water" },
    { icon: Store, label: t("kiosks"), value: counts?.kiosks, color: "text-kiosk" },
  ];

  return (
    <div>
      <div className="text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-2">{t("structureOverview")}</div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {items.map((it) => (
          <Card key={it.label} className="text-center">
            <it.icon size={17} className={`mx-auto mb-1 ${it.color}`} />
            <div className={`font-display font-bold text-xl ${it.color}`}>{it.value ?? "…"}</div>
            <div className="text-[11px] text-brand-gray">{it.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
