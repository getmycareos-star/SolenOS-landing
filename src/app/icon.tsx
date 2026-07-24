import { ImageResponse } from "next/og";



import { BRAND_COLORS } from "@/lib/brand";



export const size = { width: 32, height: 32 };

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

          fontFamily: "system-ui, sans-serif",

          fontWeight: 600,

          fontSize: 14,

          letterSpacing: "-0.05em",

        }}

      >

        <span style={{ color: BRAND_COLORS.slate }}>s</span>

        <span style={{ color: BRAND_COLORS.sage }}>o</span>

      </div>

    ),

    { ...size },

  );

}


