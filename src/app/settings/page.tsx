import { redirect } from "next/navigation";
import { preserveLegacySearchParams, type LegacySearchParams } from "@/lib/legacy-route-redirect";

export const metadata = {
  title: "Settings — SolenOS",
  description: "Manage your SolenOS profile, privacy, notifications, and account preferences.",
};

export default async function LegacySettingsPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(preserveLegacySearchParams("/workspace/settings", await searchParams));
}
