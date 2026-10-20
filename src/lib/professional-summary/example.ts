// Example usage of the Professional Summary Manager
// This demonstrates how the professional summary workflow would work in practice

import {
  createProfessionalSummaryManager,
  addProfessionalSummaryCorrectionManager,
  approveProfessionalSummaryManager,
  shareProfessionalSummaryManager,
  recordProfessionalSummaryResponseManager,
  openProfessionalSummaryManager,
  getProfessionalSummaryManager,
} from "./professional-summary-manager";

// Example: Creating and processing a professional summary
function exampleProfessionalSummaryWorkflow() {
  // Step 1: Create a new professional summary
  const summary = createProfessionalSummaryManager({
    care_recipient_id: "person_123",
    authoring_caregiver_id: "caregiver_456",
    intended_professional_id: "professional_789",
    purpose_context: "Preparation for neurology appointment",
    care_context_version: "care_context_v1",
    source_evidence_references: ["event_001", "observation_002", "medication_record_003"],
    generated_content: "The patient has shown increased confusion over the past two weeks, particularly in the evenings. Medication adherence has been inconsistent. No falls reported.",
    created_by: "caregiver_456",
  });

  if (!summary) {
    console.error("Failed to create professional summary");
    return;
  }

  console.log("Created professional summary:", summary.id);

  // Step 2: Add a correction (caregiver realizes there was a fall)
  const correction = addProfessionalSummaryCorrectionManager({
    professional_summary_id: summary.id,
    field: "generated_content",
    original_content: "The patient has shown increased confusion over the past two weeks, particularly in the evenings. Medication adherence has been inconsistent. No falls reported.",
    corrected_content: "The patient has shown increased confusion over the past two weeks, particularly in the evenings. Medication adherence has been inconsistent. One fall reported on [date] with no injury.",
    correcting_caregiver_id: "caregiver_456",
    reason: "Forgot to include fall incident in initial summary",
    source_evidence_references: ["event_004"], // Fall incident report
  });

  if (correction) {
    console.log("Added correction:", correction.id);
  }

  // Step 3: Approve the summary
  const approval = approveProfessionalSummaryManager({
    professional_summary_id: summary.id,
    approving_caregiver_id: "caregiver_456",
  });

  if (approval) {
    console.log("Approved professional summary, version:", approval.version_approved);
  }

  // Step 4: Share with a professional
  const share = shareProfessionalSummaryManager({
    professional_summary_id: summary.id,
    shared_by: "caregiver_456",
    shared_with_professional_id: "professional_789",
  });

  if (share) {
    console.log("Shared professional summary with professional:", share.shared_with_professional_id);
  }

  // Step 5: Professional opens the summary
  const openedSummary = openProfessionalSummaryManager({
    professional_summary_id: summary.id,
    opened_by: "professional_789",
  });

  if (openedSummary) {
    console.log("Professional opened the summary");
  }

  // Step 6: Professional responds with a recommendation
  const response = recordProfessionalSummaryResponseManager({
    professional_summary_id: summary.id,
    responding_professional_id: "professional_789",
    response_text: "Thank you for the detailed summary. I recommend adjusting the medication dosage and scheduling a follow-up appointment in 2 weeks.",
    response_type: "recommendation",
    is_decision: true,
    decision_text: "Adjust medication dosage and schedule follow-up appointment in 2 weeks",
  });

  if (response) {
    console.log("Recorded professional response with decision:", response.decision_text);
  }

  // Get the final summary state
  const finalSummary = getProfessionalSummaryManager(summary.id);
  if (finalSummary) {
    console.log("Final summary status:", finalSummary.status);
    console.log("Final summary version:", finalSummary.version);
    console.log("Number of corrections:", finalSummary.caregiver_corrections.length);
    console.log("Has professional response:", !!finalSummary.professional_response);
    console.log("Resulting evidence count:", finalSummary.resulting_evidence_ids.length);
    console.log("Resulting decision count:", finalSummary.resulting_decision_ids.length);
  }
}

// Run the example
exampleProfessionalSummaryWorkflow();