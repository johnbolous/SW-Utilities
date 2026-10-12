import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#003C70",
          gray: "#706F6F",
        },
        surface: {
          DEFAULT: "var(--surface)",
          soft: "var(--surface-soft)",
        },
        border: "var(--border)",
        low: "#B4790E",
        medium: "#33509C",
        solar: "#C46E12",
        water: "#0E7A8A",
        kiosk: "#7A3E9C",
        danger: "#A6402A",
        success: "#3E7F58",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
