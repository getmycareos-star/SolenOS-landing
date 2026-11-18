import { ImageResponse } from "next/og";

import { BRAND_COLORS } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_COLORS.paper,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 88 88"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 72V42C13 24.9 26.9 11 44 11s31 13.9 31 31v30"
            stroke={BRAND_COLORS.sage}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 72V43c0-9.4 7.6-17 17-17s17 7.6 17 17v29"
            stroke={BRAND_COLORS.sage}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M44 43v29M9 72h70"
            stroke={BRAND_COLORS.sage}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
