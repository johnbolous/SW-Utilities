"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card, FieldLabel, Input, Button } from "@/components/ui/primitives";

export default function SetupPage() {
  const router = useRouter();
  const { lang } = useThemeLang();
  const { t, dir } = useTranslation(lang);

  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasAdmin) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t("weakPasswordHint"));
      return;
    }

    setLoading(true);
    const res = await fetch("/api/setup/create-first-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, username, password, confirmPassword }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.error === "USERNAME_TAKEN") setError(t("usernameTaken"));
      else if (body.error === "ADMIN_ALREADY_EXISTS") router.replace("/login");
      else setError(t("setupFailed"));
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  if (checking) return null;

  return (
    <div dir={dir} className="min-h-dvh flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <img src="/icons/icon-128.png" alt="Silicon Waha" className="w-14 h-14 mb-3 rounded-lg" />
        <div className="font-display font-bold text-2xl mb-1">{t("setupTitle")}</div>
        <div className="text-sm text-brand-gray mb-6">{t("setupSubtitle")}</div>

        <form onSubmit={handleSubmit}>
          <FieldLabel>{t("fullName")}</FieldLabel>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mb-4" />

          <FieldLabel>{t("username")}</FieldLabel>
          <Input
            required
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4"
          />

          <FieldLabel>{t("password")}</FieldLabel>
          <Input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4"
          />

          <FieldLabel>{t("confirmPassword")}</FieldLabel>
          <Input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mb-5"
          />

          {error && <div className="mb-4 text-sm text-danger">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "…" : t("createAdministrator")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
