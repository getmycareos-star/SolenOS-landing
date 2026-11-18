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
          padding: 16,
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
            d="M22 68V44C22 31.85 31.85 22 44 22S66 31.85 66 44V68"
            stroke={BRAND_COLORS.slate}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M32 68V44C32 37.37 37.37 32 44 32S56 37.37 56 44V68"
            stroke={BRAND_COLORS.sage}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M44 44V68M22 68H66"
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
