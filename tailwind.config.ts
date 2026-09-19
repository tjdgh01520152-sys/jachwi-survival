import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 리디자인 팔레트 (design_handoff_jachwi_survival)
        ink: "#12140F",
        paper: "#FAF6E8",
        moss: "#B7D48F",
        mossdot: "#9BBE72",
        coin: "#F5D547",
        ramen: "#E5533D",
        cool: "#7FB8E8",
        // 구형 팔레트. 새 화면은 위 토큰만 쓰지만, 아직 참조하는 곳이 남아 있을 수 있어 유지.
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
      fontFamily: {
        heading: ["var(--font-black-han-sans)", "sans-serif"],
        body: ["var(--font-gothic-a1)", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(0,0,0,0.06)",
        hardLg: "8px 8px 0 #12140F",
        hard: "6px 6px 0 #12140F",
        hardSm: "5px 5px 0 #12140F",
        hardBtn: "7px 7px 0 #12140F",
        hardPress: "3px 3px 0 #12140F",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0) rotate(-1deg)" },
          "50%": { transform: "translateY(-7px) rotate(1deg)" },
        },
        blink: {
          "0%, 92%, 100%": { opacity: "1" },
          "95%": { opacity: "0.15" },
        },
        shimmer: {
          "0%": { backgroundPosition: "140% 0" },
          "100%": { backgroundPosition: "-40% 0" },
        },
        steam: {
          "0%": { transform: "translateY(0) scaleX(1)", opacity: "0" },
          "25%": { opacity: "0.9" },
          "100%": { transform: "translateY(-22px) scaleX(1.5)", opacity: "0" },
        },
        bar: {
          "0%": { width: "8%" },
          "60%": { width: "72%" },
          "100%": { width: "96%" },
        },
      },
      animation: {
        bob: "bob 3.4s ease-in-out infinite",
        "bob-fast": "bob 1.6s ease-in-out infinite",
        blink: "blink 5s infinite",
        shimmer: "shimmer 1.2s linear infinite",
        steam: "steam 2.2s ease-out infinite",
        bar: "bar 1.8s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
