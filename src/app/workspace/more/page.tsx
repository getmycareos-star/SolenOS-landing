import Link from "next/link";
import { CaregiverHandoverInbox } from "@/components/mvp-workspace/CaregiverHandoverInbox";
import { WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";

export default function WorkspaceMorePage() {
  return (
    <div className="mobile-screen feature-page solenos-more-page">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">APP AND ACCOUNT</p>
        <h1>More</h1>
        <p>Manage your account, privacy, access and app preferences. Your day-to-day care information stays under Care information.</p>
      </header>
      <CaregiverHandoverInbox />
      <nav aria-label="App and account settings" className="solenos-care-explore__links">
        {WORKSPACE_SECONDARY_NAVIGATION.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.href}>
              <span aria-hidden="true"><Icon size={18} /></span>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
