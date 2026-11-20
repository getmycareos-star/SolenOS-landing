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
  permissions: string[];
  granted_at: string | null;
};
type Responsibility = {
  id: string;
  caregiver_id: string;
  responsibility_type: string;
  scope?: string | null;
  status: string;
  effective_start?: string | null;
  effective_end?: string | null;
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
type ResponsibilityGapReviewItem = {
  id: string;
  type: string;
  scope?: string | null;
  status: string;
  provenance?: string | null;
};
type PerspectiveConflictReviewItem = {
  id: string;
  caregiver_a: string;
  caregiver_b: string;
  claim_a: string;
  claim_b: string;
  context_a?: string | null;
  context_b?: string | null;
  status: string;
};
type DuplicateActionReviewItem = {
  id: string;
  caregiver_a: string;
  caregiver_b: string;
  action_type: string;
  action_description_a: string;
  action_description_b: string;
  time_a?: string | null;
  time_b?: string | null;
  status: string;
  resolution?: string | null;
};
type MultiCaregiverSummary = {
  caregivers?: CaregiverNetworkMember[];
  active_responsibilities?: unknown[];
  active_handoffs?: unknown[];
  responsibility_gaps?: ResponsibilityGapReviewItem[];
  perspective_conflicts?: PerspectiveConflictReviewItem[];
  duplicate_actions?: DuplicateActionReviewItem[];
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
type CaregiverActivity = {
  id: string;
  activity_type: string;
  description: string;
  occurred_at: string;
};
const CARE_ACTIVITY_OPTIONS = [
  { value: "performed_task", label: "Completed a care task" },
  { value: "reported_observation", label: "Recorded an observation" },
  { value: "communicated", label: "Communicated with another caregiver" },
  { value: "coordinated_appointment", label: "Coordinated an appointment" },
  { value: "uploaded_document", label: "Added a care document" },
  { value: "acknowledged_instruction", label: "Acknowledged care information" },
  { value: "delegated", label: "Assigned a care responsibility" },
  { value: "handed_off", label: "Handed over a care responsibility" },
  { value: "requested_clarification", label: "Requested clarification" },
  { value: "updated_medication_info", label: "Updated medication information" },
] as const;

const CARE_PERMISSION_OPTIONS = [
  { value: "view_lcr", label: "View the Care Record" },
  { value: "add_evidence", label: "Add care notes and observations" },
  { value: "manage_responsibilities", label: "Assign and change care responsibilities" },
  { value: "manage_reminders", label: "Create and manage reminders" },
  { value: "complete_assigned_reminders", label: "Complete assigned reminders" },
  { value: "manage_handoffs", label: "Send and manage care handoffs" },
  { value: "share_summaries", label: "Share care summaries" },
  { value: "share_observations", label: "Share observations with the care team" },
  { value: "view_documents", label: "View care documents" },
  { value: "view_communications", label: "View caregiver updates" },
] as const;

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
  const [responsibilityHistory, setResponsibilityHistory] = useState<Responsibility[]>([]);
  const [responsibilityHistoryUnavailable, setResponsibilityHistoryUnavailable] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const [activities, setActivities] = useState<CaregiverActivity[]>([]);
  const [activityType, setActivityType] = useState<(typeof CARE_ACTIVITY_OPTIONS)[number]["value"]>("performed_task");
  const [activityDescription, setActivityDescription] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [newResponsibilityType, setNewResponsibilityType] = useState("");
  const [newResponsibilityScope, setNewResponsibilityScope] = useState("");
  const [savingResponsibility, setSavingResponsibility] = useState(false);
  const [openLoops, setOpenLoops] = useState<OpenLoop[]>([]);
  const [networkSummary, setNetworkSummary] = useState<MultiCaregiverSummary | null>(null);
  const [networkState, setNetworkState] = useState<CareNetworkState | null>(null);
  const [gapReviewStatuses, setGapReviewStatuses] = useState<Record<string, "covered" | "partially_covered" | "resolved">>({});
  const [gapReviewNotes, setGapReviewNotes] = useState<Record<string, string>>({});
  const [conflictReviewNotes, setConflictReviewNotes] = useState<Record<string, string>>({});
  const [duplicateReviewStatuses, setDuplicateReviewStatuses] = useState<Record<string, "confirmed_duplicate" | "appropriate_parallel">>({});
  const [duplicateReviewNotes, setDuplicateReviewNotes] = useState<Record<string, string>>({});
  const [reviewingNetworkItemId, setReviewingNetworkItemId] = useState<string | null>(null);
  const [communications, setCommunications] = useState<CaregiverCommunication[]>([]);
  const [careContexts, setCareContexts] = useState<CaregiverContext[]>([]);
  const [contextProximity, setContextProximity] = useState<"" | "lives_with" | "local" | "regional" | "remote">("");
  const [contextWindowStart, setContextWindowStart] = useState("");
  const [contextWindowEnd, setContextWindowEnd] = useState("");
  const [contextAvailabilityNotes, setContextAvailabilityNotes] = useState("");
  const [contextShareConfirmed, setContextShareConfirmed] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
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
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [currentSessionCaregiverId, setCurrentSessionCaregiverId] = useState("");

  const load = useCallback(async () => {
    if (!getAnonymousAccessToken()) {
      setAllowed(false);
      setCanManageMembers(false);
      setCurrentProfileId(null);
      setResponsibilityHistory([]);
      setResponsibilityHistoryUnavailable(false);
      setCurrentPersonId(null);
      setActivities([]);
      setCurrentSessionCaregiverId("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const personId = session.person.id;
      const caregiverId = session.caregiver.id;
      setCurrentPersonId(personId);
      setCurrentSessionCaregiverId(caregiverId);

      const [
        transferResult,
        primaryTransferResult,
        memberResult,
        profileResult,
        responsibilityResult,
        loopResult,
        networkResult,
        networkStateResult,
        communicationResult,
        contextResult,
        observationResult,
        perspectiveResult,
        roleResult,
        activityResult,
      ] = await Promise.allSettled([
        getJSON("/caregiver-access/responsibility-transfers") as Promise<Transfer[]>,
        getJSON("/caregiver-access/primary-transfers") as Promise<PrimaryTransfer[]>,
        getJSON("/caregiver-access/members") as Promise<Member[]>,
        getJSON("/caregiver-profiles/current") as Promise<{ id: string }>,
        getJSON("/caregiver-responsibilities/" + encodeURIComponent(personId)) as Promise<Responsibility[]>,
        getJSON("/open-loops") as Promise<{ items?: OpenLoop[] }>,
        getJSON("/multi-caregiver-summary/" + encodeURIComponent(personId) + "?person_id=" + encodeURIComponent(personId)) as Promise<MultiCaregiverSummary>,
        getJSON("/care-network-state/" + encodeURIComponent(personId)) as Promise<CareNetworkState>,
        getJSON("/caregiver-communications") as Promise<CaregiverCommunication[]>,
        getJSON("/caregiver-contexts") as Promise<CaregiverContext[]>,
        getJSON("/caregiver-observations/" + encodeURIComponent(personId) + "?caregiver_id=" + encodeURIComponent(caregiverId)) as Promise<CaregiverPrivateObservation[]>,
        getJSON("/caregiver-perspectives/" + encodeURIComponent(personId) + "?caregiver_id=" + encodeURIComponent(caregiverId)) as Promise<CaregiverPrivatePerspective[]>,
        getJSON("/caregiver-roles/" + encodeURIComponent(personId)) as Promise<CaregiverRole[]>,
        getJSON("/caregiver-activities/" + encodeURIComponent(personId) + "?limit=30") as Promise<CaregiverActivity[]>,
      ]);

      if (transferResult.status === "fulfilled") setTransfers(transferResult.value ?? []);
      else setTransfers([]);
      if (primaryTransferResult.status === "fulfilled") setPrimaryTransfers(primaryTransferResult.value ?? []);
      else setPrimaryTransfers([]);

      const members = memberResult.status === "fulfilled" ? memberResult.value ?? [] : [];
      setCanManageMembers(memberResult.status === "fulfilled");
      setMembers(members);

      const ownProfileId = profileResult.status === "fulfilled"
        ? profileResult.value.id
        : members.find((item) => item.caregiver_id === caregiverId)?.caregiver_profile_id ?? null;
      setCurrentProfileId(ownProfileId);
      if (ownProfileId) {
        try {
          const history = await getJSON(
            "/caregiver-responsibilities/history/" + encodeURIComponent(ownProfileId) + "?person_id=" + encodeURIComponent(personId),
          ) as Responsibility[];
          setResponsibilityHistory(history ?? []);
          setResponsibilityHistoryUnavailable(false);
        } catch {
          setResponsibilityHistory([]);
          setResponsibilityHistoryUnavailable(true);
        }
      } else {
        setResponsibilityHistory([]);
        setResponsibilityHistoryUnavailable(false);
      }

      if (responsibilityResult.status === "fulfilled") {
        setResponsibilities((responsibilityResult.value ?? []).filter((item) => item.status !== "historical" && item.status !== "gap"));
      } else setResponsibilities([]);
      if (loopResult.status === "fulfilled") setOpenLoops(loopResult.value.items ?? []);
      else setOpenLoops([]);

      if (networkResult.status === "fulfilled") {
        setNetworkSummary(networkResult.value);
        setAllowed(true);
      } else {
        setNetworkSummary(null);
        setAllowed(false);
      }
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
      if (roleResult.status === "fulfilled" && ownProfileId) {
        setMyRoles((roleResult.value ?? []).filter((item) => item.caregiver_id === ownProfileId && item.is_current));
      } else setMyRoles([]);
      if (activityResult.status === "fulfilled") setActivities(activityResult.value ?? []);
      else setActivities([]);

      if (profileResult.status === "rejected") {
        setError("We couldn't confirm your caregiver profile. Your personal care details are hidden until it can be checked.");
      }
    } catch {
      setError("We couldn't load caregiver access. Please try again.");
      setAllowed(false);
      setCanManageMembers(false);
      setCurrentPersonId(null);
      setCurrentProfileId(null);
      setResponsibilityHistory([]);
      setResponsibilityHistoryUnavailable(true);
      setActivities([]);
      setNetworkSummary(null);
      setNetworkState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  const saveCaregiverActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPersonId || !currentProfileId || !activityDescription.trim()) return;
    setSavingActivity(true);
    setError("");
    setNotice("");
    try {
      const created = await postJSON("/caregiver-activities", {
        person_id: currentPersonId,
        caregiver_id: currentProfileId,
        activity_type: activityType,
        description: activityDescription.trim(),
        occurred_at: new Date().toISOString(),
        is_anonymous: false,
        shared_account_id: null,
        related_entity_type: null,
        related_entity_id: null,
        extra_metadata: null,
      }) as CaregiverActivity;
      if (!created?.id) throw new Error("The server did not return a saved activity record.");
      setActivities((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 30));
      setActivityDescription("");
      setNotice("Activity saved to the caregiver history. It does not change the Living Care Record.");
    } catch {
      setError("We couldn't confirm that this activity was saved. Refresh the caregiver history before trying again.");
    } finally {
      setSavingActivity(false);
    }
  };

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

  const updateMemberPermissions = async (member: Member, permissions: string[]) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await patchJSON("/caregiver-access/members/" + encodeURIComponent(member.caregiver_id) + "/permissions", {
        permissions,
      });
      setNotice("Access permissions updated for " + member.name + ".");
      await load();
    } catch {
      setError("We couldn't update these permissions. " + member.name + "'s previous access remains in place.");
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

  const saveCaregiverContext = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contextShareConfirmed) {
      setError("Please confirm that this availability information can be shared with the care team.");
      return;
    }
    setSavingContext(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      await postJSON("/caregiver-contexts", {
        person_id: session.person.id,
        caregiver_id: session.caregiver.id,
        proximity_category: contextProximity || null,
        observation_window_start: contextWindowStart.trim() || null,
        observation_window_end: contextWindowEnd.trim() || null,
        availability_notes: contextAvailabilityNotes.trim() || null,
        effective_start: new Date().toISOString(),
      });
      setNotice("Your care context was shared with caregivers who have access to this Care Record.");
      setContextProximity("");
      setContextWindowStart("");
      setContextWindowEnd("");
      setContextAvailabilityNotes("");
      setContextShareConfirmed(false);
      await load();
    } catch {
      setError("We couldn't share this care context. Check your access and try again.");
    } finally {
      setSavingContext(false);
    }
  };

  const reviewResponsibilityGap = async (item: ResponsibilityGapReviewItem) => {
    const resolution = (gapReviewNotes[item.id] ?? "").trim();
    if (resolution.length < 5) {
      setError("Add a short explanation before saving this care coverage review.");
      return;
    }
    setReviewingNetworkItemId(item.id);
    setError("");
    setNotice("");
    try {
      await postJSON("/responsibility-gaps/" + encodeURIComponent(item.id) + "/review", {
        status: gapReviewStatuses[item.id] ?? "resolved",
        resolution,
      });
      setNotice("Care coverage review saved. The earlier gap remains in the care history.");
      await load();
    } catch {
      setError("We couldn't save this care coverage review. The existing responsibility record has not been changed.");
    } finally {
      setReviewingNetworkItemId(null);
    }
  };

  const resolvePerspectiveConflict = async (item: PerspectiveConflictReviewItem) => {
    const resolution = (conflictReviewNotes[item.id] ?? "").trim();
    if (resolution.length < 5) {
      setError("Add a short explanation before completing this review.");
      return;
    }
    setReviewingNetworkItemId(item.id);
    setError("");
    setNotice("");
    try {
      await postJSON("/perspective-conflicts/" + encodeURIComponent(item.id) + "/resolve", { resolution });
      setNotice("Review saved. Both caregiver accounts remain preserved; this does not change the Living Care Record.");
      await load();
    } catch {
      setError("We couldn't complete this review. Both original caregiver accounts remain unchanged.");
    } finally {
      setReviewingNetworkItemId(null);
    }
  };

  const reviewDuplicateAction = async (item: DuplicateActionReviewItem) => {
    const resolution = (duplicateReviewNotes[item.id] ?? "").trim();
    if (resolution.length < 5) {
      setError("Add a short explanation before saving this review.");
      return;
    }
    setReviewingNetworkItemId(item.id);
    setError("");
    setNotice("");
    try {
      await postJSON("/duplicate-actions/" + encodeURIComponent(item.id) + "/review", {
        status: duplicateReviewStatuses[item.id] ?? "confirmed_duplicate",
        resolution,
      });
      setNotice("Possible duplicate action reviewed. The original caregiver activity records remain unchanged.");
      await load();
    } catch {
      setError("We couldn't save this review. The original caregiver activity records remain unchanged.");
    } finally {
      setReviewingNetworkItemId(null);
    }
  };

  const caregiverNameFor = (caregiverId: string) =>
    networkSummary?.caregivers?.find((item) => item.caregiver_id === caregiverId)?.name ?? "Caregiver";

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

  const updateMemberStatus = async (member: Member, status: "active" | "suspended") => {
    const message = status === "suspended"
      ? "Pause " + member.name + "'s access? Their current sessions will stop working. Their past care notes will remain."
      : "Restore " + member.name + "'s access? They will need to sign in again.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await patchJSON(
        "/caregiver-access/members/" + encodeURIComponent(member.caregiver_id) + "/status",
        { status },
      );
      if (status === "suspended" && result?.sessions_revoked !== true) {
        throw new Error("The server did not confirm session revocation.");
      }
      setNotice(status === "suspended"
        ? member.name + "'s access is paused. Their earlier care notes remain saved."
        : member.name + "'s access is restored. They need to sign in again.");
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
          {canManageMembers && (
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

            </>
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
              <h3 className="mobile-settings-label" style={{ margin: 0 }}>Caregiver activity history</h3>
              <p className="mobile-settings-hint" style={{ margin: "0.25rem 0 0" }}>Record an action you took while helping with care. This history is separate from the Living Care Record and may be visible to caregivers who have access.</p>
            </div>
            <form onSubmit={(event) => void saveCaregiverActivity(event)} style={{ display: "grid", gap: "0.5rem" }}>
              <label className="mobile-settings-label" htmlFor="caregiver-activity-type">What kind of activity was it?</label>
              <select id="caregiver-activity-type" className="mobile-settings-input" value={activityType} onChange={(event) => setActivityType(event.target.value as (typeof CARE_ACTIVITY_OPTIONS)[number]["value"])}>
                {CARE_ACTIVITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <label className="mobile-settings-label" htmlFor="caregiver-activity-description">What did you do?</label>
              <textarea id="caregiver-activity-description" className="mobile-settings-input" rows={2} maxLength={500} required value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} placeholder="Add a short description of the activity." />
              <Button type="submit" variant="secondary" disabled={savingActivity || !currentProfileId || !activityDescription.trim()} loading={savingActivity}>Save activity</Button>
            </form>
            {activities.length > 0 ? (
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {activities.slice(0, 10).map((item) => (
                  <div key={item.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.55rem" }}>
                    <p style={{ margin: "0 0 0.2rem", fontSize: "0.9rem" }}>{item.description}</p>
                    <span className="mobile-settings-hint">{caregiverFieldLabel(item.activity_type)} · {new Date(item.occurred_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mobile-settings-hint" style={{ margin: 0 }}>No caregiver activities have been recorded yet.</p>
            )}
          </section>

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
              {currentProfileId && (
                <section style={{ display: "grid", gap: "0.55rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border, #d8ded8)" }}>
                  <h4 className="mobile-settings-label" style={{ margin: 0 }}>Your responsibility history</h4>
                  {responsibilityHistoryUnavailable ? (
                    <p className="mobile-settings-hint" style={{ margin: 0 }}>We couldn't load your responsibility history. Refresh this section to try again.</p>
                  ) : responsibilityHistory.length > 0 ? responsibilityHistory.slice(0, 12).map((item) => (
                    <div key={item.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.5rem" }}>
                      <strong style={{ fontSize: "0.88rem" }}>{caregiverFieldLabel(item.responsibility_type)} · {caregiverStatusLabel(item.status)}</strong>
                      <p className="mobile-settings-hint" style={{ margin: "0.2rem 0 0" }}>
                        {item.scope || "No scope recorded"} · Started {item.effective_start ? new Date(item.effective_start).toLocaleDateString() : "date not recorded"} · {item.effective_end ? "Ended " + new Date(item.effective_end).toLocaleDateString() : "Current"}
                      </p>
                    </div>
                  )) : (
                    <p className="mobile-settings-hint" style={{ margin: 0 }}>No responsibility history has been recorded for your caregiver profile yet.</p>
                  )}
                </section>
              )}
              {((networkSummary.responsibility_gaps?.length ?? 0) > 0
                || (networkSummary.perspective_conflicts?.length ?? 0) > 0
                || (networkSummary.duplicate_actions?.filter((item) => item.status === "potential_duplicate").length ?? 0) > 0) && (
                <section style={{ display: "grid", gap: "0.75rem" }}>
                  <h4 className="mobile-settings-label" style={{ margin: 0 }}>Care network items to review</h4>
                  {networkSummary.responsibility_gaps?.map((item) => (
                    <div key={item.id} style={{ display: "grid", gap: "0.5rem", padding: "0.7rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "9px" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Care coverage: {caregiverFieldLabel(item.type)}</strong>
                      <span className="mobile-settings-hint">{item.scope || "No responsibility scope recorded"} · {caregiverStatusLabel(item.status)}</span>
                      <label className="mobile-settings-hint" htmlFor={"gap-review-status-" + item.id}>Review outcome</label>
                      <select
                        id={"gap-review-status-" + item.id}
                        className="mobile-settings-input"
                        value={gapReviewStatuses[item.id] ?? "resolved"}
                        onChange={(event) => setGapReviewStatuses((current) => ({ ...current, [item.id]: event.target.value as "covered" | "partially_covered" | "resolved" }))}
                      >
                        <option value="partially_covered">Partly covered — some care is still unassigned</option>
                        <option value="covered">Covered by an agreed caregiver</option>
                        <option value="resolved">No longer a care coverage gap</option>
                      </select>
                      <textarea
                        className="mobile-settings-input"
                        rows={2}
                        maxLength={2000}
                        value={gapReviewNotes[item.id] ?? ""}
                        onChange={(event) => setGapReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Describe who is covering this responsibility or what remains open."
                        aria-label="Care coverage review explanation"
                      />
                      <Button type="button" variant="secondary" disabled={reviewingNetworkItemId === item.id || (gapReviewNotes[item.id] ?? "").trim().length < 5} loading={reviewingNetworkItemId === item.id} onClick={() => void reviewResponsibilityGap(item)}>Save review</Button>
                    </div>
                  ))}
                  {networkSummary.perspective_conflicts?.map((item) => (
                    <div key={item.id} style={{ display: "grid", gap: "0.5rem", padding: "0.7rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "9px" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Different caregiver accounts</strong>
                      <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>{caregiverNameFor(item.caregiver_a)}:</strong> {item.claim_a}</p>
                      <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>{caregiverNameFor(item.caregiver_b)}:</strong> {item.claim_b}</p>
                      {(item.context_a || item.context_b) && <p className="mobile-settings-hint" style={{ margin: 0 }}>Context: {item.context_a || "Not recorded"} / {item.context_b || "Not recorded"}</p>}
                      <p className="mobile-settings-hint" style={{ margin: 0 }}>These accounts are kept separate. A difference does not establish which account is correct or change the Living Care Record.</p>
                      <textarea
                        className="mobile-settings-input"
                        rows={2}
                        maxLength={2000}
                        value={conflictReviewNotes[item.id] ?? ""}
                        onChange={(event) => setConflictReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Record what was clarified, or why both accounts should remain."
                        aria-label="Perspective review explanation"
                      />
                      <Button type="button" variant="secondary" disabled={reviewingNetworkItemId === item.id || (conflictReviewNotes[item.id] ?? "").trim().length < 5} loading={reviewingNetworkItemId === item.id} onClick={() => void resolvePerspectiveConflict(item)}>Complete review</Button>
                    </div>
                  ))}
                  {networkSummary.duplicate_actions?.filter((item) => item.status === "potential_duplicate").map((item) => (
                    <div key={item.id} style={{ display: "grid", gap: "0.5rem", padding: "0.7rem", border: "1px solid var(--border, #d8ded8)", borderRadius: "9px" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Possible duplicate: {caregiverFieldLabel(item.action_type)}</strong>
                      <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>{caregiverNameFor(item.caregiver_a)}:</strong> {item.action_description_a}</p>
                      <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>{caregiverNameFor(item.caregiver_b)}:</strong> {item.action_description_b}</p>
                      <label className="mobile-settings-hint" htmlFor={"duplicate-review-status-" + item.id}>Review outcome</label>
                      <select
                        id={"duplicate-review-status-" + item.id}
                        className="mobile-settings-input"
                        value={duplicateReviewStatuses[item.id] ?? "confirmed_duplicate"}
                        onChange={(event) => setDuplicateReviewStatuses((current) => ({ ...current, [item.id]: event.target.value as "confirmed_duplicate" | "appropriate_parallel" }))}
                      >
                        <option value="confirmed_duplicate">These are the same action</option>
                        <option value="appropriate_parallel">These are separate, appropriate actions</option>
                      </select>
                      <textarea
                        className="mobile-settings-input"
                        rows={2}
                        maxLength={2000}
                        value={duplicateReviewNotes[item.id] ?? ""}
                        onChange={(event) => setDuplicateReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Explain the review outcome."
                        aria-label="Possible duplicate review explanation"
                      />
                      <Button type="button" variant="secondary" disabled={reviewingNetworkItemId === item.id || (duplicateReviewNotes[item.id] ?? "").trim().length < 5} loading={reviewingNetworkItemId === item.id} onClick={() => void reviewDuplicateAction(item)}>Save review</Button>
                    </div>
                  ))}
                </section>
              )}
              <section style={{ display: "grid", gap: "0.55rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border, #d8ded8)" }}>
                <h3 className="mobile-settings-label">Share your care context</h3>
                <p className="mobile-settings-hint">Help the care team understand when and how you can help. This information is shared with caregivers who have access to this Care Record; it does not change the person's Living Care Record.</p>
                <form onSubmit={(event) => void saveCaregiverContext(event)} style={{ display: "grid", gap: "0.55rem" }}>
                  <label className="mobile-settings-label" htmlFor="care-context-proximity">Where are you based relative to the person you help?</label>
                  <select id="care-context-proximity" className="mobile-settings-input" value={contextProximity} onChange={(event) => setContextProximity(event.target.value as typeof contextProximity)}>
                    <option value="">Not specified</option>
                    <option value="lives_with">I live with them</option>
                    <option value="local">I live nearby</option>
                    <option value="regional">I live in the same region</option>
                    <option value="remote">I live farther away</option>
                  </select>
                  <label className="mobile-settings-label" htmlFor="care-context-window-start">When are you usually available? (optional)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                    <input id="care-context-window-start" className="mobile-settings-input" value={contextWindowStart} onChange={(event) => setContextWindowStart(event.target.value)} placeholder="e.g. weekday mornings" maxLength={120} />
                    <input aria-label="Availability window end" className="mobile-settings-input" value={contextWindowEnd} onChange={(event) => setContextWindowEnd(event.target.value)} placeholder="e.g. after 5 PM" maxLength={120} />
                  </div>
                  <label className="mobile-settings-label" htmlFor="care-context-notes">Anything else the care team should know? (optional)</label>
                  <textarea id="care-context-notes" className="mobile-settings-input" rows={3} maxLength={1200} value={contextAvailabilityNotes} onChange={(event) => setContextAvailabilityNotes(event.target.value)} placeholder="Share practical availability details, not medical conclusions." />
                  <label className="mobile-settings-hint" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <input type="checkbox" checked={contextShareConfirmed} onChange={(event) => setContextShareConfirmed(event.target.checked)} aria-label="Care context sharing confirmation" />
                    I understand this information will be shared with caregivers who have access to this Care Record.
                  </label>
                  <Button type="submit" variant="secondary" disabled={savingContext || !contextShareConfirmed} loading={savingContext}>Share care context</Button>
                </form>
              </section>
              {careContexts.length > 0 && (
                <div>
                  <span className="mobile-settings-hint">Care availability and context</span>
                  {careContexts.slice(0, 5).map((item) => (
                    <div key={item.id} style={{ margin: "0.35rem 0", fontSize: "0.88rem" }}>
                      <p style={{ margin: 0 }}>
                        {item.proximity_category ? caregiverFieldLabel(item.proximity_category) : "Care context"}
                        {item.observation_window_start ? ` · ${item.observation_window_start}` : ""}
                        {item.observation_window_end ? ` to ${item.observation_window_end}` : ""}
                      </p>
                      {item.availability_notes && <p style={{ margin: "0.15rem 0", color: "var(--muted-foreground, #5f6b63)" }}>{item.availability_notes}</p>}
                    </div>
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

          {canManageMembers && (
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
                  {member.status === "active" && !member.can_manage_members && member.access_scope === "full_record" && (
                    <fieldset style={{ border: "1px solid var(--border, #d8ded8)", borderRadius: "10px", padding: "0.65rem", marginTop: "0.6rem" }}>
                      <legend className="mobile-settings-label">What this caregiver can do</legend>
                      <div style={{ display: "grid", gap: "0.45rem" }}>
                        {CARE_PERMISSION_OPTIONS.map((permission) => (
                          <label key={permission.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
                            <input
                              type="checkbox"
                              checked={(member.permissions ?? []).includes(permission.value)}
                              disabled={busy}
                              onChange={(event) => {
                                const current = new Set(member.permissions ?? []);
                                if (event.target.checked) current.add(permission.value);
                                else current.delete(permission.value);
                                void updateMemberPermissions(member, Array.from(current));
                              }}
                            />
                            {permission.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
                {!member.can_manage_members && member.status === "active" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateMemberStatus(member, "suspended")}><Shield size={15} aria-hidden /> Pause access</Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void revoke(member)}><X size={15} aria-hidden /> Remove</Button>
                  </div>
                )}
                {!member.can_manage_members && member.status === "suspended" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateMemberStatus(member, "active")}><Check size={15} aria-hidden /> Restore access</Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void revoke(member)}><X size={15} aria-hidden /> Remove</Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          )}
          {canManageMembers && (
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

          )}
          {canManageMembers && (
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
          )}
        </>
      ) : (
        <p className="mobile-settings-hint">Shared caregiver information is not available with your current access. You can still manage your own care responsibilities and care role.</p>
      )}

      {currentProfileId && (
        <>
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
        </>
      )}

      {primaryTransfers.length > 0 && (
        <div style={{ display: "grid", gap: "0.7rem", marginTop: "1rem" }}>
          <h3 className="mobile-settings-label">Main caregiver changes</h3>
          {primaryTransfers.map((transfer) => (
            <div key={transfer.id} style={{ borderTop: "1px solid var(--border, #d8ded8)", paddingTop: "0.7rem" }}>
              <strong>Change main caregiver · {caregiverStatusLabel(transfer.status) || "Status not available"}</strong>
              {transfer.reason && <p className="mobile-settings-hint">{transfer.reason}</p>}
              {transfer.status === "pending" && transfer.to_caregiver_id === currentSessionCaregiverId && (
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
              {transfer.status === "pending" && transfer.to_caregiver_profile_id === currentProfileId && (
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
