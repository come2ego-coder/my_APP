import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        washi: "#F7F3EA",
        sumi: "#2C2A28",
        indigo: {
          DEFAULT: "#3C5A66",
          dark: "#2E464F",
        },
        wakatake: "#6B8E7F",
        kocha: "#A67C52",
        shu: "#B8492E",
      },
      fontFamily: {
        mincho: [
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "YuMincho",
          "serif",
        ],
        gothic: [
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Yu Gothic",
          "Meiryo",
          "sans-serif",
        ],
      },
      boxShadow: {
        washi: "0 2px 10px rgba(44, 42, 40, 0.06)",
        washiLg: "0 6px 24px rgba(44, 42, 40, 0.10)",
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
