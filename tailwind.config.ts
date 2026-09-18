import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff8f0",
          100: "#ffefdb",
          200: "#ffdcb0",
          300: "#ffc27a",
          400: "#ff9f42",
          500: "#ff7d1a",
          600: "#f06100",
          700: "#c74a00",
          800: "#9c3a05",
          900: "#7e320c",
        },
      },
      boxShadow: {
        card: "0 2px 10px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
