/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        surface: "#FFFFFF",
        canvas: "#F8FAFC",
        slate2: "#64748B",
        teal: {
          DEFAULT: "#14B8A6",
          100: "#CCFBF1",
        },
        amber: {
          DEFAULT: "#F59E0B",
          100: "#FEF3C7",
        },
        green: "#22C55E",
        red: "#EF4444",
        violet: "#8B5CF6",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
}
