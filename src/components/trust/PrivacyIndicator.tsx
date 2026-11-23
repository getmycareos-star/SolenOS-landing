"use client";

type AccessMember = {
  caregiver_id: string;
  name: string;
  access_scope: string;
  status: string;
};

export default function PrivacyIndicator({
  canViewAccessList,
  members,
}: {
  canViewAccessList: boolean;
  members: AccessMember[];
}) {
  if (!canViewAccessList) {
    return (
      <aside role="status" aria-live="polite" style={{ border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.75rem", margin: "0.75rem 0" }}>
        <strong>Who can see this Care Record</strong>
        <p className="mobile-settings-hint" style={{ margin: "0.35rem 0 0" }}>
          We couldn't check who can see this from your account. Ask the care-record administrator to review access.
        </p>
      </aside>
    );
  }

  const activeMembers = members.filter((member) => member.status === "active");
  const fullRecordCount = activeMembers.filter((member) => member.access_scope !== "documents_only").length;
  const documentsOnlyCount = activeMembers.length - fullRecordCount;
  return (
    <aside aria-label="Care Record privacy" style={{ border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.75rem", margin: "0.75rem 0" }}>
      <strong>Who can see this Care Record</strong>
      <p className="mobile-settings-hint" style={{ margin: "0.35rem 0 0" }}>
        {fullRecordCount} {fullRecordCount === 1 ? "caregiver can" : "caregivers can"} see the full Care Record.
        {" "}{documentsOnlyCount} {documentsOnlyCount === 1 ? "caregiver can" : "caregivers can"} see documents and appointment paperwork only.
        {" "}You can review each person's access below.
      </p>
    </aside>
  );
}
