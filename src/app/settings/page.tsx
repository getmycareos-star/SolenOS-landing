import { redirect } from "next/navigation";

export const metadata = {
  title: "Settings — SolenOS",
  description: "Manage your SolenOS profile, privacy, notifications, and account preferences.",
};

export default function LegacySettingsPage() {
  redirect("/workspace/settings");
}
