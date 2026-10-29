"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  Handshake,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type CareEvent = {
  id: string;
  person_id: string;
  event_type: string;
  status: string;
  occurred_at: string;
  occurred_at_timezone?: string | null;
  recorded_at: string;
  updated_at?: string | null;
  title: string;
  description?: string | null;
  evidence_ids?: string[] | null;
  time_provenance?: string | null;
  tags?: string[] | null;
  created_by_caregiver_id?: string | null;
  significance_verdict?: string | null;
  attention_candidate?: boolean | null;
  follow_up_candidate?: boolean | null;
  confidence?: number | null;
  situation_id?: string | null;
};

type HistoryCategory =
  | "daily-care"
  | "document"
  | "appointment"
  | "handoff"
  | "decision"
  | "outcome"
  | "follow-up"
  | "other";

type FilterKey = "all" | HistoryCategory;

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily-care", label: "Daily Care" },
  { id: "document", label: "Documents" },
  { id: "appointment", label: "Appointments" },
  { id: "handoff", label: "Handoffs" },
  { id: "decision", label: "Decisions" },
  { id: "outcome", label: "Outcomes" },
  { id: "follow-up", label: "Follow-ups" },
];

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(event: CareEvent): Date | null {
  return safeDate(event.occurred_at) ?? safeDate(event.recorded_at);
}

function formatDateTime(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDay(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Date not recorded";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function categoryFor(event: CareEvent): HistoryCategory {
  const value = [
    event.event_type,
    event.title,
    ...(event.tags ?? []),
  ].join(" ").toLowerCase();

  if (/handoff|hand.?over|care transfer/.test(value)) return "handoff";
  if (/appointment|doctor visit|clinic visit|consultation/.test(value)) return "appointment";
  if (/decision|decided|choice/.test(value)) return "decision";
  if (/document|upload|file|discharge|letter|report|scan/.test(value)) return "document";
  if (/outcome|result|completed action/.test(value)) return "outcome";
  if (/observation|daily.?care|daily.?capture|symptom|behavio[u]?r|sleep|meal/.test(value)) return "daily-care";
  if (
    /follow.?up|open.?loop|pending|unresolved|question/.test(value) ||
    event.follow_up_candidate ||
    event.attention_candidate
  ) return "follow-up";
  return "other";
}

function categoryLabel(category: HistoryCategory, eventType?: string): string {
  if (category === "daily-care") return "Daily Care";
  if (category === "document") return "Document";
  if (category === "appointment") return "Appointment";
  if (category === "handoff") return "Handoff";
  if (category === "decision") return "Decision";
  if (category === "outcome") return "Outcome";
  if (category === "follow-up") return "Follow-up";
  return (eventType || "Care record").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseDescription(description?: string | null): string {
  if (!description?.trim()) return "";
  try {
    const parsed: unknown = JSON.parse(description);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => {
          const label = key.replaceAll("_", " ");
          return label + ": " + (typeof value === "string" ? value : JSON.stringify(value));
        })
        .join("\n");
    }
  } catch {
    // Preserve the original plain-text description.
  }
  return description;
}

function recordText(event: CareEvent): string {
  const lines = [
    event.title,
    categoryLabel(categoryFor(event), event.event_type),
    "",
    "Original record:",
    parseDescription(event.description) || "No description was saved.",
    "",
    "Event time: " + formatDateTime(event.occurred_at),
    "Recorded in SolenOS: " + formatDateTime(event.recorded_at),
    "Status: " + (event.status || "Not specified"),
    "Time provenance: " + (event.time_provenance || "Not recorded"),
    "Tags: " + (event.tags?.length ? event.tags.join(", ") : "None recorded"),
    "Evidence references: " + (event.evidence_ids?.length ? event.evidence_ids.join(", ") : "None attached"),
  ];
  return lines.join("\n");
}

function eventMatchesFilter(event: CareEvent, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const category = categoryFor(event);
  if (filter === "follow-up") {
    return category === "follow-up" || Boolean(event.follow_up_candidate) || Boolean(event.attention_candidate);
  }
  return category === filter;
}

function CategoryIcon({ category }: { category: HistoryCategory }) {
  if (category === "document") return <FileText size={17} aria-hidden />;
  if (category === "appointment") return <CalendarDays size={17} aria-hidden />;
  if (category === "handoff") return <Handshake size={17} aria-hidden />;
  if (category === "decision" || category === "outcome") return <CheckCircle2 size={17} aria-hidden />;
  if (category === "follow-up") return <Clock3 size={17} aria-hidden />;
  return <Activity size={17} aria-hidden />;
}

export function HistoryDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const loadHistory = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this history.");
      }

      const result = await getJSON("/events/" + encodeURIComponent(session.person.id));
      if (!Array.isArray(result)) {
        throw new Error("The care-history response was not in the expected format. No example records were inserted.");
      }

      const validEvents = result.filter((item): item is CareEvent =>
        Boolean(
          item &&
          typeof item.id === "string" &&
          typeof item.person_id === "string" &&
          typeof item.event_type === "string" &&
          typeof item.title === "string"
        )
      );

      validEvents.sort((a, b) => {
        const aTime = eventDate(a)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const bTime = eventDate(b)?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (aTime !== bTime) return bTime - aTime;
        return (safeDate(b.recorded_at)?.getTime() ?? 0) - (safeDate(a.recorded_at)?.getTime() ?? 0);
      });

      setEvents(validEvents);
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Care history could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (open && !hasLoaded && !loading) void loadHistory();
  }, [open, hasLoaded, loading, loadHistory]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setMenuId(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const visibleEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (!eventMatchesFilter(event, filter)) return false;
      if (!needle) return true;
      const haystack = [
        event.title,
        event.event_type,
        event.description ?? "",
        event.status,
        event.occurred_at,
        event.recorded_at,
        event.time_provenance ?? "",
        event.created_by_caregiver_id ?? "",
        ...(event.tags ?? []),
        ...(event.evidence_ids ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [events, filter, query]);

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: CareEvent[] }[] = [];
    for (const event of visibleEvents) {
      const label = formatDay(event.occurred_at || event.recorded_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [visibleEvents]);

  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;

  const closeDrawer = () => {
    setOpen(false);
    setMenuId(null);
  };

  const copyRecord = async (event: CareEvent) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(recordText(event));
      setActionMessage("Record details copied.");
    } catch {
      setActionMessage("Copy is unavailable in this browser. Try Download record instead.");
    }
    setMenuId(null);
  };

  const downloadRecord = (event: CareEvent) => {
    const blob = new Blob([recordText(event)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (event.title || "care-record").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + ".txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setActionMessage("Record download started.");
    setMenuId(null);
  };

  const shareRecord = async (event: CareEvent) => {
    const text = recordText(event);
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text });
        setActionMessage("Share sheet opened.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setActionMessage("Sharing is unavailable here; record details copied instead.");
      } else {
        setActionMessage("Sharing is unavailable in this browser. Try Download record instead.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setActionMessage("The record could not be shared from this browser.");
      }
    }
    setMenuId(null);
  };

  return (
    <>
      <button
        type="button"
        className="history-trigger"
        aria-label="Open care history"
        aria-expanded={open}
        aria-controls="solenos-history-drawer"
        onClick={() => setOpen(true)}
      >
        <PanelLeftOpen size={21} aria-hidden />
      </button>

      {open && (
        <div
          className="history-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            id="solenos-history-drawer"
            className="history-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Care history"
          >
            <header className="history-drawer-header">
              <div className="history-drawer-title-row">
                {selectedEvent ? (
                  <button
                    type="button"
                    className="history-icon-button"
                    aria-label="Back to care history"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft size={19} aria-hidden />
                  </button>
                ) : (
                  <span className="history-drawer-mark"><ShieldCheck size={19} aria-hidden /></span>
                )}
                <div className="history-drawer-heading">
                  <strong>{selectedEvent ? "Care record" : "Care history"}</strong>
                  <span>{selectedEvent ? "Original record and saved details" : "A chronological view of saved care events"}</span>
                </div>
                <button type="button" className="history-icon-button" aria-label="Close care history" onClick={closeDrawer}>
                  <X size={19} aria-hidden />
                </button>
              </div>
              {!selectedEvent && (
                <button
                  type="button"
                  className="history-new-entry"
                  onClick={() => {
                    closeDrawer();
                    router.push("/workspace?compose=1");
                  }}
                >
                  <Plus size={17} aria-hidden />
                  New care entry
                </button>
              )}
            </header>

            {selectedEvent ? (
              <div className="history-detail-scroll">
                <div className="history-detail-category">
                  <span className="history-category-icon"><CategoryIcon category={categoryFor(selectedEvent)} /></span>
                  {categoryLabel(categoryFor(selectedEvent), selectedEvent.event_type)}
                </div>
                <h2 className="history-detail-title">{selectedEvent.title}</h2>
                <p className="history-detail-date">{formatDateTime(selectedEvent.occurred_at)} · {categoryLabel(categoryFor(selectedEvent), selectedEvent.event_type)}</p>

                <section className="history-detail-section">
                  <h3>Original record</h3>
                  <p className="history-original-text">{parseDescription(selectedEvent.description) || "No description was saved with this record."}</p>
                </section>

                <section className="history-detail-section">
                  <h3>Record details</h3>
                  <dl className="history-detail-list">
                    <dt>Event time</dt>
                    <dd>{formatDateTime(selectedEvent.occurred_at)}{selectedEvent.occurred_at_timezone ? " (" + selectedEvent.occurred_at_timezone + ")" : ""}</dd>
                    <dt>Recorded in SolenOS</dt>
                    <dd>{formatDateTime(selectedEvent.recorded_at)}</dd>
                    <dt>Record status</dt>
                    <dd>{selectedEvent.status || "Not specified"}</dd>
                    <dt>Source attribution</dt>
                    <dd>{selectedEvent.created_by_caregiver_id ? "Caregiver attribution recorded" : "Not recorded"}</dd>
                    <dt>Time provenance</dt>
                    <dd>{selectedEvent.time_provenance || "Not recorded"}</dd>
                    <dt>Evidence references</dt>
                    <dd>{selectedEvent.evidence_ids?.length ? selectedEvent.evidence_ids.join(", ") : "No evidence references attached"}</dd>
                    <dt>Tags</dt>
                    <dd>{selectedEvent.tags?.length ? selectedEvent.tags.join(", ") : "No tags recorded"}</dd>
                    <dt>Last updated</dt>
                    <dd>{formatDateTime(selectedEvent.updated_at)}</dd>
                  </dl>
                  {selectedEvent.significance_verdict && (
                    <p className="history-detail-significance"><strong>Recorded significance:</strong> {selectedEvent.significance_verdict}</p>
                  )}
                </section>

                <section className="history-integrity-note">
                  <ShieldCheck size={16} aria-hidden />
                  <span>Original information is shown separately from recorded metadata. A missing field is not treated as proof that something did not happen. Related events are not assumed to share a cause.</span>
                </section>

                <div className="history-detail-actions">
                  <button type="button" onClick={() => void shareRecord(selectedEvent)}><Share2 size={16} aria-hidden />Share</button>
                  <button type="button" onClick={() => void copyRecord(selectedEvent)}><Copy size={16} aria-hidden />Copy</button>
                  <button type="button" onClick={() => downloadRecord(selectedEvent)}><Download size={16} aria-hidden />Download</button>
                </div>
              </div>
            ) : (
              <>
                <div className="history-search-wrap">
                  <Search size={17} aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search care history..."
                    aria-label="Search care history"
                    autoFocus
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                      <X size={15} aria-hidden />
                    </button>
                  )}
                </div>

                <div className="history-filter-row" role="group" aria-label="Filter care history">
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={"history-filter-chip" + (filter === item.id ? " is-active" : "")}
                      aria-pressed={filter === item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="history-list-scroll">
                  <div className="history-list-summary">
                    <strong>Recent records</strong>
                    <span>{loading ? "Loading…" : visibleEvents.length + (visibleEvents.length === 1 ? " record" : " records")}</span>
                    <button
                      type="button"
                      className="history-icon-button"
                      aria-label="Refresh care history"
                      disabled={loading || refreshing}
                      onClick={() => void loadHistory(true)}
                    >
                      <RefreshCw size={16} aria-hidden className={refreshing ? "history-spinning" : undefined} />
                    </button>
                  </div>

                  {loading ? (
                    <div className="history-state" role="status">
                      <span className="history-loading-dot" />
                      Loading saved care history…
                    </div>
                  ) : error ? (
                    <div className="history-error" role="alert">
                      <AlertCircle size={19} aria-hidden />
                      <div>
                        <strong>History could not be loaded</strong>
                        <p>{error}</p>
                        <button type="button" onClick={() => void loadHistory(true)} disabled={refreshing}>Try again</button>
                      </div>
                    </div>
                  ) : visibleEvents.length === 0 ? (
                    <div className="history-empty">
                      <HistoryEmptyIcon />
                      <strong>{events.length ? "No matching records" : "Your care history starts with saved records"}</strong>
                      <p>{events.length ? "Try a different search or filter. No records were changed." : "No saved care events were returned for this care record. SolenOS will not create example history."}</p>
                      {(query || filter !== "all") && (
                        <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</button>
                      )}
                    </div>
                  ) : (
                    <div className="history-groups">
                      {groupedEvents.map((group) => (
                        <section key={group.label} className="history-date-group">
                          <h3>{group.label}</h3>
                          <div className="history-event-list">
                            {group.events.map((event) => {
                              const category = categoryFor(event);
                              const description = parseDescription(event.description);
                              const menuOpen = menuId === event.id;
                              return (
                                <article key={event.id} className="history-event-card">
                                  <button
                                    type="button"
                                    className="history-event-open"
                                    onClick={() => { setSelectedId(event.id); setMenuId(null); }}
                                    aria-label={"Open record: " + event.title}
                                  >
                                    <span className="history-event-topline">
                                      <span className="history-category-icon"><CategoryIcon category={category} /></span>
                                      <span className="history-event-category">{categoryLabel(category, event.event_type)}</span>
                                      <span className="history-event-time">{formatDateTime(event.occurred_at)}</span>
                                    </span>
                                    <strong>{event.title}</strong>
                                    {description && <span className="history-event-description">{description}</span>}
                                    {(event.follow_up_candidate || event.attention_candidate) && (
                                      <span className="history-event-flag">Flagged for follow-up</span>
                                    )}
                                  </button>
                                  <div className="history-event-menu-wrap">
                                    <button
                                      type="button"
                                      className="history-icon-button history-event-menu-trigger"
                                      aria-label={"Actions for " + event.title}
                                      aria-haspopup="menu"
                                      aria-expanded={menuOpen}
                                      onClick={() => setMenuId(menuOpen ? null : event.id)}
                                    >
                                      <MoreHorizontal size={19} aria-hidden />
                                    </button>
                                    {menuOpen && (
                                      <div className="history-action-menu" role="menu" aria-label={"Actions for " + event.title}>
                                        <button type="button" role="menuitem" onClick={() => void shareRecord(event)}><Share2 size={16} aria-hidden />Share</button>
                                        <button type="button" role="menuitem" onClick={() => void copyRecord(event)}><Copy size={16} aria-hidden />Copy details</button>
                                        <button type="button" role="menuitem" onClick={() => downloadRecord(event)}><Download size={16} aria-hidden />Download record</button>
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="history-drawer-footer">
                  <ShieldCheck size={15} aria-hidden />
                  <span>History shows saved care events. Event time and recording time remain distinct{loadedAt ? " · Updated " + formatDateTime(loadedAt) : ""}.</span>
                </footer>
              </>
            )}

            {actionMessage && (
              <div className="history-action-status" role="status">
                <span>{actionMessage}</span>
                <button type="button" aria-label="Dismiss message" onClick={() => setActionMessage(null)}><X size={14} aria-hidden /></button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function HistoryEmptyIcon() {
  return <span className="history-empty-icon"><Clock3 size={27} aria-hidden /></span>;
}
