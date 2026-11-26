"use client";

import { useEffect, useState } from "react";
import AppointmentWorkspace from "@/components/workflows/AppointmentWorkspace";

export default function AppointmentsPage() {
  const [scopeEpoch, setScopeEpoch] = useState(0);

  useEffect(() => {
    const resetAppointmentWorkspace = () => setScopeEpoch((value) => value + 1);
    window.addEventListener("personIdChanged", resetAppointmentWorkspace);
    return () => window.removeEventListener("personIdChanged", resetAppointmentWorkspace);
  }, []);

  return (
    <section className="mobile-screen appointments-page">
      <header className="mobile-page-head">
        <p className="appointments-eyebrow">KEEP THE IMPORTANT DETAILS CLOSE</p>
        <h1>Appointments</h1>
        <p>Prepare for a visit, keep notes from it together, and remember the questions or next steps that matter.</p>
      </header>
      <AppointmentWorkspace key={scopeEpoch} />
    </section>
  );
}
