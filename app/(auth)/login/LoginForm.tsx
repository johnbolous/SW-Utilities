"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card, FieldLabel, Input, Button } from "@/components/ui/primitives";
import { useEffect } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, theme, setLang, setTheme } = useThemeLang();
  const { t, dir } = useTranslation(lang);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasAdmin) router.replace("/setup");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error === "ACCOUNT_DISABLED" ? t("accountDisabled") : t("invalidCredentials"));
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div dir={dir} className="min-h-dvh flex items-center justify-center px-4">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 flex gap-2 ltr-only" dir="ltr">
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
      </div>

      <Card className="w-full max-w-sm">
        <img src="/icons/icon-128.png" alt="Silicon Waha" className="w-14 h-14 mb-3 rounded-lg" />
        <div className="font-display font-bold text-2xl mb-1">{t("appNameFull")}</div>
        <div className="text-sm text-brand-gray mb-6">{t("signInToContinue")}</div>

        <form onSubmit={handleSubmit}>
          <FieldLabel>{t("username")}</FieldLabel>
          <Input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4"
          />
          <FieldLabel>{t("password")}</FieldLabel>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-5"
          />
          {error && <div className="mb-4 text-sm text-danger">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "…" : t("signIn")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
