import { ImageResponse } from "next/og";

import { getAgentProfile } from "@/lib/dealers/profile";

/**
 * Dynamic OG image for a dealer profile: their banner (dimmed) behind the
 * business name + primary city, on the brand ground. Falls back to a solid brand
 * background when there's no banner.
 */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Property dealer on NivaasBhoomi";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgentProfile(slug);
  const name = agent?.businessName ?? "NivaasBhoomi Dealer";
  const city = agent?.coverageCities[0]?.name ?? "";
  const banner = agent?.bannerImage?.startsWith("https://res.cloudinary.com/")
    ? agent.bannerImage
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#1c1917",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner}
            width={1200}
            height={630}
            alt=""
            style={{ position: "absolute", inset: 0, objectFit: "cover", opacity: 0.35 }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            padding: 72,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", color: "#c46d32", fontSize: 30, fontWeight: 700 }}>
            NivaasBhoomi
          </div>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.1, marginTop: 16 }}>
            {name}
          </div>
          {city && (
            <div style={{ display: "flex", fontSize: 34, marginTop: 12, color: "#e7e5e4" }}>
              Verified property dealer · {city}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
