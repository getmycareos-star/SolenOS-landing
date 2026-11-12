"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAnonymousAccessToken, getJSON, postJSON, deleteJSON } from "@/api/client";

type Member = {
  caregiver_id: string;
  caregiver_profile_id: string | null;
  name: string;
  email: string | null;
  role: string;
  status: string;
  can_manage_members: boolean;
  granted_at: string | null;
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
  const [email, setEmail] = useState("");
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(true);

  const load = useCallback(async () => {
    if (!getAnonymousAccessToken()) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getJSON("/caregiver-access/members") as { members?: Member[] } | Member[];
      setMembers(Array.isArray(result) ? result : (result as { members?: Member[] }).members ?? []);
      setAllowed(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      if (/403|administrator|authorised/i.test(message)) setAllowed(false);
      else setError("We couldn't load caregiver access. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setInvitation(null);
    try {
      const result = await postJSON("/caregiver-access/invitations", { email, expires_in_days: 7 }) as InvitationResult;
      setInvitation(result);
      setEmail("");
      setNotice("Invitation created. It has not been emailed or delivered by SolenOS.");
    } catch {
      setError("We couldn't create this invitation. Check the email address and your access, then try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (member: Member) => {
    if (!window.confirm("Remove " + member.name + "'s access to this care record? Their past contributions will remain in the history.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteJSON("/caregiver-access/members/" + encodeURIComponent(member.caregiver_id));
      setNotice(member.name + " can no longer access this care record. Their historical contributions remain.");
      await load();
    } catch {
      setError("We couldn't change this caregiver's access. No change should be assumed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="mobile-settings-card"><p className="mobile-settings-hint" role="status">Loading caregiver access…</p></section>;
  if (!allowed) return <section className="mobile-settings-card"><h2 className="mobile-settings-card-title"><Users size={16} aria-hidden /> Caregivers</h2><p className="mobile-settings-hint">Caregiver access is managed by the person authorised to administer this care record. You can still view the care information shared with you.</p></section>;

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title"><Users size={16} aria-hidden /> Caregivers</h2>
      <p className="mobile-settings-hint">Invite someone to this care record or remove their access. Past notes and contributions are kept when access changes.</p>

      <form onSubmit={(event) => void invite(event)} style={{ display: "grid", gap: "0.7rem", marginTop: "0.9rem" }}>
        <label className="mobile-settings-label" htmlFor="caregiver-invite-email">Email address</label>
        <input id="caregiver-invite-email" className="mobile-settings-input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" variant="primary" disabled={busy || !email.trim()} loading={busy}><UserPlus size={16} aria-hidden /> Create invitation</Button>
      </form>

      {invitation && (
        <div className="mobile-settings-hint" role="status" style={{ marginTop: "0.8rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.8rem" }}>
          <strong>Invitation for {invitation.email}</strong>
          <p>This invitation has not been sent. Share this one-time code with the intended person through a private channel. It expires {new Date(invitation.expires_at).toLocaleString()}.</p>
          <code style={{ display: "block", overflowWrap: "anywhere", userSelect: "all" }}>{invitation.invitation_token}</code>
          <Button type="button" variant="secondary" onClick={() => { const link = window.location.origin + "/invite/caregiver#token=" + encodeURIComponent(invitation.invitation_token); void navigator.clipboard?.writeText(link); }}>Copy secure invitation link</Button>
        </div>
      )}

      {members.length > 0 && (
        <div style={{ display: "grid", gap: "0.65rem", marginTop: "1rem" }}>
          <h3 className="mobile-settings-label"><Shield size={15} aria-hidden /> People with access</h3>
          {members.map((member) => (
            <div key={member.caregiver_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.7rem" }}>
              <div>
                <strong>{member.name}</strong>
                <p className="mobile-settings-hint" style={{ margin: 0 }}>{member.email ?? "No email"} · {member.role === "primary" ? "Primary caregiver" : "Family caregiver"} · {member.status}</p>
              </div>
              {member.status === "active" && !member.can_manage_members && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void revoke(member)}><X size={15} aria-hidden /> Remove</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
      {notice && <p className="mobile-settings-hint" role="status">{notice}</p>}
      <Button type="button" variant="secondary" onClick={() => void load()} disabled={busy}>Refresh access list</Button>
    </section>
  );
}
