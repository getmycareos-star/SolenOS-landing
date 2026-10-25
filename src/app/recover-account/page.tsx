import AccountSecurityFlow from "@/components/account/AccountSecurityFlow";

export const metadata = {
  title: "Recover account — SolenOS",
  description: "Recover your SolenOS account with an expiring email link.",
};

export default async function RecoverAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <main style={{ minHeight: "70vh", padding: "48px 18px", background: "#f7faf7" }}>
    <AccountSecurityFlow mode="recover-account" token={params.token || ""} />
  </main>;
}
