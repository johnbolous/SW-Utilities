"use client";

import Link from "next/link";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card, Button } from "@/components/ui/primitives";

export default function UnauthorizedPage() {
  const { lang } = useThemeLang();
  const { t, dir } = useTranslation(lang);

  return (
    <div dir={dir} className="min-h-dvh flex items-center justify-center px-4">
      <Card className="max-w-sm text-center">
        <div className="font-display font-bold text-xl text-danger mb-2">{t("unauthorizedTitle")}</div>
        <p className="text-sm text-brand-gray mb-5">{t("unauthorizedBody")}</p>
        <Link href="/login">
          <Button variant="secondary">{t("backToLogin")}</Button>
        </Link>
      </Card>
    </div>
  );
}
