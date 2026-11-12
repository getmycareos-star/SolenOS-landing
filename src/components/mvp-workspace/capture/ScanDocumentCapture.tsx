"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function cameraRecoveryMessage(error: unknown, mode: "snap" | "scan"): string {
  const name = error instanceof DOMException ? error.name : "";
  const fallback = mode === "scan"
    ? "The document camera could not start. Check camera access or upload the document file instead."
    : "The camera could not start. Check camera access or upload a photo instead.";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access is blocked. Allow camera permission for SolenOS in your browser or device settings, then try again. You can upload a file instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera was found on this device. Connect or enable a camera, or upload a file instead.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera is busy or was interrupted. Close other apps using the camera and try again, or upload a file instead.";
  }
  if (name === "TypeError" || typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot open a camera here. Use a supported browser over a secure connection, or upload a file instead.";
  }
  return fallback;
}

export type ScanCropInsets = { top: number; right: number; bottom: number; left: number };
export type ScanPageFile = File & {
  scanRotationDegrees: number;
  scanCropInsetsPercent: ScanCropInsets;
};
type ScanPage = { file: File; rotationDegrees: number; cropInsetsPercent: ScanCropInsets };
type Props = {
  open: boolean;
  onClose: () => void;
  onCapturePages: (files: ScanPageFile[]) => void;
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
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setPages([]);
      setSelectedPage(0);
      return;
    }

    let cancelled = false;
    setError(null);
    setPages([]);
    setSelectedPage(0);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new TypeError("Camera API unavailable");
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
      } catch (cause) {
        stop();
        if (!cancelled) setError(cameraRecoveryMessage(cause, "scan"));
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
        setPages((prev) => {
          const next = [...prev, { file, rotationDegrees: 0, cropInsetsPercent: { top: 0, right: 0, bottom: 0, left: 0 } }];
          setSelectedPage(next.length - 1);
          return next;
        });
      },
      "image/jpeg",
      0.92,
    );
  }

  function finish() {
    if (pages.length === 0) return;
    onCapturePages(pages.map((page) => Object.assign(page.file, {
      scanRotationDegrees: page.rotationDegrees,
      scanCropInsetsPercent: page.cropInsetsPercent,
    })) as ScanPageFile[]);
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
              setSelectedPage(0);
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
          <section aria-label="Captured scan pages" style={{ display: "grid", gap: 10 }}>
            <p className="panel-muted">{pages.length} page{pages.length === 1 ? "" : "s"} captured. Originals are saved unchanged; adjustments below are used only to improve server-side text reading.</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pages.map((page, index) => <button key={page.file.name} type="button" aria-pressed={selectedPage === index} onClick={() => setSelectedPage(index)} className={selectedPage === index ? "workspace-primary" : "workspace-secondary"}>Page {index + 1}</button>)}
            </div>
            {pages[selectedPage] && <div style={{ display: "grid", gap: 8, border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>Adjust page {selectedPage + 1}</strong>
                <button type="button" className="workspace-secondary" onClick={() => setPages((prev) => prev.map((page, index) => index === selectedPage ? { ...page, rotationDegrees: (page.rotationDegrees + 90) % 360 } : page))}>Rotate 90°</button>
              </div>
              <p className="panel-muted">Trim dark edges or background clutter. Keep the full text inside the crop.</p>
              {(["top", "right", "bottom", "left"] as const).map((edge) => <label key={edge} style={{ display: "grid", gridTemplateColumns: "68px 1fr 32px", gap: 8, alignItems: "center", fontSize: 12 }}>
                <span>{edge[0].toUpperCase() + edge.slice(1)}</span>
                <input aria-label={edge + " crop"} type="range" min="0" max="30" step="1" value={pages[selectedPage].cropInsetsPercent[edge]} onChange={(event) => setPages((prev) => prev.map((page, index) => index === selectedPage ? { ...page, cropInsetsPercent: { ...page.cropInsetsPercent, [edge]: Number(event.target.value) } } : page))} />
                <span>{pages[selectedPage].cropInsetsPercent[edge]}%</span>
              </label>)}
            </div>}
          </section>
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
