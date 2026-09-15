import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-surface)",
        canvas: "var(--color-canvas)",
        subtle: "var(--color-surface-subtle)",
        divider: "var(--color-divider)",
        control: "var(--color-border-control)",
        ink: "var(--color-text)",
        muted: "var(--color-text-secondary)",
        primary: { DEFAULT: "var(--color-primary)", hover: "var(--color-primary-hover)", subtle: "var(--color-primary-subtle)" },
        success: { DEFAULT: "var(--color-success)", subtle: "var(--color-success-subtle)" },
        warning: { DEFAULT: "var(--color-warning)", subtle: "var(--color-warning-subtle)" },
        error: { DEFAULT: "var(--color-error)", subtle: "var(--color-error-subtle)" },
        info: { DEFAULT: "var(--color-info)", subtle: "var(--color-info-subtle)" },
      },
      fontFamily: {
        ui: ["var(--font-ui)"],
        heading: ["var(--font-heading)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { sm: "var(--radius-small)", control: "var(--radius-control)", surface: "var(--radius-surface)" },
      boxShadow: { surface: "var(--shadow-surface)", floating: "var(--shadow-floating)", modal: "var(--shadow-modal)" },
    },
  },
  plugins: [],
};
export default config;
