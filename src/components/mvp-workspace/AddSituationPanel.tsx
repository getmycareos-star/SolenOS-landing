"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, FileText, Loader2, Plus, ScanLine, Share2 } from "lucide-react";

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
};

/**
 * Care entry — Input Entry Contract + ADR-018.
 * Scan / Snap / Upload / Share collect evidence only; same Living Care Record path.
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
}: Props) {
  const [extracting, setExtracting] = useState(false);
  const [localHint, setLocalHint] = useState<string | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [lastEntryMethod, setLastEntryMethod] = useState<InputEntryMethod | null>(null);
  const [shareHint, setShareHint] = useState(false);

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
        const failed = added.filter((d) => d.status === "failed");
        if (failed.length > 0 && added.every((d) => d.status === "failed")) {
          setLocalHint(
            failed[0]?.errorNote ??
              "Could not read that file. Type the key details, or try another photo.",
          );
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
      try {
        const res = await fetch(
          `/api/share-intake?id=${encodeURIComponent(pendingShareId!)}`,
        );
        const data = (await res.json()) as {
          ok?: boolean;
          text?: string;
          files?: Array<{ name: string; mimeType: string; base64: string }>;
        };
        if (cancelled || !res.ok || !data.ok) return;

        if (data.text?.trim()) {
          onChange(value ? `${value}\n\n${data.text.trim()}` : data.text.trim());
          setLastEntryMethod("share");
        }

        if (data.files?.length) {
          const files = data.files.map((f) => {
            const binary = atob(f.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
              bytes[i] = binary.charCodeAt(i);
            }
            return new File([bytes], f.name, { type: f.mimeType });
          });
          await ingestFiles(files, "share");
        }
        onShareClaimed?.();
      } catch {
        /* share claim is best-effort */
      }
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

  return (
    <div className="workspace-panel-inner add-situation">
      <h2 className="workspace-headline">
        {mode === "update" ? "What changed?" : "What is happening right now?"}
      </h2>
      {isFirstCapture ? (
        <p className="workspace-lede">
          Help SolenOS understand the current care situation. Start by telling what has been
          happening — notes, messages, documents, or photos. Fragments are fine.
        </p>
      ) : mode === "update" ? (
        <p className="workspace-lede">Add whatever changed — fragments are fine.</p>
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

            <button
              type="button"
              className="composer-action"
              disabled={busy}
              aria-label="Share into SolenOS from other apps"
              onClick={() => setShareHint((v) => !v)}
            >
              <Share2 size={20} aria-hidden />
              <span>Share</span>
            </button>
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

        {shareHint && (
          <p className="panel-muted share-entry-hint" role="status">
            From WhatsApp, Email, Photos, or Files — use Share → SolenOS (when installed as an app).
            Shared content enters the same care record as Scan, Snap, and Upload.
          </p>
        )}

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
              : "What happened? Notes, messages, or documents — as they are."
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
        <ul className="attached-list" aria-label="Attached documents">
          {documents.map((doc) => (
            <li key={doc.id}>
              {doc.name}
              {doc.status === "pending" && " · Reading…"}
              {doc.status === "failed" &&
                ` · ${sanitizeCaregiverErrorMessage(doc.errorNote ?? "Could not read this document.")}`}
              {doc.status === "ready" && " · Attached"}
              <button
                type="button"
                className="link-button"
                onClick={() => onDocumentsChange(documents.filter((d) => d.id !== doc.id))}
                disabled={loading}
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
