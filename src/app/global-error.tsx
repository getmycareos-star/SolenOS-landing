"use client";

import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#fafaf9",
          color: "#1c1917",
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            padding: "32px",
            borderRadius: "12px",
            border: "1px solid #e7e5e4",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <h1 style={{
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "8px",
              color: "#1c1917",
            }}>
              Something went wrong
            </h1>
            <p style={{
              fontSize: "14px",
              color: "#78716c",
              marginBottom: "24px",
              lineHeight: 1.6,
            }}>
              SolenOS encountered an unexpected error. Your care information is safe.
              Please try again or refresh the page.
            </p>
            <div style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#1c1917",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #e7e5e4",
                  backgroundColor: "#ffffff",
                  color: "#1c1917",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Go to home page
              </button>
            </div>
            {error.digest && (
              <p style={{
                fontSize: "12px",
                color: "#a8a29e",
                marginTop: "16px",
                fontFamily: "monospace",
              }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
