import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import CommunityClient from "./CommunityClient";

export default function CommunityPage() {
  if (!FEATURE_FLAGS.community) {
    redirect("/workspace");
  }

  return <CommunityClient />;
}
