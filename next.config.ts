import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // tailwind.config.js
  plugins: [
    require("tailwindcss-animate"),
    // other plugins...
  ],
};

export default nextConfig;
