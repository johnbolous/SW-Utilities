"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
type Lang = "en" | "ar";

interface Ctx {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
}

const ThemeLangContext = createContext<Ctx | null>(null);

export function useThemeLang() {
  const ctx = useContext(ThemeLangContext);
  if (!ctx) throw new Error("useThemeLang must be used inside ThemeLangProvider");
  return ctx;
}

/**
 * Reads the initial theme/language from localStorage (fast, no flash), then
 * reconciles with the signed-in user's saved preference via /api/me once the
 * session loads, and persists any change to both places via
 * /api/me/preferences. There's no browser Supabase client anymore — this
 * only ever talks to our own API routes.
 */
export function ThemeLangProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [lang, setLangState] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTheme = (localStorage.getItem("swup-theme") as Theme | null) ?? "dark";
    const storedLang = (localStorage.getItem("swup-lang") as Lang | null) ?? "en";
    setThemeState(storedTheme);
    setLangState(storedLang);
    setHydrated(true);

    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setThemeState(data.user.theme);
          setLangState(data.user.language);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme, lang, hydrated]);

  function persist(patch: Partial<{ theme: Theme; language: Lang }>) {
    fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("swup-theme", t);
    persist({ theme: t });
  }

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("swup-lang", l);
    persist({ language: l });
  }

  return (
    <ThemeLangContext.Provider value={{ theme, lang, setTheme, setLang }}>{children}</ThemeLangContext.Provider>
  );
}
