import AccountSecurityFlow from "@/components/account/AccountSecurityFlow";

export const metadata = {
  title: "Verify email — SolenOS",
  description: "Verify your email address for your SolenOS account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string } | Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <main style={{ minHeight: "70vh", padding: "48px 18px", background: "#f7faf7" }}>
    <AccountSecurityFlow mode="verify-email" token={params.token || ""} />
  </main>;
}
