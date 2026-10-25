import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import Community from "@/components/workflows/Community";

/**
 * Keep the Community implementation and route in source control, but make it
 * inaccessible while the feature is suspended. Re-enable through the flag.
 */
export default function CommunityPage() {
  if (!FEATURE_FLAGS.community || !FEATURE_FLAGS.professionalCommunity) {
    redirect("/workspace");
  }

  return (
    <div className="mobile-screen feature-page">
      <Community />
    </div>
  );
}
