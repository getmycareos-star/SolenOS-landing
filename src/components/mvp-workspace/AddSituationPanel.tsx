"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, FileText, Loader2, MoreHorizontal, Plus, ScanLine } from "lucide-react";

import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputProvenance } from "@/lib/care-events";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import {
  UPLOAD_FILE_ACCEPT,
  entryMethodToInputType,
} from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";
import { UPLOAD_PRIVACY_NOTICE } from "@/lib/early-access-trust";
import Link from "next/link";
import { extractAttachedDocument } from "./capture/extract-attached";
import { SnapCameraCapture } from "./capture/SnapCameraCapture";
import { ScanDocumentCapture } from "./capture/ScanDocumentCapture";

type Props = {
  value: string;
  onChange: (value: string) => void;
  documents: AttachedDocument[];
  onDocumentsChange: (docs: AttachedDocument[]) => void;
  onSubmit: (provenance: InputProvenance) => void;
  loading: boolean;
  error: string | null;
  hasContextRoot: boolean;
  mode?: "initial" | "update";
  /** Pending share-target intake id from /share redirect. */
  pendingShareId?: string | null;
  onShareClaimed?: () => void;
  /** Workspace-level metadata for the More menu. */
  caregiverId?: string;
  careSessionId?: string;
  careRecipientName?: string;
};

/**
 * Care entry — Input Entry Contract + ADR-018.
 * Scan / Snap / Upload collect evidence only; same Living Care Record path.
 * Product-level sharing is handled separately in Settings.
 */
export function AddSituationPanel({
  value,
  onChange,
  documents,
  onDocumentsChange,
  onSubmit,
  loading,
  error,
  hasContextRoot,
  mode = "initial",
  pendingShareId = null,
  onShareClaimed,
  caregiverId = "",
  careSessionId = "",
  careRecipientName,
}: Props) {
  const [extracting, setExtracting] = useState(false);
  const [localHint, setLocalHint] = useState<string | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [lastEntryMethod, setLastEntryMethod] = useState<InputEntryMethod | null>(null);

  const hasReadyDocs = documents.some((d) => d.status === "ready" && d.extractedText.trim());
  const canSubmit = (value.trim().length > 0 || hasReadyDocs) && !loading && !extracting;
  const displayError = error ? sanitizeCaregiverErrorMessage(error) : null;
  const busy = loading || extracting;

  const ingestFiles = useCallback(
    async (files: File[], method: InputEntryMethod) => {
      if (!files.length) return;
      setLocalHint(null);
      setLastEntryMethod(method);
      setExtracting(true);
      try {
        const added: AttachedDocument[] = [];
        for (const file of files) {
          added.push(await extractAttachedDocument(file, method));
        }
        onDocumentsChange([...documents, ...added]);
        const imageNeedsManualText = added.find(
          (d) => d.status === "ready" && !d.extractedText.trim() && Boolean(d.evidenceId) && Boolean(d.errorNote),
        );
        if (imageNeedsManualText?.errorNote) {
          setLocalHint(imageNeedsManualText.errorNote);
        } else {
          const failed = added.filter((d) => d.status === "failed");
          if (failed.length > 0 && added.every((d) => d.status === "failed")) {
            setLocalHint(
              failed[0]?.errorNote ??
                "Could not read that file. Type the key details, or try another supported file.",
            );
          }
        }
      } finally {
        setExtracting(false);
      }
    },
    [documents, onDocumentsChange],
  );

  useEffect(() => {
    if (!pendingShareId) return;
    let cancelled = false;

    async function claimShare() {
      if (cancelled) return;
      // The backend does not currently register /api/share-intake. Do not make
      // a request that will fail or pretend shared content was imported.
      setLocalHint(
        "Incoming share intake is not connected in this deployment. Paste the text or use Upload in the workspace; no shared content has been imported.",
      );
      onShareClaimed?.();
    }

    void claimShare();
    return () => {
      cancelled = true;
    };
    // Intentionally once per pendingShareId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShareId]);

  const handleTextChange = useCallback(
    (next: string) => {
      onChange(next);
      setLocalHint(null);
      if (next.trim()) setLastEntryMethod("text");
    },
    [onChange],
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      setLocalHint("Type a note or attach a document / photo first — fragments are fine.");
      return;
    }
    setLocalHint(null);
    const entryMethod: InputEntryMethod =
      lastEntryMethod ??
      (hasReadyDocs
        ? (documents.find((d) => d.entryMethod)?.entryMethod ?? "upload")
        : "text");
    const provenance: InputProvenance = {
      input_type: hasReadyDocs && !value.trim() ? "document" : entryMethodToInputType(entryMethod),
      entry_method: hasReadyDocs && !value.trim() ? entryMethod : value.trim() ? "text" : entryMethod,
      captured_at: new Date().toISOString(),
    };
    onSubmit(provenance);
  }, [canSubmit, documents, hasReadyDocs, lastEntryMethod, onSubmit, value]);

  const isFirstCapture = mode === "initial" && !hasContextRoot;

  const handleRetryDoc = useCallback(
    async (doc: AttachedDocument) => {
      setLocalHint(null);
      setExtracting(true);
      try {
        const file = doc.sourceFile;
        if (!file) {
          setLocalHint("That file is no longer available — try attaching it again.");
          return;
        }
        const next = await extractAttachedDocument(file, doc.entryMethod ?? "upload");
        onDocumentsChange(
          documents.map((d) => (d.id === doc.id ? { ...next, id: d.id } : d)),
        );
        if (next.status === "failed" || (next.status === "ready" && !next.extractedText.trim())) {
          setLocalHint(next.errorNote ?? "Text extraction is not available for this file. Type the key details instead.");
        } else {
          setLocalHint(null);
        }
      } finally {
        setExtracting(false);
      }
    },
    [documents, onDocumentsChange],
  );

  return (
    <div className="workspace-panel-inner add-situation">
      <h2 className="workspace-headline">
        {mode === "update" ? "Add a new detail" : "Add to your care record"}
      </h2>
      {isFirstCapture ? (
        <p className="workspace-lede">
          Write a few words, paste a message, or add a document or photo. You do not need to organise it first.
        </p>
      ) : mode === "update" ? (
        <p className="workspace-lede">Tell us what changed since the last entry. Short notes are enough.</p>
      ) : null}

      <div className="composer-shell">
        <div className="composer-toolbar" role="group" aria-label="Evidence entry">
          <div className="composer-actions">
            <button
              type="button"
              className="composer-action"
              disabled={busy}
              aria-label="Snap — open live camera"
              onClick={() => setSnapOpen(true)}
            >
              <Camera size={20} aria-hidden />
              <span>Snap</span>
            </button>

            <button
              type="button"
              className="composer-action"
              disabled={busy}
              aria-label="Scan — open document scanner"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine size={20} aria-hidden />
              <span>Scan</span>
            </button>

            <label className="composer-action file-attach">
              <input
                type="file"
                accept={UPLOAD_FILE_ACCEPT}
                multiple
                disabled={busy}
                aria-label="Upload existing files"
                onChange={(e) => {
                  const list = e.target.files;
                  if (list?.length) void ingestFiles(Array.from(list), "upload");
                  e.target.value = "";
                }}
              />
              <FileText size={20} aria-hidden />
              <span>{extracting ? "Reading…" : "Upload"}</span>
            </label>

          </div>

          <button
            type="button"
            className="workspace-primary composer-send"
            disabled={!canSubmit}
            onClick={handleSubmit}
            aria-label="Add to record"
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={18} aria-hidden />
                Preserving…
              </>
            ) : (
              <>
                <Plus size={18} aria-hidden />
                Add to record
              </>
            )}
          </button>
        </div>

        <p className="panel-muted upload-privacy-notice" role="note">
          {UPLOAD_PRIVACY_NOTICE}{" "}
          <Link href="/privacy">Learn more about privacy</Link>.
        </p>

        <textarea
          className="brain-dump composer-textarea"
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            mode === "update"
              ? "What changed since last time?"
              : "Start with what you want to remember…"
          }
          rows={6}
          disabled={busy}
          aria-label="Describe your situation"
          autoFocus
        />
      </div>

      {(localHint || displayError) && (
        <p className="workspace-error" role="alert">
          {displayError ?? localHint}
        </p>
      )}

      {documents.length > 0 && (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              {doc.name}
              {doc.status === "pending" && " · Reading…"}
              {doc.status === "failed" &&
                ` · ${sanitizeCaregiverErrorMessage(doc.errorNote ?? "Could not read this document.")}`}
              {doc.status === "ready" && " · Attached"}
              {doc.status === "failed" && (
                <button
                  type="button"
                  className="link-button"
                  disabled={loading}
                  onClick={() => void handleRetryDoc(doc)}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                className="link-button"
                disabled={loading}
                onClick={() => onDocumentsChange(documents.filter((d) => d.id !== doc.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasContextRoot && (
        <p className="panel-muted">Ctrl+Enter (⌘+Enter) to add. Documents alone are enough.</p>
      )}

      <SnapCameraCapture
        open={snapOpen}
        onClose={() => setSnapOpen(false)}
        onCapture={(file) => {
          void ingestFiles([file], "snap");
        }}
      />
      <ScanDocumentCapture
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCapturePages={(files) => {
          void ingestFiles(files, "scan");
        }}
      />

    </div>
  );
}
