/** solenos brand system — display identity, colors, placement rules. */



/** Always lowercase in user-facing surfaces. */

export const BRAND_NAME = "solenos" as const;



export const BRAND_TAGLINE = "The care journey, remembered." as const;



export const BRAND_MOTTO = "Preserve continuity. Build trust. Reduce burden." as const;



export const BRAND_PROMISE =

  "You no longer have to carry the entire care journey alone." as const;



/** Official palette — never invent alternative brand colors. */

export const BRAND_COLORS = {

  slate: "#3D4543",

  sage: "#7D8B75",

  paper: "#F8F6F2",

  muted: "#6B7280",

  hairline: "#D4D0C8",

} as const;



export const BRAND_PLACEMENT = {

  landing_header: true,

  auth_centered: true,

  sidebar_desktop: true,

  mobile_nav: true,

  loading_screen: true,

  care_records: false,

  event_cards: false,

  timelines: false,

} as const;



export const BRAND_PROHIBITED = [

  "SolenOS",

  "SOLENOS",

  "SOLENOS AI",

  "SolenOS AI",

  "recreate or redesign the logo",

  "distort stretch rotate simplify logo",

  "noisy logo backgrounds",

  "oversized logos in application",

  "logo inside care records or timelines",

  "playful animations on loading",

  "generic nagging notifications",

  "engagement optimization",

  "gamification",

] as const;



export const BRAND_PERSONALITY = [

  "calm",

  "thoughtful",

  "trustworthy",

  "quiet",

  "reassuring",

  "respectful",

] as const;



export const BRAND_ONE_RULE =

  "Every product decision should leave the caregiver with less cognitive burden than before they opened solenos." as const;


