import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        canvas: "var(--paper)",
        subtle: "var(--surface-soft)",
        divider: "var(--line-strong)",
        line: "var(--line)",
        control: "var(--line-strong)",
        ink: "var(--ink)",
        ink2: "var(--ink-2)",
        onink: "var(--on-ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: { DEFAULT: "var(--accent-deep)", hover: "var(--accent-hover)", subtle: "var(--accent-soft)" },
        accent: { DEFAULT: "var(--accent)", on: "var(--on-accent)" },
        success: { DEFAULT: "var(--green)", subtle: "var(--green-soft)", ink: "var(--green-ink)" },
        warning: { DEFAULT: "var(--amber)", subtle: "var(--amber-soft)", ink: "var(--amber-ink)" },
        error: { DEFAULT: "var(--red)", subtle: "var(--red-soft)", ink: "var(--red-ink)" },
        info: { DEFAULT: "var(--blue)", subtle: "var(--blue-soft)" },
      },
      fontFamily: {
        ui: ["var(--font-ui)"],
        heading: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { sm: "var(--r-sm)", control: "var(--r)", surface: "var(--r-lg)", xl: "var(--r-xl)" },
      boxShadow: { surface: "var(--shadow-surface)", floating: "var(--shadow)", modal: "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
export default config;
