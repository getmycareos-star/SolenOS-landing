import { notFound } from "next/navigation";
import Link from "next/link";
import { assertOpsAccess } from "@/lib/ops-console/access";
import { loadOpsDashboard } from "@/lib/ops-console/queries";
import "./ops-console.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SolenOS Ops",
  robots: { index: false, follow: false },
};

function Status({ value }: { value: string }) {
  const cls =
    value === "healthy" ? "ops-status-ok" : value === "warning" ? "ops-status-warn" : "";
  return <span className={cls}>{value}</span>;
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : null;
  if (!assertOpsAccess(key)) notFound();

  const eventFilter = typeof params.event === "string" ? params.event : null;
  const userSearch = typeof params.user === "string" ? params.user : null;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const data = await loadOpsDashboard({
    eventFilter,
    userSearch,
    page,
    pageSize: 50,
  });

  const keyQ = encodeURIComponent(key!);
  const base = `/ops?key=${keyQ}`;

  return (
    <div className="ops-console">
      <header className="ops-header">
        <div>
          <h1>SolenOS Ops Console</h1>
          <p className="ops-meta">Internal · product learning · system health · not public</p>
        </div>
        <div className="ops-meta">
          DB: <Status value={data.system.db_connected ? "healthy" : "warning"} />
          {" · "}
          Ingestion: <Status value={data.system.ingestion_health} />
          {data.system.query_latency_ms != null
            ? ` · ${data.system.query_latency_ms}ms`
            : null}
          {" · "}
          <Link href={`/ops/clarity?key=${keyQ}`}>Clarity quarantine</Link>
          {" · "}
          <Link href={`/ops/devtools?key=${keyQ}`}>Engine panels</Link>
        </div>
      </header>

      <section className="ops-section" aria-label="Founder snapshot">
        <h2>SolenOS Health Snapshot</h2>
        <div className="ops-snapshot">
          <div className="ops-stat">
            <span className="label">Users</span>
            <span className="value">{data.founder.users}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Active Care Cases</span>
            <span className="value">{data.founder.active_care_cases}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Returning Users</span>
            <span className="value">{data.founder.returning_users}</span>
          </div>
          <div className="ops-stat">
            <span className="label">7-Day Retention</span>
            <span className="value">{data.founder.retention_7d}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Care Records Reopened</span>
            <span className="value">{data.founder.care_records_reopened}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Appointment Prep</span>
            <span className="value">{data.founder.appointment_prep_sessions}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Open Errors</span>
            <span className="value">{data.founder.open_errors}</span>
          </div>
          <div className="ops-stat">
            <span className="label">Last Event</span>
            <span className="value" style={{ fontSize: 11 }}>
              {data.founder.last_event_received ?? "—"}
            </span>
          </div>
        </div>
      </section>

      <div className="ops-grid-2">
        <section className="ops-section">
          <h2>A · Overview (events)</h2>
          <div className="ops-panel">
            <div>Total users (event): {data.overview.total_users_event}</div>
            <div>New users 7d: {data.overview.new_users_7d}</div>
            <div>New users 30d: {data.overview.new_users_30d}</div>
            <div>DAU: {data.overview.dau}</div>
            <div>WAU: {data.overview.wau}</div>
            <div>Care cases (events): {data.overview.total_care_cases_event}</div>
          </div>
        </section>

        <section className="ops-section">
          <h2>Operational · Users table</h2>
          <div className="ops-panel">
            <div>Total registered: {data.operational_users.total_registered}</div>
            <div>Verified (email/auth): {data.operational_users.verified_users}</div>
            <div>Created 7d: {data.operational_users.created_7d}</div>
            <div>Created 30d: {data.operational_users.created_30d}</div>
            <div>Most recent signup: {data.operational_users.most_recent_signup ?? "—"}</div>
          </div>
        </section>

        <section className="ops-section">
          <h2>Operational · Care cases</h2>
          <div className="ops-panel">
            <div>Total: {data.operational_cases.total}</div>
            <div>Active: {data.operational_cases.active}</div>
            <div>Archived/closed: {data.operational_cases.archived}</div>
            <div>Created 7d: {data.operational_cases.created_7d}</div>
            <div>Created 30d: {data.operational_cases.created_30d}</div>
            <div>Avg per user: {data.operational_cases.avg_per_user}</div>
          </div>
        </section>

        <section className="ops-section">
          <h2>Care record health</h2>
          <div className="ops-panel">
            <div>With inputs: {data.care_record_health.with_inputs}</div>
            <div>With documents: {data.care_record_health.with_documents}</div>
            <div>Multiple sessions: {data.care_record_health.with_multiple_sessions}</div>
            <div>Revisited: {data.care_record_health.revisited}</div>
            <div>Empty: {data.care_record_health.empty}</div>
          </div>
        </section>
      </div>

      <section className="ops-section">
        <h2>B · Funnel</h2>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Event</th>
                <th>Count</th>
                <th>Conversion %</th>
                <th>Drop-off %</th>
              </tr>
            </thead>
            <tbody>
              {data.funnel.map((row) => (
                <tr key={row.step}>
                  <td>{row.step}</td>
                  <td>{row.event_name}</td>
                  <td>{row.count}</td>
                  <td>{row.conversion_pct ?? "—"}</td>
                  <td>{row.dropoff_pct ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ops-grid-2">
        <section className="ops-section">
          <h2>C · Engagement</h2>
          <div className="ops-panel">
            <div>Avg inputs / user: {data.engagement.avg_inputs_per_user}</div>
            <div>Avg sessions / user: {data.engagement.avg_sessions_per_user}</div>
            <div>
              Time to first care case (hrs):{" "}
              {data.engagement.time_to_first_care_case_hours ?? "—"}
            </div>
            <div style={{ marginTop: "0.5rem" }}>Top events:</div>
            <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
              {data.engagement.top_events.map((e) => (
                <li key={e.event_name}>
                  {e.event_name}: {e.count}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ops-section">
          <h2>D · Continuity</h2>
          <div className="ops-panel">
            <div>Returning users: {data.continuity.returning_users}</div>
            <div>7-day retention (users): {data.continuity.retention_7d}</div>
            <div>Care records reopened: {data.continuity.care_records_reopened}</div>
            <div>Appointment prep: {data.continuity.appointment_prep_sessions}</div>
            <div>Avg days between visits: {data.continuity.avg_days_between_visits ?? "—"}</div>
            <div>Return visit events: {data.continuity.return_visit_count}</div>
          </div>
        </section>
      </div>

      <section className="ops-section">
        <h2>E · Errors</h2>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>error_code</th>
                <th>count</th>
                <th>last_seen</th>
                <th>sample_message</th>
              </tr>
            </thead>
            <tbody>
              {data.errors.length === 0 ? (
                <tr>
                  <td colSpan={4}>No error_triggered events</td>
                </tr>
              ) : (
                data.errors.map((e) => (
                  <tr key={e.error_code}>
                    <td>{e.error_code}</td>
                    <td>{e.count}</td>
                    <td>{e.last_seen}</td>
                    <td className="meta">{e.sample_error_message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ops-section">
        <h2>System state</h2>
        <div className="ops-panel">
          <div>Total events: {data.system.total_events}</div>
          <div>Events 24h: {data.system.events_24h}</div>
          <div>Last event: {data.system.last_event_received ?? "—"}</div>
          <div>
            Ingestion: <Status value={data.system.ingestion_health} />
          </div>
          <div>
            Database: <Status value={data.system.db_connected ? "healthy" : "warning"} />
          </div>
        </div>
      </section>

      <section className="ops-section">
        <h2>F · Raw event stream</h2>
        <form className="ops-filters" method="get">
          <input type="hidden" name="key" value={key!} />
          <select name="event" defaultValue={eventFilter ?? ""}>
            <option value="">All events</option>
            {[
              "page_view",
              "signup_started",
              "signup_completed",
              "care_case_created",
              "input_submitted",
              "document_uploaded",
              "step_completed",
              "care_record_viewed",
              "appointment_preparation_opened",
              "return_visit",
              "error_triggered",
            ].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <input
            name="user"
            placeholder="user_id contains…"
            defaultValue={userSearch ?? ""}
          />
          <button type="submit">Filter</button>
        </form>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>timestamp</th>
                <th>user_id</th>
                <th>session_id</th>
                <th>event_name</th>
                <th>metadata</th>
              </tr>
            </thead>
            <tbody>
              {data.raw_events.map((e) => (
                <tr key={e.id}>
                  <td>{e.timestamp}</td>
                  <td>{e.user_id ?? "—"}</td>
                  <td>{e.session_id.slice(0, 12)}…</td>
                  <td>{e.event_name}</td>
                  <td className="meta">{JSON.stringify(e.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ops-pager">
          <span>
            Page {page} · {data.raw_total} matching
          </span>
          {page > 1 ? (
            <Link
              href={`${base}&page=${page - 1}${eventFilter ? `&event=${eventFilter}` : ""}${userSearch ? `&user=${userSearch}` : ""}`}
            >
              Prev
            </Link>
          ) : null}
          {page * 50 < data.raw_total ? (
            <Link
              href={`${base}&page=${page + 1}${eventFilter ? `&event=${eventFilter}` : ""}${userSearch ? `&user=${userSearch}` : ""}`}
            >
              Next
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
