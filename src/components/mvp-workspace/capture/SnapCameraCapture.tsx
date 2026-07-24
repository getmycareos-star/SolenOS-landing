"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

/**
 * Snap — live camera for something happening right now.
 * Not document scanning. Not the file picker.
 */
export function SnapCameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;
    setError(null);

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
          "Camera could not open. Check permissions, or use Upload for a photo already on your device.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  function captureFrame() {
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
        const file = new File([blob], `snap_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        stop();
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="entry-capture-overlay" role="dialog" aria-modal="true" aria-label="Snap">
      <div className="entry-capture-sheet entry-capture-snap">
        <header className="entry-capture-header">
          <h2>Snap</h2>
          <p>Capture what is happening right now — not a document scan.</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              stop();
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
          <div className="entry-capture-viewport">
            <video ref={videoRef} playsInline muted autoPlay className="entry-capture-video" />
          </div>
        )}

        <div className="entry-capture-actions">
          <button
            type="button"
            className="workspace-primary"
            disabled={!ready || !!error}
            onClick={captureFrame}
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
