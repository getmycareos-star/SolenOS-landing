/**
 * Read-only Ops Console queries — solen_events + production tables.
 * Operational tables take precedence for current state.
 */

import type { Pool } from "pg";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { getMemorySolenEvents } from "./insert-event";

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

async function querySafe<T extends Record<string, unknown>>(
  pool: Pool | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!pool) return [];
  try {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } catch {
    return [];
  }
}

async function scalar(
  pool: Pool | null,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const rows = await querySafe<{ v: string | number | null }>(pool, sql, params);
  const v = rows[0]?.v;
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

export type FunnelStep = {
  step: string;
  event_name: string;
  count: number;
  conversion_pct: number | null;
  dropoff_pct: number | null;
};

export type ErrorRow = {
  error_code: string;
  count: number;
  last_seen: string;
  sample_error_message: string;
};

export type RawEventRow = {
  id: number;
  timestamp: string;
  user_id: string | null;
  session_id: string;
  event_name: string;
  metadata: Record<string, unknown>;
};

export type OpsDashboardData = {
  founder: {
    users: number;
    active_care_cases: number;
    returning_users: number;
    retention_7d: number;
    care_records_reopened: number;
    appointment_prep_sessions: number;
    open_errors: number;
    last_event_received: string | null;
  };
  overview: {
    total_users_event: number;
    new_users_7d: number;
    new_users_30d: number;
    dau: number;
    wau: number;
    total_care_cases_event: number;
  };
  operational_users: {
    total_registered: number;
    verified_users: number;
    created_7d: number;
    created_30d: number;
    most_recent_signup: string | null;
  };
  operational_cases: {
    total: number;
    active: number;
    archived: number;
    created_7d: number;
    created_30d: number;
    avg_per_user: number;
  };
  care_record_health: {
    with_inputs: number;
    with_documents: number;
    with_multiple_sessions: number;
    revisited: number;
    empty: number;
  };
  funnel: FunnelStep[];
  engagement: {
    avg_inputs_per_user: number;
    avg_sessions_per_user: number;
    top_events: Array<{ event_name: string; count: number }>;
    time_to_first_care_case_hours: number | null;
  };
  continuity: {
    returning_users: number;
    retention_7d: number;
    care_records_reopened: number;
    appointment_prep_sessions: number;
    avg_days_between_visits: number | null;
    return_visit_count: number;
  };
  errors: ErrorRow[];
  system: {
    total_events: number;
    events_24h: number;
    last_event_received: string | null;
    ingestion_health: "healthy" | "warning" | "unknown";
    db_connected: boolean;
    query_latency_ms: number | null;
  };
  raw_events: RawEventRow[];
  raw_total: number;
};

export type InvestorDashboardData = {
  growth: {
    total_registered_users: number;
    users_created_7d: number;
    users_created_30d: number;
    monthly_growth_pct: number | null;
  };
  adoption: {
    total_care_cases: number;
    active_care_cases: number;
    care_cases_created_7d: number;
    care_cases_created_30d: number;
    avg_care_cases_per_user: number;
  };
  engagement: {
    returning_users: number;
    retention_7d: number;
    avg_sessions_per_user: number;
    avg_inputs_per_user: number;
    care_records_reopened: number;
    appointment_prep_sessions: number;
  };
  continuity: {
    care_records_reopened: number;
    avg_days_between_visits: number | null;
    users_returning_multiple_times: number;
    care_cases_with_multiple_sessions: number;
    care_cases_with_documents: number;
    care_cases_with_inputs: number;
  };
  system: {
    platform_status: "healthy" | "warning" | "unknown";
    last_event_received: string | null;
    database_status: "healthy" | "warning" | "unknown";
  };
};

function memoryEventCounts() {
  const events = getMemorySolenEvents();
  return events;
}

async function buildFunnel(pool: Pool | null): Promise<FunnelStep[]> {
  const steps: Array<{ step: string; event_name: string; filter?: string }> = [
    { step: "Landing", event_name: "page_view" },
    { step: "Signup Started", event_name: "signup_started" },
    { step: "Signup Completed", event_name: "signup_completed" },
    { step: "First Input", event_name: "input_submitted" },
    { step: "Care Case Created", event_name: "care_case_created" },
    {
      step: "Step 3 Reached",
      event_name: "step_completed",
      filter: `event_name = 'step_completed' AND metadata->>'step_name' = 'step3'`,
    },
  ];

  const counts: number[] = [];
  if (pool) {
    for (const s of steps) {
      const sql = s.filter
        ? `SELECT COUNT(*)::int AS v FROM solen_events WHERE ${s.filter}`
        : `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = $1`;
      counts.push(await scalar(pool, sql, s.filter ? [] : [s.event_name]));
    }
  } else {
    const mem = memoryEventCounts();
    for (const s of steps) {
      if (s.filter) {
        counts.push(
          mem.filter(
            (e) =>
              e.event_name === "step_completed" &&
              e.metadata?.step_name === "step3",
          ).length,
        );
      } else {
        counts.push(mem.filter((e) => e.event_name === s.event_name).length);
      }
    }
  }

  return steps.map((s, i) => {
    const count = counts[i] ?? 0;
    const prev = i === 0 ? null : counts[i - 1] ?? 0;
    const conversion_pct =
      i === 0 || prev == null || prev === 0
        ? i === 0
          ? 100
          : null
        : Math.round((count / prev) * 1000) / 10;
    const dropoff_pct =
      conversion_pct == null ? null : Math.round((100 - conversion_pct) * 10) / 10;
    return {
      step: s.step,
      event_name: s.event_name,
      count,
      conversion_pct,
      dropoff_pct: i === 0 ? null : dropoff_pct,
    };
  });
}

export async function loadOpsDashboard(input?: {
  eventFilter?: string | null;
  userSearch?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<OpsDashboardData> {
  const pool = await getPool();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(20, input?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  let queryLatency: number | null = null;
  let dbConnected = false;
  if (pool) {
    const t0 = Date.now();
    try {
      await pool.query("SELECT 1");
      queryLatency = Date.now() - t0;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  }

  const [
    totalUsersEvent,
    newUsers7d,
    newUsers30d,
    dau,
    wau,
    careCasesEvent,
    totalRegistered,
    verifiedUsers,
    users7d,
    users30d,
    recentSignupRows,
    casesTotal,
    casesActive,
    casesArchived,
    cases7d,
    cases30d,
    withInputs,
    withDocs,
    emptyCases,
  ] = await Promise.all([
    scalar(pool, `SELECT COUNT(DISTINCT user_id)::int AS v FROM solen_events WHERE user_id IS NOT NULL`),
    scalar(
      pool,
      `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'signup_completed' AND timestamp > NOW() - INTERVAL '7 days'`,
    ),
    scalar(
      pool,
      `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'signup_completed' AND timestamp > NOW() - INTERVAL '30 days'`,
    ),
    scalar(
      pool,
      `SELECT COUNT(DISTINCT user_id)::int AS v FROM solen_events WHERE user_id IS NOT NULL AND timestamp > NOW() - INTERVAL '24 hours'`,
    ),
    scalar(
      pool,
      `SELECT COUNT(DISTINCT user_id)::int AS v FROM solen_events WHERE user_id IS NOT NULL AND timestamp > NOW() - INTERVAL '7 days'`,
    ),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'care_case_created'`),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM users`),
    scalar(
      pool,
      `SELECT COUNT(*)::int AS v FROM users WHERE auth_enabled = true OR email IS NOT NULL`,
    ),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM users WHERE created_at > NOW() - INTERVAL '7 days'`),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM users WHERE created_at > NOW() - INTERVAL '30 days'`),
    querySafe<{ created_at: string }>(
      pool,
      `SELECT created_at FROM users ORDER BY created_at DESC LIMIT 1`,
    ),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM cases`),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM cases WHERE status = 'active'`),
    scalar(
      pool,
      `SELECT COUNT(*)::int AS v FROM cases WHERE status IN ('archived', 'closed')`,
    ),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM cases WHERE created_at > NOW() - INTERVAL '7 days'`),
    scalar(pool, `SELECT COUNT(*)::int AS v FROM cases WHERE created_at > NOW() - INTERVAL '30 days'`),
    scalar(
      pool,
      `SELECT COUNT(DISTINCT c.id)::int AS v FROM cases c
       WHERE EXISTS (SELECT 1 FROM care_events ce WHERE ce.care_record_id = c.id)`,
    ),
    scalar(
      pool,
      `SELECT COUNT(DISTINCT c.id)::int AS v FROM cases c
       WHERE EXISTS (
         SELECT 1 FROM care_events ce
         WHERE ce.care_record_id = c.id AND ce.source_type = 'document'
       )
       OR EXISTS (
         SELECT 1 FROM system_events se
         WHERE se.case_id = c.id AND se.event_type = 'document_uploaded'
       )`,
    ),
    scalar(
      pool,
      `SELECT COUNT(*)::int AS v FROM cases c
       WHERE NOT EXISTS (SELECT 1 FROM care_events ce WHERE ce.care_record_id = c.id)
         AND NOT EXISTS (
           SELECT 1 FROM system_events se
           WHERE se.case_id = c.id AND se.event_type = 'document_uploaded'
         )`,
    ),
  ]);

  const avgCasesPerUser =
    totalRegistered > 0 ? Math.round((casesTotal / totalRegistered) * 100) / 100 : 0;

  const withMultiSessions = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM (
       SELECT metadata->>'case_id' AS case_id
       FROM solen_events
       WHERE metadata->>'case_id' IS NOT NULL
       GROUP BY metadata->>'case_id'
       HAVING COUNT(DISTINCT session_id) >= 2
     ) t`,
  );

  const revisited = await scalar(
    pool,
    `SELECT COUNT(DISTINCT metadata->>'case_id')::int AS v
     FROM solen_events
     WHERE event_name = 'care_record_viewed' AND metadata->>'case_id' IS NOT NULL`,
  );

  const funnel = await buildFunnel(pool);

  const inputCount = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'input_submitted'`,
  );
  const distinctUsersForInputs = await scalar(
    pool,
    `SELECT COUNT(DISTINCT user_id)::int AS v FROM solen_events WHERE user_id IS NOT NULL`,
  );
  const sessionCount = await scalar(
    pool,
    `SELECT COUNT(DISTINCT session_id)::int AS v FROM solen_events`,
  );

  const topEvents = await querySafe<{ event_name: string; count: string | number }>(
    pool,
    `SELECT event_name, COUNT(*)::int AS count
     FROM solen_events
     GROUP BY event_name
     ORDER BY count DESC
     LIMIT 10`,
  );

  const ttfRows = await querySafe<{ hours: string | number }>(
    pool,
    `WITH first_views AS (
       SELECT user_id, MIN(timestamp) AS t0
       FROM solen_events
       WHERE event_name = 'page_view' AND user_id IS NOT NULL
       GROUP BY user_id
     ),
     first_cases AS (
       SELECT user_id, MIN(timestamp) AS t1
       FROM solen_events
       WHERE event_name = 'care_case_created' AND user_id IS NOT NULL
       GROUP BY user_id
     )
     SELECT AVG(EXTRACT(EPOCH FROM (fc.t1 - fv.t0)) / 3600.0) AS hours
     FROM first_views fv
     JOIN first_cases fc ON fc.user_id = fv.user_id
     WHERE fc.t1 >= fv.t0`,
  );
  const ttfHours = ttfRows[0]?.hours != null ? Number(ttfRows[0].hours) : null;

  const returningUsers = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM (
       SELECT user_id
       FROM solen_events
       WHERE user_id IS NOT NULL
       GROUP BY user_id
       HAVING COUNT(DISTINCT DATE(timestamp AT TIME ZONE 'UTC')) >= 2
     ) t`,
  );

  const retention7d = await scalar(
    pool,
    `WITH first_day AS (
       SELECT user_id, MIN(DATE(timestamp AT TIME ZONE 'UTC')) AS d0
       FROM solen_events
       WHERE user_id IS NOT NULL
       GROUP BY user_id
     ),
     returned AS (
       SELECT DISTINCT e.user_id
       FROM solen_events e
       JOIN first_day f ON f.user_id = e.user_id
       WHERE DATE(e.timestamp AT TIME ZONE 'UTC') > f.d0
         AND DATE(e.timestamp AT TIME ZONE 'UTC') <= f.d0 + 7
     )
     SELECT COUNT(*)::int AS v FROM returned`,
  );

  const careRecordsReopened = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'care_record_viewed'`,
  );
  const aptPrep = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'appointment_preparation_opened'`,
  );
  const returnVisitCount = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM solen_events WHERE event_name = 'return_visit'`,
  );

  const avgGapRows = await querySafe<{ days: string | number }>(
    pool,
    `WITH days AS (
       SELECT user_id, DATE(timestamp AT TIME ZONE 'UTC') AS d
       FROM solen_events
       WHERE user_id IS NOT NULL
       GROUP BY user_id, DATE(timestamp AT TIME ZONE 'UTC')
     ),
     gaps AS (
       SELECT user_id,
              EXTRACT(EPOCH FROM (d::timestamp - LAG(d::timestamp) OVER (PARTITION BY user_id ORDER BY d))) / 86400.0 AS gap_days
       FROM days
     )
     SELECT AVG(gap_days) AS days FROM gaps WHERE gap_days IS NOT NULL AND gap_days > 0`,
  );

  const errors = await querySafe<{
    error_code: string;
    count: string | number;
    last_seen: string;
    sample_error_message: string;
  }>(
    pool,
    `SELECT
       COALESCE(metadata->>'error_code', 'UNKNOWN') AS error_code,
       COUNT(*)::int AS count,
       MAX(timestamp)::text AS last_seen,
       MAX(metadata->>'error_message') AS sample_error_message
     FROM solen_events
     WHERE event_name = 'error_triggered'
     GROUP BY COALESCE(metadata->>'error_code', 'UNKNOWN')
     ORDER BY count DESC
     LIMIT 20`,
  );

  const totalEvents = await scalar(pool, `SELECT COUNT(*)::int AS v FROM solen_events`);
  const events24h = await scalar(
    pool,
    `SELECT COUNT(*)::int AS v FROM solen_events WHERE timestamp > NOW() - INTERVAL '24 hours'`,
  );
  const lastEventRows = await querySafe<{ timestamp: string }>(
    pool,
    `SELECT timestamp::text AS timestamp FROM solen_events ORDER BY timestamp DESC LIMIT 1`,
  );

  // Memory fallback when DB empty
  const mem = memoryEventCounts();
  const useMemory = !pool || (totalEvents === 0 && mem.length > 0);

  let rawEvents: RawEventRow[] = [];
  let rawTotal = 0;

  if (useMemory) {
    let filtered = [...mem].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    if (input?.eventFilter) {
      filtered = filtered.filter((e) => e.event_name === input.eventFilter);
    }
    if (input?.userSearch) {
      filtered = filtered.filter((e) => (e.user_id ?? "").includes(input.userSearch!));
    }
    rawTotal = filtered.length;
    rawEvents = filtered.slice(offset, offset + pageSize);
  } else {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.eventFilter) {
      params.push(input.eventFilter);
      clauses.push(`event_name = $${params.length}`);
    }
    if (input?.userSearch) {
      params.push(`%${input.userSearch}%`);
      clauses.push(`user_id ILIKE $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    rawTotal = await scalar(pool, `SELECT COUNT(*)::int AS v FROM solen_events ${where}`, params);
    params.push(pageSize, offset);
    const rows = await querySafe<{
      id: string | number;
      timestamp: string;
      user_id: string | null;
      session_id: string;
      event_name: string;
      metadata: Record<string, unknown>;
    }>(
      pool,
      `SELECT id, timestamp::text AS timestamp, user_id, session_id, event_name, metadata
       FROM solen_events ${where}
       ORDER BY timestamp DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    rawEvents = rows.map((r) => ({
      id: Number(r.id),
      timestamp: r.timestamp,
      user_id: r.user_id,
      session_id: r.session_id,
      event_name: r.event_name,
      metadata: r.metadata ?? {},
    }));
  }

  const lastEvent =
    lastEventRows[0]?.timestamp ??
    (mem.length > 0 ? mem[mem.length - 1]!.timestamp : null);

  let ingestion: "healthy" | "warning" | "unknown" = "unknown";
  if (lastEvent) {
    const ageMin = (Date.now() - new Date(lastEvent).getTime()) / 60000;
    ingestion = ageMin <= 15 ? "healthy" : "warning";
  } else if (dbConnected) {
    ingestion = "warning";
  }

  const openErrors = errors.reduce((n, e) => n + Number(e.count), 0);

  return {
    founder: {
      users: totalRegistered || totalUsersEvent,
      active_care_cases: casesActive || careCasesEvent,
      returning_users: returningUsers,
      retention_7d: retention7d,
      care_records_reopened: careRecordsReopened,
      appointment_prep_sessions: aptPrep,
      open_errors: openErrors,
      last_event_received: lastEvent,
    },
    overview: {
      total_users_event: totalUsersEvent,
      new_users_7d: newUsers7d,
      new_users_30d: newUsers30d,
      dau,
      wau,
      total_care_cases_event: careCasesEvent,
    },
    operational_users: {
      total_registered: totalRegistered,
      verified_users: verifiedUsers,
      created_7d: users7d,
      created_30d: users30d,
      most_recent_signup: recentSignupRows[0]?.created_at ?? null,
    },
    operational_cases: {
      total: casesTotal,
      active: casesActive,
      archived: casesArchived,
      created_7d: cases7d,
      created_30d: cases30d,
      avg_per_user: avgCasesPerUser,
    },
    care_record_health: {
      with_inputs: withInputs,
      with_documents: withDocs,
      with_multiple_sessions: withMultiSessions,
      revisited,
      empty: emptyCases,
    },
    funnel,
    engagement: {
      avg_inputs_per_user:
        distinctUsersForInputs > 0
          ? Math.round((inputCount / distinctUsersForInputs) * 100) / 100
          : 0,
      avg_sessions_per_user:
        distinctUsersForInputs > 0
          ? Math.round((sessionCount / distinctUsersForInputs) * 100) / 100
          : 0,
      top_events: topEvents.map((r) => ({
        event_name: r.event_name,
        count: Number(r.count),
      })),
      time_to_first_care_case_hours:
        ttfHours != null && Number.isFinite(ttfHours)
          ? Math.round(ttfHours * 10) / 10
          : null,
    },
    continuity: {
      returning_users: returningUsers,
      retention_7d: retention7d,
      care_records_reopened: careRecordsReopened,
      appointment_prep_sessions: aptPrep,
      avg_days_between_visits:
        avgGapRows[0]?.days != null
          ? Math.round(Number(avgGapRows[0].days) * 10) / 10
          : null,
      return_visit_count: returnVisitCount,
    },
    errors: errors.map((e) => ({
      error_code: e.error_code,
      count: Number(e.count),
      last_seen: e.last_seen,
      sample_error_message: e.sample_error_message ?? "",
    })),
    system: {
      total_events: totalEvents || mem.length,
      events_24h: events24h,
      last_event_received: lastEvent,
      ingestion_health: ingestion,
      db_connected: dbConnected,
      query_latency_ms: queryLatency,
    },
    raw_events: rawEvents,
    raw_total: rawTotal || mem.length,
  };
}

export async function loadInvestorDashboard(): Promise<InvestorDashboardData> {
  const ops = await loadOpsDashboard();
  const u30 = ops.operational_users.created_30d;
  const uPrevApprox = Math.max(0, ops.operational_users.total_registered - u30);
  const monthlyGrowth =
    uPrevApprox > 0 ? Math.round((u30 / uPrevApprox) * 1000) / 10 : null;

  return {
    growth: {
      total_registered_users: ops.operational_users.total_registered,
      users_created_7d: ops.operational_users.created_7d,
      users_created_30d: ops.operational_users.created_30d,
      monthly_growth_pct: monthlyGrowth,
    },
    adoption: {
      total_care_cases: ops.operational_cases.total,
      active_care_cases: ops.operational_cases.active,
      care_cases_created_7d: ops.operational_cases.created_7d,
      care_cases_created_30d: ops.operational_cases.created_30d,
      avg_care_cases_per_user: ops.operational_cases.avg_per_user,
    },
    engagement: {
      returning_users: ops.continuity.returning_users,
      retention_7d: ops.continuity.retention_7d,
      avg_sessions_per_user: ops.engagement.avg_sessions_per_user,
      avg_inputs_per_user: ops.engagement.avg_inputs_per_user,
      care_records_reopened: ops.continuity.care_records_reopened,
      appointment_prep_sessions: ops.continuity.appointment_prep_sessions,
    },
    continuity: {
      care_records_reopened: ops.continuity.care_records_reopened,
      avg_days_between_visits: ops.continuity.avg_days_between_visits,
      users_returning_multiple_times: ops.continuity.returning_users,
      care_cases_with_multiple_sessions: ops.care_record_health.with_multiple_sessions,
      care_cases_with_documents: ops.care_record_health.with_documents,
      care_cases_with_inputs: ops.care_record_health.with_inputs,
    },
    system: {
      platform_status: ops.system.ingestion_health,
      last_event_received: ops.system.last_event_received,
      database_status: ops.system.db_connected
        ? ops.system.query_latency_ms != null && ops.system.query_latency_ms < 2000
          ? "healthy"
          : "warning"
        : "unknown",
    },
  };
}
