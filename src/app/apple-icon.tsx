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
            d="M13 72V42C13 24.88 26.88 11 44 11S75 24.88 75 42V72"
            stroke={BRAND_COLORS.slate}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M26 72V43C26 33.06 34.06 25 44 25S62 33.06 62 43V72"
            stroke={BRAND_COLORS.sage}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M44 43V72M13 72H75"
            stroke={BRAND_COLORS.slate}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
