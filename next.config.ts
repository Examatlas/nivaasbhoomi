import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Cloudinary is the only media host (DEV-SPEC.txt Section 14).
  // Scoped to res.cloudinary.com so no other remote host can be proxied.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    // Mobile-first: 80% of traffic is mid-range Android. These widths map to
    // the real card/gallery sizes we render, so we never ship a 3840px variant.
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 96, 128, 200, 256, 400],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Trailing slashes off keeps canonical URLs single-form for SEO
  // (DEV-SPEC.txt Section 10: canonical always self-referencing).
  trailingSlash: false,

  poweredByHeader: false,
};

export default nextConfig;
