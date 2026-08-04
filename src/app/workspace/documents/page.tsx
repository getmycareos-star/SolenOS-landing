"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import type { SituationDocument } from "@/lib/ui-runtime";

const SOURCE_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  captured: "Captured",
  shared: "Shared",
  extracted: "Extracted",
};

const FILE_ICONS: Record<string, LucideIcon> = {
  jpg: Image,
  jpeg: Image,
  png: Image,
  webp: Image,
  heic: Image,
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
};

function fileIcon(title: string): LucideIcon {
  const ext = title.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? FileText;
}

function ChevronRight({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size ?? 18}
      height={size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const { runtime } = useWorkspace();
type DocumentWithSituation = SituationDocument & { situationTitle: string };
  const [preview, setPreview] = useState<DocumentWithSituation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const documents = useMemo(() => {
    const map = new Map<string, SituationDocument & { situationTitle: string }>();
    for (const s of runtime.situations) {
      for (const doc of s.documents) {
        map.set(doc.id, { ...doc, situationTitle: s.title });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id));
  }, [runtime.situations]);

  // Show loading state briefly when a document preview opens.
  useEffect(() => {
    if (!preview) return;
    setPreviewLoading(true);
    const t = setTimeout(() => setPreviewLoading(false), 450);
    return () => clearTimeout(t);
  }, [preview]);

  if (documents.length === 0) {
    return (
      <div className="mobile-screen">
        <div className="mobile-page-head">
          <h1>Documents</h1>
          <p>Uploaded, scanned, and captured documents in the record.</p>
        </div>
        <div className="mobile-empty">
          <div className="mobile-empty-icon" aria-hidden="true">
            <FileText size={40} />
          </div>
          <h2 className="mobile-empty-title">No documents yet</h2>
          <p className="mobile-empty-body">
            Documents will appear here as you add them to the care record.
          </p>
          <div className="mobile-empty-actions">
            <Button
              variant="primary"
              onClick={() => router.push("/workspace?compose=1")}
            >
              <Plus size={18} aria-hidden />
              Add your first document
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      <div className="mobile-page-head">
        <h1>Documents</h1>
        <p>Uploaded, scanned, and captured documents in the record.</p>
      </div>

      <div className="mobile-documents">
        {documents.map((doc) => {
          const Icon = fileIcon(doc.title);
          return (
            <button
              key={doc.id}
              type="button"
              className="mobile-document-card"
              aria-label={`Open ${doc.title}`}
              onClick={() => setPreview(doc)}
            >
              <span className="mobile-document-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="mobile-document-body">
                <span className="mobile-document-title">{doc.title}</span>
                <span className="mobile-document-meta">
                  {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType} ·{" "}
                  {doc.situationTitle}
                </span>
              </span>
              <ChevronRight
                className="mobile-document-chevron"
                size={18}
              />
            </button>
          );
        })}
      </div>

      {preview && (
        <div
          className="mobile-doc-preview"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
        >
          <div className="mobile-doc-preview-header">
            <h2 className="mobile-doc-preview-title">{preview.title}</h2>
            <Button
              variant="icon"
              className="mobile-doc-preview-close"
              aria-label="Close preview"
              onClick={() => setPreview(null)}
            >
              <X size={20} aria-hidden />
            </Button>
          </div>
          <div className="mobile-doc-preview-body">
            {previewLoading ? (
              <div className="mobile-loading">
                <div className="mobile-loading-spinner" aria-hidden="true" />
                <span className="mobile-loading-text">
                  Loading document…
                </span>
              </div>
            ) : (
              <div>
                <p>
                  <strong>Source:</strong>{" "}
                  {SOURCE_LABELS[preview.sourceType] ?? preview.sourceType}
                </p>
                <p>
                  <strong>From:</strong> {preview.situationTitle}
                </p>
                {preview.summary ? (
                  <p>{preview.summary}</p>
                ) : (
                  <p>No summary available for this document.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

