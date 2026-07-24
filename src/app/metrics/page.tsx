import { notFound } from "next/navigation";
import { assertMetricsAccess } from "@/lib/ops-console/access";
import { loadInvestorDashboard } from "@/lib/ops-console/queries";
import "../ops/ops-console.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SolenOS Metrics",
  robots: { index: false, follow: false },
};

function Status({ value }: { value: string }) {
  const cls =
    value === "healthy" ? "ops-status-ok" : value === "warning" ? "ops-status-warn" : "";
  return <span className={cls}>{value}</span>;
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : null;
  if (!assertMetricsAccess(key)) notFound();

  const data = await loadInvestorDashboard();

  return (
    <div className="ops-console">
      <header className="ops-header">
        <div>
          <h1>SolenOS Metrics</h1>
          <p className="ops-meta">Investor / advisor view · aggregated only · no PII</p>
        </div>
      </header>

      <p className="metrics-note">
        Aggregated company visibility only. No user IDs, sessions, raw events, or error
        payloads. Continuity health measures whether SolenOS is becoming caregivers&apos;
        external memory.
      </p>

      <section className="ops-section">
        <h2>A · Growth</h2>
        <div className="ops-snapshot">
          <div className="ops-stat">
            <span className="label">Registered users</span>
            <span className="value">{data.growth.total_registered_users}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Users 7d</span>
            <span className="value">{data.growth.users_created_7d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Users 30d</span>
            <span className="value">{data.growth.users_created_30d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Monthly growth %</span>
            <span className="value">{data.growth.monthly_growth_pct ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="ops-section">
        <h2>B · Product adoption</h2>
        <div className="ops-snapshot">
          <div className="ops-stat">
            <span className="label">Care cases</span>
            <span className="value">{data.adoption.total_care_cases}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Active</span>
            <span className="value">{data.adoption.active_care_cases}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Created 7d</span>
            <span className="value">{data.adoption.care_cases_created_7d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Created 30d</span>
            <span className="value">{data.adoption.care_cases_created_30d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Avg / user</span>
            <span className="value">{data.adoption.avg_care_cases_per_user}</span>
          </div>
        </div>
      </section>

      <section className="ops-section">
        <h2>C · Engagement</h2>
        <div className="ops-snapshot">
          <div className="ops-stat">
            <span className="label">Returning users</span>
            <span className="value">{data.engagement.returning_users}</span>
          </div>
          <div className="ops-stat">
            <span className="label">7d retention</span>
            <span className="value">{data.engagement.retention_7d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Avg sessions</span>
            <span className="value">{data.engagement.avg_sessions_per_user}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Avg inputs</span>
            <span className="value">{data.engagement.avg_inputs_per_user}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Records reopened</span>
            <span className="value">{data.engagement.care_records_reopened}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Appt prep</span>
            <span className="value">{data.engagement.appointment_prep_sessions}</span>
          </div>
        </div>
      </section>

      <section className="ops-section">
        <h2>D · Continuity health</h2>
        <div className="ops-snapshot">
          <div className="ops-stat">
            <span className="label">Records reopened</span>
            <span className="value">{data.continuity.care_records_reopened}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Avg days between visits</span>
            <span className="value">{data.continuity.avg_days_between_visits ?? "—"}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Multi-return users</span>
            <span className="value">{data.continuity.users_returning_multiple_times}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Multi-session cases</span>
            <span className="value">{data.continuity.care_cases_with_multiple_sessions}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Cases w/ documents</span>
            <span className="value">{data.continuity.care_cases_with_documents}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Cases w/ inputs</span>
            <span className="value">{data.continuity.care_cases_with_inputs}</span>
          </div>
        </div>
      </section>

      <section className="ops-section">
        <h2>E · System status</h2>
        <div className="ops-panel">
          <div>
            Platform: <Status value={data.system.platform_status} />
          </div>
          <div>Last event received: {data.system.last_event_received ?? "—"}</div>
          <div>
            Database: <Status value={data.system.database_status} />
          </div>
        </div>
      </section>
    </div>
  );
}
