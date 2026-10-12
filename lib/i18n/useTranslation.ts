"use client";

import { useCallback, useMemo } from "react";
import en from "./en.json";
import ar from "./ar.json";

type Dict = typeof en;
const DICTS: Record<"en" | "ar", Dict> = { en, ar };

export function useTranslation(lang: "en" | "ar") {
  const dict = DICTS[lang];

  const t = useCallback(
    (key: keyof Dict, vars?: Record<string, string | number>) => {
      let str: string = dict[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [dict]
  );

  const dir = useMemo(() => (lang === "ar" ? "rtl" : "ltr"), [lang]);

  return { t, dir };
}
