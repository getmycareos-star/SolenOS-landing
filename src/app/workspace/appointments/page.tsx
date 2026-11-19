"use client";

import AppointmentWorkspace from "@/components/workflows/AppointmentWorkspace";

export default function AppointmentsPage() {
  return (
    <section className="mobile-screen appointments-page">
      <header className="mobile-page-head">
        <p className="appointments-eyebrow">KEEP THE IMPORTANT DETAILS CLOSE</p>
        <h1>Appointments</h1>
        <p>Prepare for a visit, keep notes from it together, and remember the questions or next steps that matter.</p>
      </header>
      <AppointmentWorkspace />
    </section>
  );
}
