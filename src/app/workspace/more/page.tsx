import Link from "next/link";
import { WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";

export default function WorkspaceMorePage() {
  return (
    <div className="mobile-screen feature-page solenos-more-page">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">YOUR CARE RECORD</p>
        <h1>More</h1>
        <p>Open the tools you use less often. Your saved care information remains in the same Care Record.</p>
      </header>
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
