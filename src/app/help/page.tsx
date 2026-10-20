import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Help — SolenOS",
  description: "Help Center for SolenOS caregivers",
};

/** Help Center lives at /support for MVP — same content, simple route alias. */
export default function HelpPage() {
  redirect("/support");
}
