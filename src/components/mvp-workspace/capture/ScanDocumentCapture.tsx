"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapturePages: (files: File[]) => void;
};

/**
 * Scan — document-oriented capture for physical papers.
 * Not the normal file picker. Not Snap's "moment" camera framing.
 * Web MVP: live capture with document framing until a native scanner API is available.
 */
export function ScanDocumentCapture({ open, onClose, onCapturePages }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState<File[]>([]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setPages([]);
      return;
    }

    let cancelled = false;
    setError(null);
    setPages([]);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch {
        setError(
          "Document scanner could not open. Check camera permissions, or use Upload for a file already saved.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  function capturePage() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `scan_page_${pages.length + 1}_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPages((prev) => [...prev, file]);
      },
      "image/jpeg",
      0.92,
    );
  }

  function finish() {
    if (pages.length === 0) return;
    onCapturePages(pages);
    stop();
    setPages([]);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="entry-capture-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Scan document"
    >
      <div className="entry-capture-sheet entry-capture-scan">
        <header className="entry-capture-header">
          <h2>Scan</h2>
          <p>
            Point at a paper document — discharge papers, med lists, letters. Add pages as needed.
          </p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              stop();
              setPages([]);
              onClose();
            }}
          >
            Close
          </button>
        </header>

        {error ? (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        ) : (
          <div className="entry-capture-viewport entry-capture-doc-frame">
            <video ref={videoRef} playsInline muted autoPlay className="entry-capture-video" />
            <div className="entry-capture-doc-guide" aria-hidden />
          </div>
        )}

        {pages.length > 0 && (
          <p className="panel-muted">
            {pages.length} page{pages.length === 1 ? "" : "s"} captured
          </p>
        )}

        <div className="entry-capture-actions">
          <button
            type="button"
            className="workspace-primary"
            disabled={!ready || !!error}
            onClick={capturePage}
          >
            Capture page
          </button>
          <button
            type="button"
            className="workspace-secondary"
            disabled={pages.length === 0}
            onClick={finish}
          >
            Use {pages.length || ""} page{pages.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
