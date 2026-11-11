import type { Metadata } from "next";
import RestrictedRolePage from "@/components/RestrictedRolePage";

export const metadata: Metadata = {
  title: "SolenOS Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function TeamPage() {
  return <RestrictedRolePage role="SolenOS team" />;
}
