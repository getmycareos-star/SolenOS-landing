import { redirect } from "next/navigation";
import { preserveLegacySearchParams, type LegacySearchParams } from "@/lib/legacy-route-redirect";

export default async function LegacyRecordRoute({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(preserveLegacySearchParams("/workspace/care-continuity", await searchParams));
}
