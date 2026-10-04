/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4ECDD",
        "paper-2": "#EADFC9",
        ink: "#2E241F",
        sepia: "#7A5C44",
        rose: "#C97B84",
        stamp: "#A63D40",
        sage: {
          DEFAULT: "#6F7F5E",
          ink: "#5A674C",
        },
        blue: "#2F4A6D",
        mustard: {
          DEFAULT: "#C99A2E",
          ink: "#7D5F1D",
        },
        demo: "#2A211C",
        line: "#D9CBB4",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["DM Serif Display", "Georgia", "serif"],
        type: ["Special Elite", "ui-monospace", "monospace"],
        script: ["Caveat", "cursive"],
      },
      boxShadow: {
        scrap: "0 1px 2px rgba(46,36,31,.08), 0 12px 28px rgba(46,36,31,.12)",
      },
      borderRadius: {
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
