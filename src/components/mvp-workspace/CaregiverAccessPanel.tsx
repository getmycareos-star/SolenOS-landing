"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Shield, UserPlus, Users, X, Check, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getAnonymousAccessToken, getJSON, postJSON, patchJSON, deleteJSON } from "@/api/client";
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
type CaregiverNetworkMember = {
  caregiver_id: string;
  name: string;
  relationship: string;
  involvement_status: string;
  roles?: Array<{ role_type?: string; custom_role_name?: string; scope?: string }>;
  responsibilities?: Array<{ type?: string; scope?: string; status?: string }>;
  recent_observations?: Array<{ content?: string; observation_type?: string; is_shared?: boolean }>;
  recent_perspectives?: Array<{ claim_type?: string; claim_content?: string; is_promoted_to_shared?: boolean }>;
  recent_activities?: Array<{ activity_type?: string; description?: string; occurred_at?: string }>;
};
type MultiCaregiverSummary = {
  caregivers?: CaregiverNetworkMember[];
  active_responsibilities?: unknown[];
  active_handoffs?: unknown[];
  responsibility_gaps?: unknown[];
  perspective_conflicts?: unknown[];
  duplicate_actions?: unknown[];
};
type CareNetworkState = {
  active_caregiver_count?: number;
  unresolved_handoff_count?: number;
  gap_count?: number;
  conflict_count?: number;
  communication_relationships?: Array<{ id: string; type?: string; is_active?: boolean }>;
};
type CaregiverCommunication = {
  id: string;
  subject?: string | null;
  content_summary?: string | null;
  direction?: string;
  communication_time?: string;
  acknowledgment_level?: string | null;
};
type CaregiverRole = {
  id: string;
  caregiver_id: string;
  role_type: string;
  custom_role_name?: string | null;
  scope?: string | null;
  is_current: boolean;
  effective_start: string;
};
const CARE_ROLE_OPTIONS = [
  { value: "medication_manager", label: "Medication support" },
  { value: "appointment_coordinator", label: "Appointments" },
  { value: "transportation_coordinator", label: "Transportation" },
  { value: "overnight_caregiver", label: "Overnight care" },
  { value: "emergency_contact", label: "Emergency contact" },
  { value: "primary_family_caregiver", label: "Main family caregiver" },
  { value: "secondary_caregiver", label: "Additional caregiver" },
  { value: "occasional_caregiver", label: "Occasional care" },
  { value: "paid_caregiver", label: "Paid caregiver" },
  { value: "home_health_worker", label: "Home health support" },
  { value: "financial_coordinator", label: "Finances" },
  { value: "temporary_caregiver", label: "Temporary care" },
  { value: "facility_staff", label: "Facility staff" },
  { value: "legal_guardian", label: "Legal guardian" },
  { value: "healthcare_proxy", label: "Health care proxy" },
  { value: "custom", label: "Other" },
] as const;
type CaregiverContext = {
  id: string;
  caregiver_id: string;
  proximity_category?: string | null;
  observation_window_start?: string | null;
  observation_window_end?: string | null;
  availability_notes?: string | null;
};
type CaregiverPrivateObservation = {
  id: string;
  observation_content: string;
  observation_type: string;
  information_visibility: string;
  is_promoted_to_shared: boolean;
  report_time?: string;
};
type CaregiverPrivatePerspective = {
  id: string;
  claim_type: string;
  claim_content: string;
  context?: string | null;
  information_visibility: string;
  is_promoted_to_shared: boolean;
  timestamp?: string;
};
type InvitationResult = {
  invitation_id: string;
  email: string;
  expires_at: string;
  invitation_token: string;
  delivery_status: "not_sent" | string;
};

export function CaregiverAccessPanel({ enabled = true }: { enabled?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [newResponsibilityType, setNewResponsibilityType] = useState("");
  const [newResponsibilityScope, setNewResponsibilityScope] = useState("");
  const [savingResponsibility, setSavingResponsibility] = useState(false);
  const [openLoops, setOpenLoops] = useState<OpenLoop[]>([]);
  const [networkSummary, setNetworkSummary] = useState<MultiCaregiverSummary | null>(null);
  const [networkState, setNetworkState] = useState<CareNetworkState | null>(null);
  const [communications, setCommunications] = useState<CaregiverCommunication[]>([]);
  const [careContexts, setCareContexts] = useState<CaregiverContext[]>([]);
  const [myRoles, setMyRoles] = useState<CaregiverRole[]>([]);
  const [selectedCareRole, setSelectedCareRole] = useState<string>("appointment_coordinator");
  const [customCareRole, setCustomCareRole] = useState("");
  const [careRoleScope, setCareRoleScope] = useState("");
  const [savingCareRole, setSavingCareRole] = useState(false);
  const [communicationSubject, setCommunicationSubject] = useState("");
  const [communicationBody, setCommunicationBody] = useState("");
  const [sendingCommunication, setSendingCommunication] = useState(false);
  const [myObservations, setMyObservations] = useState<CaregiverPrivateObservation[]>([]);
  const [myPerspectives, setMyPerspectives] = useState<CaregiverPrivatePerspective[]>([]);
  const [observationDraft, setObservationDraft] = useState("");
  const [perspectiveDraft, setPerspectiveDraft] = useState("");
  const [perspectiveType, setPerspectiveType] = useState<"belief" | "interpretation">("interpretation");
  const [savingPrivateContext, setSavingPrivateContext] = useState(false);
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
        const session = await ensureAnonymousSession();
        const personId = session.person.id;
        const caregiverId = session.caregiver.id;
        const ownProfileId = (memberResult.value ?? []).find((item) => item.caregiver_id === caregiverId)?.caregiver_profile_id ?? null;
        setCurrentProfileId(ownProfileId);
        const [responsibilityResult, loopResult, networkResult, networkStateResult, communicationResult, contextResult, observationResult, perspectiveResult, roleResult] = await Promise.allSettled([
          getJSON("/caregiver-responsibilities/" + encodeURIComponent(personId)) as Promise<Responsibility[]>,
          getJSON("/open-loops") as Promise<{ items?: OpenLoop[] }>,
          getJSON("/multi-caregiver-summary") as Promise<MultiCaregiverSummary>,
          getJSON("/care-network-state") as Promise<CareNetworkState>,
          getJSON("/caregiver-communications") as Promise<CaregiverCommunication[]>,
          getJSON("/caregiver-contexts") as Promise<CaregiverContext[]>,
          getJSON("/caregiver-observations/" + encodeURIComponent(personId) + "?caregiver_id=" + encodeURIComponent(caregiverId)) as Promise<CaregiverPrivateObservation[]>,
          getJSON("/caregiver-perspectives/" + encodeURIComponent(personId) + "?caregiver_id=" + encodeURIComponent(caregiverId)) as Promise<CaregiverPrivatePerspective[]>,
          getJSON("/caregiver-roles/" + encodeURIComponent(personId)) as Promise<CaregiverRole[]>,
        ]);
        if (responsibilityResult.status === "fulfilled") {
          setResponsibilities((responsibilityResult.value ?? []).filter((item) => item.status !== "historical" && item.status !== "gap"));
        } else setResponsibilities([]);
        if (loopResult.status === "fulfilled") setOpenLoops(loopResult.value.items ?? []);
        if (networkResult.status === "fulfilled") setNetworkSummary(networkResult.value);
        else setNetworkSummary(null);
        if (networkStateResult.status === "fulfilled") setNetworkState(networkStateResult.value);
        else setNetworkState(null);
        if (communicationResult.status === "fulfilled") setCommunications(communicationResult.value ?? []);
        else setCommunications([]);
        if (contextResult.status === "fulfilled") setCareContexts(contextResult.value ?? []);
        else setCareContexts([]);
        if (observationResult.status === "fulfilled") setMyObservations(observationResult.value ?? []);
        else setMyObservations([]);
        if (perspectiveResult.status === "fulfilled") setMyPerspectives(perspectiveResult.value ?? []);
        else setMyPerspectives([]);
        if (roleResult.status === "fulfilled") {
          setMyRoles((roleResult.value ?? []).filter((item) => item.caregiver_id === ownProfileId && item.is_current));
        } else setMyRoles([]);
      } else {
        setAllowed(false);
        setNetworkSummary(null);
        setNetworkState(null);
        setCommunications([]);
        setCareContexts([]);
        setMyObservations([]);
        setMyPerspectives([]);
        setMyRoles([]);
        setCurrentProfileId(null);
        setResponsibilities([]);
        if (transferResult.status === "rejected") setError("We couldn't load your care handover. Please try again.");
      }
    } catch {
      setError("We couldn't load caregiver access. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

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

  const sendCareCircleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!communicationBody.trim()) return;
    setSendingCommunication(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-communications", {
        person_id: session.person.id,
        from_caregiver_id: session.caregiver.id,
        direction: "broadcast",
        subject: communicationSubject.trim() || null,
        content_summary: communicationBody.trim(),
        is_private: false,
        visibility: "shared",
      });
      setCommunicationSubject("");
      setCommunicationBody("");
      setNotice("Your update has been shared with the care circle.");
      await load();
    } catch {
      setError("We couldn't share this update. Nothing was sent to the care circle.");
    } finally {
      setSendingCommunication(false);
    }
  };

  const savePrivateObservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!observationDraft.trim()) return;
    setSavingPrivateContext(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-observations", {
        person_id: session.person.id,
        caregiver_id: session.caregiver.id,
        observation_content: observationDraft.trim(),
        observation_type: "direct",
        information_visibility: "private",
        is_promoted_to_shared: false,
      });
      setObservationDraft("");
      setNotice("Your observation is saved privately. It has not been added to the shared Care Record.");
      await load();
    } catch {
      setError("We couldn't save this private observation. No care information was shared.");
    } finally {
      setSavingPrivateContext(false);
    }
  };

  const savePrivatePerspective = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!perspectiveDraft.trim()) return;
    setSavingPrivateContext(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-perspectives", {
        person_id: session.person.id,
        caregiver_id: session.caregiver.id,
        claim_type: perspectiveType,
        claim_content: perspectiveDraft.trim(),
        information_visibility: "private",
        is_promoted_to_shared: false,
      });
      setPerspectiveDraft("");
      setNotice("Your perspective is saved privately. It has not been added to the shared Care Record.");
      await load();
    } catch {
      setError("We couldn't save this private perspective. No care information was shared.");
    } finally {
      setSavingPrivateContext(false);
    }
  };

  const promotePrivateObservation = async (item: CaregiverPrivateObservation) => {
    setSavingPrivateContext(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-observations/" + encodeURIComponent(item.id) + "/promote", {});
      setNotice("Your observation is now shared with the care circle.");
      await load();
    } catch {
      setError("We couldn't share this observation. It remains private.");
    } finally {
      setSavingPrivateContext(false);
    }
  };

  const promotePrivatePerspective = async (item: CaregiverPrivatePerspective) => {
    setSavingPrivateContext(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/caregiver-perspectives/" + encodeURIComponent(item.id) + "/promote", {});
      setNotice("Your perspective is now shared with the care circle.");
      await load();
    } catch {
      setError("We couldn't share this perspective. It remains private.");
    } finally {
      setSavingPrivateContext(false);
    }
  };

  const createCareResponsibility = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newResponsibilityType.trim()) return;
    setSavingResponsibility(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-responsibilities", {
        person_id: session.person.id,
        caregiver_id: session.caregiver.id,
        responsibility_type: newResponsibilityType.trim(),
        scope: newResponsibilityScope.trim() || null,
        effective_start: new Date().toISOString(),
        status: "active",
        acceptance_status: "explicit",
        assignment_source: "caregiver_self_reported",
        is_joint: false,
      });
      setNewResponsibilityType("");
      setNewResponsibilityScope("");
      setNotice("Your care responsibility has been saved. You can hand it over when another caregiver accepts.");
      await load();
    } catch {
      setError("We couldn't save this care responsibility. No one else's responsibilities were changed.");
    } finally {
      setSavingResponsibility(false);
    }
  };

  const endCareResponsibility = async (item: Responsibility) => {
    setSavingResponsibility(true);
    setError("");
    setNotice("");
    try {
      await patchJSON("/caregiver-responsibilities/" + encodeURIComponent(item.id) + "/end", {});
      setNotice("Your care responsibility has ended. Its history is kept.");
      await load();
    } catch {
      setError("We couldn't end this care responsibility. It remains active.");
    } finally {
      setSavingResponsibility(false);
    }
  };

  const saveCareRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCareRole === "custom" && !customCareRole.trim()) return;
    setSavingCareRole(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-roles", {
        person_id: session.person.id,
        caregiver_id: session.caregiver.id,
        role_type: selectedCareRole,
        custom_role_name: selectedCareRole === "custom" ? customCareRole.trim() : null,
        scope: careRoleScope.trim() || null,
        effective_start: new Date().toISOString(),
        is_current: true,
        assignment_source: "caregiver_self_reported",
      });
      setCustomCareRole("");
      setCareRoleScope("");
      setNotice("Your care role has been shared with the care circle. It does not change anyone's account access.");
      await load();
    } catch {
      setError("We couldn't save this care role. No access permissions were changed.");
    } finally {
      setSavingCareRole(false);
    }
  };

  const endCareRole = async (role: CaregiverRole) => {
    setSavingCareRole(true);
    setError("");
    setNotice("");
    try {
      await patchJSON("/caregiver-roles/" + encodeURIComponent(role.id) + "/end", {});
      setNotice("Your care role has ended. Its history is kept.");
      await load();
    } catch {
      setError("We couldn't end this care role. It remains active.");
    } finally {
      setSavingCareRole(false);
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

          <form onSubmit={(event) => void sendCareCircleUpdate(event)} style={{ display: "grid", gap: "0.6rem", marginTop: "1rem", padding: "0.85rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "12px" }}>
            <h3 className="mobile-settings-label" style={{ margin: 0 }}>Share an update with the care circle</h3>
            <p className="mobile-settings-hint" style={{ margin: 0 }}>This update will be visible to caregivers who have access to this Care Record. Do not include information you want to keep private.</p>
            <label className="mobile-settings-label" htmlFor="care-circle-update-subject">Subject (optional)</label>
            <input id="care-circle-update-subject" className="mobile-settings-input" maxLength={160} value={communicationSubject} onChange={(event) => setCommunicationSubject(event.target.value)} placeholder="e.g. Update after today's visit" />
            <label className="mobile-settings-label" htmlFor="care-circle-update-body">Update</label>
            <textarea id="care-circle-update-body" className="mobile-settings-input" required maxLength={2000} rows={3} value={communicationBody} onChange={(event) => setCommunicationBody(event.target.value)} placeholder="Share what the other caregivers should know…" />
            <Button type="submit" variant="secondary" disabled={sendingCommunication || !communicationBody.trim()} loading={sendingCommunication}>
              {sendingCommunication ? undefined : "Share with caregivers"}
            </Button>
          </form>

          <section style={{ display: "grid", gap: "0.75rem", marginTop: "1rem", padding: "0.85rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "12px" }}>
            <div>
              <h3 className="mobile-settings-label" style={{ margin: 0 }}>Your private care notes</h3>
              <p className="mobile-settings-hint" style={{ margin: "0.25rem 0 0" }}>These notes belong to you. They are not evidence in the Living Care Record and are not shared unless you choose to share them with the care circle.</p>
            </div>
            <form onSubmit={(event) => void savePrivateObservation(event)} style={{ display: "grid", gap: "0.5rem" }}>
              <label className="mobile-settings-label" htmlFor="private-care-observation">Record an observation</label>
              <textarea id="private-care-observation" className="mobile-settings-input" rows={3} maxLength={2000} required value={observationDraft} onChange={(event) => setObservationDraft(event.target.value)} placeholder="What did you personally notice?" />
              <Button type="submit" variant="secondary" disabled={savingPrivateContext || !observationDraft.trim()} loading={savingPrivateContext}>Save privately</Button>
            </form>
            <form onSubmit={(event) => void savePrivatePerspective(event)} style={{ display: "grid", gap: "0.5rem" }}>
              <label className="mobile-settings-label" htmlFor="private-care-perspective">Record your perspective</label>
              <select id="private-care-perspective-type" className="mobile-settings-input" value={perspectiveType} onChange={(event) => setPerspectiveType(event.target.value as "belief" | "interpretation")}>
                <option value="interpretation">My interpretation</option>
                <option value="belief">What I believe</option>
              </select>
              <textarea id="private-care-perspective" className="mobile-settings-input" rows={3} maxLength={2000} required value={perspectiveDraft} onChange={(event) => setPerspectiveDraft(event.target.value)} placeholder="Add context about how you understand what happened…" />
              <Button type="submit" variant="secondary" disabled={savingPrivateContext || !perspectiveDraft.trim()} loading={savingPrivateContext}>Save privately</Button>
            </form>
            {(myObservations.length > 0 || myPerspectives.length > 0) && (
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {myObservations.slice(0, 8).map((item) => (
                  <div key={item.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.55rem" }}>
                    <p style={{ margin: "0 0 0.3rem", fontSize: "0.9rem" }}>{item.observation_content}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className="mobile-settings-hint">{item.is_promoted_to_shared ? "Shared with care circle" : "Private to you"}</span>
                      {!item.is_promoted_to_shared && <Button type="button" variant="secondary" disabled={savingPrivateContext} onClick={() => void promotePrivateObservation(item)}>Share with care circle</Button>}
                    </div>
                  </div>
                ))}
                {myPerspectives.slice(0, 8).map((item) => (
                  <div key={item.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.55rem" }}>
                    <p style={{ margin: "0 0 0.3rem", fontSize: "0.9rem" }}>{item.claim_content}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className="mobile-settings-hint">{item.is_promoted_to_shared ? "Shared with care circle" : "Private to you"}</span>
                      {!item.is_promoted_to_shared && <Button type="button" variant="secondary" disabled={savingPrivateContext} onClick={() => void promotePrivatePerspective(item)}>Share with care circle</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {networkSummary && (
            <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem", padding: "0.85rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "12px" }}>
              <h3 className="mobile-settings-label">Care coverage at a glance</h3>
              <p className="mobile-settings-hint" style={{ margin: 0 }}>A shared view of who is involved and where care responsibilities may need attention. Only information shared with the care circle appears here.</p>
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
              {networkState && (
                <p className="mobile-settings-hint" style={{ margin: 0 }}>
                  {networkState.active_caregiver_count ?? 0} active caregivers · {networkState.unresolved_handoff_count ?? 0} handovers awaiting confirmation · {networkState.gap_count ?? 0} responsibility gaps · {networkState.conflict_count ?? 0} differences to review
                </p>
              )}
              {careContexts.length > 0 && (
                <div>
                  <span className="mobile-settings-hint">Care availability and context</span>
                  {careContexts.slice(0, 5).map((item) => (
                    <p key={item.id} style={{ margin: "0.2rem 0", fontSize: "0.88rem" }}>
                      {item.proximity_category || "Care context"}{item.observation_window_start ? ` · ${item.observation_window_start}` : ""}{item.observation_window_end ? ` to ${item.observation_window_end}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {communications.length > 0 && (
                <div>
                  <span className="mobile-settings-hint">Care-team updates</span>
                  {communications.slice(0, 5).map((item) => (
                    <div key={item.id} style={{ padding: "0.45rem 0", borderTop: "1px solid var(--border, #d8ded8)" }}>
                      {item.subject && <strong style={{ display: "block", fontSize: "0.9rem" }}>{item.subject}</strong>}
                      {item.content_summary && <p style={{ margin: "0.15rem 0", fontSize: "0.88rem" }}>{item.content_summary}</p>}
                      <span className="mobile-settings-hint">{item.acknowledgment_level ? `Acknowledgment: ${item.acknowledgment_level}` : "Update"}</span>
                    </div>
                  ))}
                </div>
              )}
              <section style={{ display: "grid", gap: "0.5rem", paddingTop: "0.7rem", borderTop: "1px solid var(--border, #d8ded8)" }}>
                <h4 className="mobile-settings-label" style={{ margin: 0 }}>Your care responsibilities</h4>
                <p className="mobile-settings-hint" style={{ margin: 0 }}>Keep track of the care tasks you have agreed to handle. A task stays with you until it is handed over or ended.</p>
                {responsibilities.filter((item) => item.caregiver_id === currentProfileId).map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.9rem" }}>
                      {caregiverFieldLabel(item.responsibility_type) || item.responsibility_type}
                      {item.scope ? <span className="mobile-settings-hint"> · {item.scope}</span> : null}
                    </span>
                    <Button type="button" variant="secondary" disabled={savingResponsibility} onClick={() => void endCareResponsibility(item)}>End responsibility</Button>
                  </div>
                ))}
                <form onSubmit={createCareResponsibility} style={{ display: "grid", gap: "0.5rem" }}>
                  <label className="mobile-settings-label" htmlFor="caregiver-responsibility-type">Add a care responsibility</label>
                  <input id="caregiver-responsibility-type" className="mobile-settings-input" required maxLength={120} value={newResponsibilityType} onChange={(event) => setNewResponsibilityType(event.target.value)} placeholder="What will you take care of?" />
                  <input className="mobile-settings-input" aria-label="Care responsibility details (optional)" maxLength={300} value={newResponsibilityScope} onChange={(event) => setNewResponsibilityScope(event.target.value)} placeholder="Optional: add a little detail" />
                  <Button type="submit" variant="secondary" disabled={savingResponsibility || !newResponsibilityType.trim()} loading={savingResponsibility}>Save responsibility</Button>
                </form>
              </section>
              <section style={{ display: "grid", gap: "0.5rem", paddingTop: "0.7rem", borderTop: "1px solid var(--border, #d8ded8)" }}>
                <h4 className="mobile-settings-label" style={{ margin: 0 }}>What you help with</h4>
                <p className="mobile-settings-hint" style={{ margin: 0 }}>Share your care role so the team knows where you can help. This does not change your account access.</p>
                {myRoles.map((role) => (
                  <div key={role.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.9rem" }}>
                      {role.custom_role_name || CARE_ROLE_OPTIONS.find((item) => item.value === role.role_type)?.label || "Care role"}
                      {role.scope ? <span className="mobile-settings-hint"> · {role.scope}</span> : null}
                    </span>
                    <Button type="button" variant="secondary" disabled={savingCareRole} onClick={() => void endCareRole(role)}>End role</Button>
                  </div>
                ))}
                <form onSubmit={saveCareRole} style={{ display: "grid", gap: "0.5rem" }}>
                  <label className="mobile-settings-label" htmlFor="caregiver-role-type">Add a care role</label>
                  <select id="caregiver-role-type" className="mobile-settings-input" value={selectedCareRole} onChange={(event) => setSelectedCareRole(event.target.value)}>
                    {CARE_ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  {selectedCareRole === "custom" && (
                    <input className="mobile-settings-input" aria-label="Custom care role" required maxLength={80} value={customCareRole} onChange={(event) => setCustomCareRole(event.target.value)} placeholder="Describe your care role" />
                  )}
                  <input className="mobile-settings-input" aria-label="Care role details (optional)" maxLength={300} value={careRoleScope} onChange={(event) => setCareRoleScope(event.target.value)} placeholder="Optional: what you help with" />
                  <Button type="submit" variant="secondary" disabled={savingCareRole || (selectedCareRole === "custom" && !customCareRole.trim())} loading={savingCareRole}>Save care role</Button>
                </form>
              </section>
              {(networkSummary.caregivers ?? []).map((caregiver) => (
                <section key={caregiver.caregiver_id} style={{ display: "grid", gap: "0.35rem", paddingTop: "0.65rem", borderTop: "1px solid var(--border, #d8ded8)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong>{caregiver.name}</strong>
                    <span className="mobile-settings-hint">{caregiver.relationship} · {caregiver.involvement_status}</span>
                  </div>
                  {(caregiver.roles?.length ?? 0) > 0 && <p className="mobile-settings-hint" style={{ margin: 0 }}>Roles: {caregiver.roles?.map((role) => role.custom_role_name || role.role_type || "Care role").join(", ")}</p>}
                  {(caregiver.responsibilities?.length ?? 0) > 0 && <p className="mobile-settings-hint" style={{ margin: 0 }}>Responsibilities: {caregiver.responsibilities?.map((item) => item.type).filter(Boolean).join(", ")}</p>}
                  {(caregiver.recent_observations?.length ?? 0) > 0 && (
                    <div><span className="mobile-settings-hint">Shared observations</span>{caregiver.recent_observations?.slice(0, 3).map((item, index) => <p key={index} style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>{item.content}</p>)}</div>
                  )}
                  {(caregiver.recent_perspectives?.length ?? 0) > 0 && (
                    <div><span className="mobile-settings-hint">Shared perspectives</span>{caregiver.recent_perspectives?.slice(0, 3).map((item, index) => <p key={index} style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>{item.claim_content}</p>)}</div>
                  )}
                  {(caregiver.recent_activities?.length ?? 0) > 0 && (
                    <div><span className="mobile-settings-hint">Recent care activity</span>{caregiver.recent_activities?.slice(0, 3).map((item, index) => <p key={index} style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>{item.description}</p>)}</div>
                  )}
                </section>
              ))}
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
