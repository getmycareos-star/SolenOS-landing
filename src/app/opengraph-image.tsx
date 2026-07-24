import { ImageResponse } from "next/og";



import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";



export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";



export default function OpenGraphImage() {

  return new ImageResponse(

    (

      <div

        style={{

          width: "100%",

          height: "100%",

          display: "flex",

          flexDirection: "column",

          alignItems: "center",

          justifyContent: "center",

          background: BRAND_COLORS.paper,

          fontFamily: "system-ui, sans-serif",

        }}

      >

        <div

          style={{

            display: "flex",

            fontSize: 96,

            fontWeight: 600,

            letterSpacing: "-0.04em",

            marginBottom: 24,

          }}

        >

          <span style={{ color: BRAND_COLORS.slate }}>solen</span>

          <span style={{ color: BRAND_COLORS.sage }}>os</span>

        </div>

        <p style={{ fontSize: 32, color: BRAND_COLORS.muted, margin: 0 }}>{BRAND_TAGLINE}</p>

      </div>

    ),

    { ...size },

  );

}


