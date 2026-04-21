import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — deep cold blue-black
        "surface-base":    "hsl(222, 20%, 6%)",
        "surface-raised":  "hsl(222, 18%, 9%)",
        "surface-over":    "hsl(222, 16%, 13%)",
        "surface-subtle":  "hsl(222, 14%, 17%)",
        "surface-border":  "hsl(218, 18%, 20%)",

        // Accents
        "gold":            "hsl(45, 96%, 54%)",
        "gold-dim":        "hsl(45, 70%, 36%)",
        "gold-bright":     "hsl(45, 100%, 68%)",
        "mint":            "hsl(165, 75%, 46%)",
        "mint-dim":        "hsl(165, 60%, 28%)",
        "rust":            "hsl(355, 78%, 60%)",
        "rust-dim":        "hsl(355, 60%, 38%)",

        // Text
        "ink":             "hsl(215, 25%, 90%)",
        "ink-2":           "hsl(215, 14%, 54%)",
        "ink-3":           "hsl(215, 12%, 35%)",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        mono:    ["var(--font-ibm-plex-mono)", "monospace"],
        sans:    ["var(--font-ibm-plex-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.05em" }],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
      animation: {
        "fade-up":     "fade-up 0.45s ease-out both",
        "fade-in":     "fade-in 0.35s ease-out both",
        "shimmer":     "shimmer 1.8s linear infinite",
        "flash-mint":  "flash-mint 0.7s ease-out forwards",
        "flash-rust":  "flash-rust 0.7s ease-out forwards",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "flash-mint": {
          "0%":   { color: "hsl(165, 75%, 46%)" },
          "100%": { color: "inherit" },
        },
        "flash-rust": {
          "0%":   { color: "hsl(355, 78%, 60%)" },
          "100%": { color: "inherit" },
        },
      },
      transitionTimingFunction: {
        "snappy": "cubic-bezier(0.2, 0, 0.1, 1)",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
