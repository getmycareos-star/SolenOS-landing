import AccountSecurityFlow from "@/components/account/AccountSecurityFlow";

export const metadata = {
  title: "Reset password — SolenOS",
  description: "Request a secure password reset or choose a new password.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <main style={{ minHeight: "70vh", padding: "48px 18px", background: "#f7faf7" }}>
    <AccountSecurityFlow mode="reset-password" token={params.token || ""} />
  </main>;
}
