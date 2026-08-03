"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import type { SituationDocument } from "@/lib/ui-runtime";

const SOURCE_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  captured: "Captured",
  shared: "Shared",
  extracted: "Extracted",
};

export default function DocumentsPage() {
  const { runtime } = useWorkspace();

  const documents = useMemo(() => {
    const map = new Map<string, SituationDocument & { situationTitle: string }>();
    for (const s of runtime.situations) {
      for (const doc of s.documents) {
        map.set(doc.id, { ...doc, situationTitle: s.title });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id));
  }, [runtime.situations]);

  if (documents.length === 0) {
    return (
      <div className="documents-page">
        <h1 className="page-title">Documents & Records</h1>
        <p className="page-lede">
          All uploaded, scanned, and captured documents attached to care situations.
        </p>
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h2 className="empty-state-title">No documents yet</h2>
          <p className="empty-state-body">
            Documents and records will appear here as you add them to care situations.
          </p>
          <Link href="/workspace" className="settings-button settings-button--primary">
            Add your first document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="documents-page">
      <h1 className="page-title">Documents & Records</h1>
      <p className="page-lede">
        All uploaded, scanned, and captured documents attached to care situations.
      </p>
      <div className="page-actions">
        <Link href="/workspace" className="settings-button settings-button--primary">
          Add record
        </Link>
      </div>
      <div className="documents-list">
        {documents.map((doc) => (
          <div key={doc.id} className="document-card">
            <h3 className="document-card-title">{doc.title}</h3>
            <p className="document-card-meta">
              From: {doc.situationTitle} · {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
            </p>
            <p className="document-card-summary">{doc.summary}</p>
            <span className="document-card-source">{SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
