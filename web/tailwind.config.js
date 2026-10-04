/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBF8F3",
        mist: "#F5F6F8",
        ink: {
          DEFAULT: "#0E1424",
          2: "#1A2236",
        },
        line: "#E7E2D9",
        muted: "#6B7280",
        held: {
          DEFAULT: "#B45309",
          bg: "#FEF3C7",
        },
        release: {
          DEFAULT: "#0F766E",
          bg: "#CCFBF1",
        },
        home: {
          DEFAULT: "#15803D",
          bg: "#DCFCE7",
        },
        alert: {
          DEFAULT: "#BE123C",
          bg: "#FFE4E6",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        vault: "0 1px 2px rgba(14,20,36,.06), 0 8px 24px rgba(14,20,36,.06)",
      },
      borderRadius: {
        card: "20px",
        btn: "14px",
      },
      transitionDuration: {
        vault: "200ms",
      },
      transitionTimingFunction: {
        vault: "ease-out",
      },
    },
  },
  plugins: [],
}
