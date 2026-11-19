"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Shield, UserPlus, Users, X, Check, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAnonymousAccessToken, getPersonId, getJSON, postJSON, patchJSON, deleteJSON } from "@/api/client";
import { caregiverFieldLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

type Member = {
  caregiver_id: string;
  caregiver_profile_id: string | null;
  name: string;
  email: string | null;
  role: string;
  access_scope: string;
  status: string;
  can_manage_members: boolean;
  granted_at: string | null;
};
type Responsibility = {
  id: string;
  caregiver_id: string;
  responsibility_type: string;
  scope?: string | null;
  status: string;
};
type OpenLoop = { id: string; title: string; status: string; assigned_caregiver_id?: string | null };
type Transfer = {
  id: string;
  source_responsibility_id: string;
  responsibility_type: string;
  from_caregiver_profile_id: string;
  from_caregiver_name: string;
  to_caregiver_profile_id: string;
  to_caregiver_name: string;
  related_record_type?: string | null;
  related_record_id?: string | null;
  reason?: string | null;
  status: string;
  created_at: string | null;
};

type PrimaryTransfer = { id: string; from_caregiver_id: string; to_caregiver_id: string; reason?: string | null; status: string; created_at: string | null };
type MultiCaregiverSummary = {
  caregivers?: unknown[];
  active_responsibilities?: unknown[];
  active_handoffs?: unknown[];
  responsibility_gaps?: unknown[];
  perspective_conflicts?: unknown[];
  duplicate_actions?: unknown[];
};
type InvitationResult = {
  invitation_id: string;
  email: string;
  expires_at: string;
  invitation_token: string;
  delivery_status: "not_sent" | string;
};

export function CaregiverAccessPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [openLoops, setOpenLoops] = useState<OpenLoop[]>([]);
  const [networkSummary, setNetworkSummary] = useState<MultiCaregiverSummary | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [primaryTransfers, setPrimaryTransfers] = useState<PrimaryTransfer[]>([]);
  const [selectedPrimaryRecipient, setSelectedPrimaryRecipient] = useState("");
  const [primaryReason, setPrimaryReason] = useState("");
  const [email, setEmail] = useState("");
  const [selectedResponsibility, setSelectedResponsibility] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [selectedOpenLoop, setSelectedOpenLoop] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(false);

  const load = useCallback(async () => {
    if (!getAnonymousAccessToken()) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const transferPromise = getJSON("/caregiver-access/responsibility-transfers") as Promise<Transfer[]>;
      const primaryTransferPromise = getJSON("/caregiver-access/primary-transfers") as Promise<PrimaryTransfer[]>;
      const memberPromise = getJSON("/caregiver-access/members") as Promise<Member[]>;
      const [transferResult, primaryTransferResult, memberResult] = await Promise.allSettled([transferPromise, primaryTransferPromise, memberPromise]);
      if (transferResult.status === "fulfilled") setTransfers(transferResult.value ?? []);
      else setTransfers([]);
      if (primaryTransferResult.status === "fulfilled") setPrimaryTransfers(primaryTransferResult.value ?? []);
      else setPrimaryTransfers([]);
      if (memberResult.status === "fulfilled") {
        setAllowed(true);
        setMembers(memberResult.value ?? []);
        const personId = getPersonId();
        const [responsibilityResult, loopResult, networkResult] = await Promise.allSettled([
          getJSON("/caregiver-responsibilities/" + encodeURIComponent(personId)) as Promise<Responsibility[]>,
          getJSON("/open-loops") as Promise<{ items?: OpenLoop[] }>,
          getJSON("/multi-caregiver-summary") as Promise<MultiCaregiverSummary>,
        ]);
        if (responsibilityResult.status === "fulfilled") {
          setResponsibilities((responsibilityResult.value ?? []).filter((item) => item.status !== "historical" && item.status !== "gap"));
        }
        if (loopResult.status === "fulfilled") setOpenLoops(loopResult.value.items ?? []);
        if (networkResult.status === "fulfilled") setNetworkSummary(networkResult.value);
        else setNetworkSummary(null);
      } else {
        setAllowed(false);
        setNetworkSummary(null);
        if (transferResult.status === "rejected") setError("We couldn't load your care handover. Please try again.");
      }
    } catch {
      setError("We couldn't load caregiver access. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setInvitation(null);
    try {
      const result = await postJSON("/caregiver-access/invitations", { email, expires_in_days: 7 }) as InvitationResult;
      setInvitation(result);
      setEmail("");
      setNotice("Invitation created. SolenOS has not emailed or delivered it.");
    } catch {
      setError("We couldn't create this invitation. Check the email address and your access, then try again.");
    } finally {
      setBusy(false);
    }
  };

  const createTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedResponsibility || !selectedRecipient) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-access/responsibility-transfers", {
        source_responsibility_id: selectedResponsibility,
        to_caregiver_profile_id: selectedRecipient,
        related_record_type: selectedOpenLoop ? "open_loop" : undefined,
        related_record_id: selectedOpenLoop || undefined,
        reason: transferReason.trim() || undefined,
      });
      setSelectedResponsibility("");
      setSelectedRecipient("");
      setSelectedOpenLoop("");
      setTransferReason("");
      setNotice("Transfer request created. The current responsibility remains in place until the receiving caregiver accepts.");
      await load();
    } catch {
      setError("We couldn't create this transfer. The existing assignment has not been changed.");
    } finally {
      setBusy(false);
    }
  };

  const createPrimaryTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPrimaryRecipient) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-access/primary-transfers", {
        to_caregiver_id: selectedPrimaryRecipient,
        reason: primaryReason.trim() || undefined,
      });
      setSelectedPrimaryRecipient("");
      setPrimaryReason("");
      setNotice("Request to change the main caregiver sent. Your access and care tasks stay the same until the other caregiver accepts.");
      await load();
    } catch {
      setError("We couldn't request this change. The current main caregiver remains in place.");
    } finally {
      setBusy(false);
    }
  };

  const respondToPrimaryTransfer = async (transfer: PrimaryTransfer, decision: "accept" | "reject") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-access/primary-transfers/" + encodeURIComponent(transfer.id) + "/" + decision, {});
      setNotice(decision === "accept"
        ? "You are now the main caregiver. The previous caregiver's access and past notes have been kept."
        : "You declined the change. The current main caregiver remains in place.");
      await load();
    } catch {
      setError("We couldn't save your response. The current main caregiver has not changed.");
    } finally {
      setBusy(false);
    }
  };

  const respondToTransfer = async (transfer: Transfer, decision: "accept" | "reject") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-access/responsibility-transfers/" + encodeURIComponent(transfer.id) + "/" + decision, {});
      setNotice(decision === "accept"
        ? "This care task is now assigned to you. The earlier assignment is kept in the Care Record."
         : "You declined this handover. The current caregiver remains responsible.");
      await load();
    } catch {
      setError("We couldn't save your response. No change has been made.");
    } finally {
      setBusy(false);
    }
  };

  const updateScope = async (member: Member, accessScope: "full_record" | "documents_only") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await patchJSON("/caregiver-access/members/" + encodeURIComponent(member.caregiver_id) + "/access-scope", {
        access_scope: accessScope,
      });
      setNotice(accessScope === "documents_only"
        ? member.name + " can now access documents and appointment paperwork only."
        : member.name + " can access the full Care Record.");
      await load();
    } catch {
      setError("We couldn't change this caregiver's access. Their previous access remains in place.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (member: Member) => {
    if (!window.confirm("Remove " + member.name + "'s access to this Care Record? Notes they added in the past will stay.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteJSON("/caregiver-access/members/" + encodeURIComponent(member.caregiver_id));
      setNotice(member.name + " can no longer open this Care Record. Their earlier notes are still saved.");
      await load();
    } catch {
      setError("We couldn't change this caregiver's access. No change has been made.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="mobile-settings-card"><p className="mobile-settings-hint" role="status">Loading caregiver access…</p></section>;

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title"><Users size={16} aria-hidden /> Caregivers</h2>

      {allowed ? (
        <>
          <p className="mobile-settings-hint">Invite someone to help with care or remove their access. Notes they added in the past will stay in your Care Record.</p>
          <form onSubmit={(event) => void invite(event)} style={{ display: "grid", gap: "0.7rem", marginTop: "0.9rem" }}>
            <label className="mobile-settings-label" htmlFor="caregiver-invite-email">Email address</label>
            <input id="caregiver-invite-email" className="mobile-settings-input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" variant="primary" disabled={busy || !email.trim()} loading={busy}><UserPlus size={16} aria-hidden /> Create invitation link</Button>
          </form>

          {invitation && (
            <div className="mobile-settings-hint" role="status" style={{ marginTop: "0.8rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.8rem" }}>
              <strong>Invitation for {invitation.email}</strong>
              <p>This invitation has not been sent. Share this one-time link privately. It expires {new Date(invitation.expires_at).toLocaleString()}.</p>
              
              <Button type="button" variant="secondary" onClick={() => { const link = window.location.origin + "/invite/caregiver#token=" + encodeURIComponent(invitation.invitation_token); void navigator.clipboard?.writeText(link); }}>Copy invitation link</Button>
            </div>
          )}

          {networkSummary && (
            <div style={{ display: "grid", gap: "0.55rem", marginTop: "1rem", padding: "0.85rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "12px" }}>
              <h3 className="mobile-settings-label">Care coverage at a glance</h3>
              <p className="mobile-settings-hint" style={{ margin: 0 }}>A shared view of who is involved and where care responsibilities may need attention.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.55rem" }}>
                {[
                  ["Caregivers", networkSummary.caregivers],
                  ["Active responsibilities", networkSummary.active_responsibilities],
                  ["Active handovers", networkSummary.active_handoffs],
                  ["Responsibility gaps", networkSummary.responsibility_gaps],
                  ["Different views to review", networkSummary.perspective_conflicts],
                  ["Possible duplicate actions", networkSummary.duplicate_actions],
                ].map(([label, items]) => (
                  <div key={String(label)} style={{ padding: "0.55rem", background: "var(--surface-muted, #f5f7f5)", borderRadius: "9px" }}>
                    <strong style={{ display: "block", fontSize: "1.15rem" }}>{Array.isArray(items) ? items.length : 0}</strong>
                    <span className="mobile-settings-hint">{String(label)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: "0.65rem", marginTop: "1rem" }}>
            <h3 className="mobile-settings-label"><Shield size={15} aria-hidden /> People with access</h3>
            {members.map((member) => (
              <div key={member.caregiver_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.7rem" }}>
                <div>
                  <strong>{member.name}</strong>
                  <p className="mobile-settings-hint" style={{ margin: 0 }}>{member.email ?? "No email"} · {member.role === "primary" ? "Main caregiver" : "Family caregiver"} · {caregiverStatusLabel(member.status) || "Status not available"}</p>
                  <p className="mobile-settings-hint" style={{ margin: "0.25rem 0" }}>Access: {member.access_scope === "documents_only" ? "Documents and appointment paperwork" : "Full care record"}</p>
                  {member.status === "active" && !member.can_manage_members && (
                    <select
                      aria-label={"Access scope for " + member.name}
                      className="mobile-settings-input"
                      value={member.access_scope || "full_record"}
                      disabled={busy}
                      onChange={(event) => void updateScope(member, event.target.value as "full_record" | "documents_only")}
                    >
                      <option value="full_record">Full care record</option>
                      <option value="documents_only">Documents and appointment paperwork only</option>
                    </select>
                  )}
                </div>
                {member.status === "active" && !member.can_manage_members && (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void revoke(member)}><X size={15} aria-hidden /> Remove</Button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: "0.7rem", marginTop: "1.2rem" }}>
            <h3 className="mobile-settings-label"><Shield size={15} aria-hidden /> Change the main caregiver</h3>
            <p className="mobile-settings-hint">This changes who manages access for other caregivers. It does not move individual care tasks; you can hand those over separately below.</p>
            <form onSubmit={(event) => void createPrimaryTransfer(event)} style={{ display: "grid", gap: "0.65rem" }}>
              <label className="mobile-settings-label" htmlFor="primary-transfer-recipient">New main caregiver</label>
              <select id="primary-transfer-recipient" className="mobile-settings-input" required value={selectedPrimaryRecipient} onChange={(event) => setSelectedPrimaryRecipient(event.target.value)}>
                <option value="">Choose a caregiver</option>
                {members.filter((member) => member.status === "active" && !member.can_manage_members).map((member) => <option key={member.caregiver_id} value={member.caregiver_id}>{member.name}</option>)}
              </select>
              <label className="mobile-settings-label" htmlFor="primary-transfer-reason">Reason (optional)</label>
              <input id="primary-transfer-reason" className="mobile-settings-input" maxLength={1000} value={primaryReason} onChange={(event) => setPrimaryReason(event.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || !selectedPrimaryRecipient} loading={busy}>Request change of main caregiver</Button>
            </form>
          </div>

          <div style={{ display: "grid", gap: "0.7rem", marginTop: "1.2rem" }}>
            <h3 className="mobile-settings-label"><ArrowRightLeft size={15} aria-hidden /> Hand over a care task</h3>
            <p className="mobile-settings-hint">The current caregiver stays responsible until the other caregiver accepts. Each task is handed over separately.</p>
            <form onSubmit={(event) => void createTransfer(event)} style={{ display: "grid", gap: "0.65rem" }}>
              <label className="mobile-settings-label" htmlFor="transfer-responsibility">Care task to hand over</label>
              <select id="transfer-responsibility" className="mobile-settings-input" required value={selectedResponsibility} onChange={(event) => setSelectedResponsibility(event.target.value)}>
                <option value="">Choose a responsibility</option>
                {responsibilities.map((item) => <option key={item.id} value={item.id}>{caregiverFieldLabel(item.responsibility_type) || caregiverStatusLabel(item.responsibility_type) || "Care task"} — {caregiverFieldLabel(item.scope) || caregiverStatusLabel(item.scope) || ((item.scope || "").includes("_") ? "No additional detail" : caregiverSafeAssistantText(item.scope)) || "No additional detail"}</option>)}
              </select>
              <label className="mobile-settings-label" htmlFor="transfer-recipient">New caregiver</label>
              <select id="transfer-recipient" className="mobile-settings-input" required value={selectedRecipient} onChange={(event) => setSelectedRecipient(event.target.value)}>
                <option value="">Choose a caregiver</option>
                {members.filter((member) => member.status === "active" && member.caregiver_profile_id && !member.can_manage_members).map((member) => <option key={member.caregiver_profile_id} value={member.caregiver_profile_id!}>{member.name}</option>)}
              </select>
              <label className="mobile-settings-label" htmlFor="transfer-open-loop">Existing follow-up (optional)</label>
              <select id="transfer-open-loop" className="mobile-settings-input" value={selectedOpenLoop} onChange={(event) => setSelectedOpenLoop(event.target.value)}>
                <option value="">No linked follow-up</option>
                {openLoops.filter((item) => !["closed", "cancelled"].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <label className="mobile-settings-label" htmlFor="transfer-reason">Reason (optional)</label>
              <input id="transfer-reason" className="mobile-settings-input" maxLength={1000} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || !selectedResponsibility || !selectedRecipient} loading={busy}>Request handover</Button>
            </form>
          </div>
        </>
      ) : (
        <p className="mobile-settings-hint">The main caregiver manages who can access this Care Record. You can still review and respond to care tasks handed to you.</p>
      )}

      {primaryTransfers.length > 0 && (
        <div style={{ display: "grid", gap: "0.7rem", marginTop: "1rem" }}>
          <h3 className="mobile-settings-label">Main caregiver changes</h3>
          {primaryTransfers.map((transfer) => (
            <div key={transfer.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.7rem" }}>
              <strong>Change main caregiver · {caregiverStatusLabel(transfer.status) || "Status not available"}</strong>
              {transfer.reason && <p className="mobile-settings-hint">{transfer.reason}</p>}
              {transfer.status === "pending" && !allowed && (
                <div className="mobile-settings-buttons">
                  <Button type="button" variant="primary" disabled={busy} onClick={() => void respondToPrimaryTransfer(transfer, "accept")}><Check size={15} aria-hidden /> Accept</Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void respondToPrimaryTransfer(transfer, "reject")}>Decline</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {transfers.length > 0 && (
        <div style={{ display: "grid", gap: "0.7rem", marginTop: "1rem" }}>
          <h3 className="mobile-settings-label">Care task handovers</h3>
          {transfers.map((transfer) => (
            <div key={transfer.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.7rem" }}>
              <strong>{caregiverFieldLabel(transfer.responsibility_type) || caregiverStatusLabel(transfer.responsibility_type) || "Care task"}</strong>
              <p className="mobile-settings-hint" style={{ margin: "0.25rem 0" }}>{transfer.from_caregiver_name} → {transfer.to_caregiver_name} · {caregiverStatusLabel(transfer.status) || "Status not available"}</p>
              {transfer.reason && <p className="mobile-settings-hint">{transfer.reason}</p>}
              {transfer.status === "pending" && !allowed && (
                <div className="mobile-settings-buttons">
                  <Button type="button" variant="primary" disabled={busy} onClick={() => void respondToTransfer(transfer, "accept")}><Check size={15} aria-hidden /> Accept</Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void respondToTransfer(transfer, "reject")}>Decline</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
      {notice && <p className="mobile-settings-hint" role="status">{notice}</p>}
      <Button type="button" variant="secondary" onClick={() => void load()} disabled={busy}>Refresh</Button>
    </section>
  );
}
