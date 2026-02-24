import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        scoreHigh: "#16a34a",
        scoreMedium: "#eab308",
        scoreLow: "#dc2626"
      }
    }
  },
  plugins: []
};

export default config;

