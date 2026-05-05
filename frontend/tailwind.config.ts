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
        // Surfaces — pure black family
        "surface-base":    "hsl(0, 0%, 2%)",
        "surface-raised":  "hsl(0, 0%, 5%)",
        "surface-over":    "hsl(0, 0%, 8%)",
        "surface-subtle":  "hsl(0, 0%, 12%)",
        "surface-border":  "rgba(255,255,255,0.08)",

        // Accents
        "gold":            "hsl(45, 90%, 58%)",
        "gold-dim":        "hsl(45, 60%, 32%)",
        "gold-bright":     "hsl(45, 100%, 68%)",
        "mint":            "hsl(165, 65%, 44%)",
        "mint-dim":        "hsl(165, 55%, 26%)",
        "rust":            "hsl(355, 68%, 56%)",
        "rust-dim":        "hsl(355, 55%, 36%)",

        // Text — pure white scale
        "ink":             "#ffffff",
        "ink-2":           "hsl(0, 0%, 55%)",
        "ink-3":           "hsl(0, 0%, 28%)",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
        mono:    ["var(--font-ibm-plex-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.05em" }],
      },
      borderRadius: {
        sm:      "4px",
        DEFAULT: "8px",
        md:      "12px",
        lg:      "16px",
        xl:      "24px",
        full:    "9999px",
      },
      backdropBlur: {
        xs: "4px",
      },
      animation: {
        "fade-up":    "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":    "fade-in 0.35s ease-out both",
        "shimmer":    "shimmer 2s linear infinite",
        "flash-mint": "flash-mint 0.7s ease-out forwards",
        "flash-rust": "flash-rust 0.7s ease-out forwards",
        "spin-slow":  "spin 8s linear infinite",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
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
          "0%":   { color: "hsl(165, 65%, 44%)" },
          "100%": { color: "inherit" },
        },
        "flash-rust": {
          "0%":   { color: "hsl(355, 68%, 56%)" },
          "100%": { color: "inherit" },
        },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
