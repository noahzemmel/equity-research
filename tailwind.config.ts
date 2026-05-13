import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#13171c",
        panel2: "#1a1f26",
        edge: "#262d36",
        ink: "#e6e8eb",
        muted: "#8a93a0",
        accent: "#5eead4",
        pos: "#4ade80",
        neg: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
