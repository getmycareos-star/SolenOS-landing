import Link from "next/link";
import { WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";
import { HistoryDrawer } from "@/components/app-shell/HistoryDrawer";
import { CaregiverHandoverInbox } from "@/components/mvp-workspace/CaregiverHandoverInbox";

export default function WorkspaceMorePage() {
  return (
    <div className="mobile-screen feature-page solenos-more-page">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">YOUR CARE RECORD</p>
        <h1>More</h1>
        <p>Open the tools you use less often. Your saved care information remains in the same Care Record.</p>
      </header>
      <section className="solenos-more-history-section" aria-labelledby="solenos-more-history-heading">
        <h2 id="solenos-more-history-heading">Recent care history</h2>
        <HistoryDrawer />
        <p><Link href="/workspace/timeline">View all care history</Link></p>
      </section>
      <CaregiverHandoverInbox />
      <nav aria-label="More care record tools" className="solenos-care-explore__links">
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
