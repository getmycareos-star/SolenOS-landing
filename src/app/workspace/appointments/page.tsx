"use client";

import AppointmentWorkspace from "@/components/workflows/AppointmentWorkspace";

export default function AppointmentsPage() {
  return (
    <section className="mobile-screen" style={{ width: "100%", maxWidth: "960px", margin: "0 auto", padding: "24px 20px" }}>
      <p style={{ margin: "0 0 8px", color: "#64736b", fontSize: "12px", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Appointments</p>
      <h1 style={{ margin: "0 0 8px", color: "#172b35", fontSize: "clamp(1.6rem, 3vw, 2rem)", lineHeight: 1.2 }}>Appointment workspace</h1>
      <p style={{ maxWidth: "680px", margin: "0 0 20px", color: "#53645c", lineHeight: 1.6 }}>Prepare for visits, preserve the information recorded during them, and track follow-up questions and outcomes.</p>
      <AppointmentWorkspace />
    </section>
  );
}
