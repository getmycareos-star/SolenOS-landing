import { ImageResponse } from "next/og";

import { BRAND_COLORS } from "@/lib/brand";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            d="M19 68V44C19 30.19 30.19 19 44 19S69 30.19 69 44V68"
            stroke={BRAND_COLORS.slate}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M30 68V44C30 36.27 36.27 30 44 30S58 36.27 58 44V68"
            stroke={BRAND_COLORS.sage}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M44 44V68M19 68H69"
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
