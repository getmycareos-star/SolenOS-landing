import { redirect } from "next/navigation";
import { preserveLegacySearchParams, type LegacySearchParams } from "@/lib/legacy-route-redirect";

/** Deep continuity is backend infrastructure, not a caregiver-facing page. */
export default async function DeepCareContinuityRedirect({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(preserveLegacySearchParams("/workspace/care-continuity", await searchParams));
}
