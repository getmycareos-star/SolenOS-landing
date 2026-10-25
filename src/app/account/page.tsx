import AccountSecurityFlow from "@/components/account/AccountSecurityFlow";

export const metadata = {
  title: "SolenOS account",
  description: "Sign in or create a SolenOS caregiver account.",
};

export default function AccountPage() {
  return <AccountSecurityFlow mode="account" />;
}
