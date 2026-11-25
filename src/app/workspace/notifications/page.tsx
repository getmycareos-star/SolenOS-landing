import Link from "next/link";
import { NotificationsCenter } from "@/components/mvp-workspace/NotificationsCenter";

export default function NotificationsPage() {
  return (
    <section className="mobile-screen feature-page solenos-notifications-page" aria-labelledby="solenos-notifications-title">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">CARE UPDATES</p>
        <h1 id="solenos-notifications-title">Notifications</h1>
        <p>See updates from your care record and reminders. Reading a notification does not resolve a care matter that still needs attention.</p>
        <p><Link href="/workspace/open-loops">Review matters that still need attention</Link></p>
      </header>
      <NotificationsCenter />
    </section>
  );
}
