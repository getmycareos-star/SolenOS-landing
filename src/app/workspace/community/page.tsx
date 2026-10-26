import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import CommunityClient from "./CommunityClient";

export default function CommunityPage() {
  // Enforce the disabled state on the server so direct URL requests never
  // render Community UI or depend on client-side JavaScript to redirect.
  if (!FEATURE_FLAGS.community || !FEATURE_FLAGS.professionalCommunity) {
    redirect("/workspace");
  }

  return <CommunityClient />;
}
