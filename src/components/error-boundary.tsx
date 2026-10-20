"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error(`[ErrorBoundary:${this.props.name ?? "unknown"}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #fecaca",
          backgroundColor: "#fef2f2",
          color: "#991b1b",
        }}>
          <p style={{ fontWeight: 600, marginBottom: "8px" }}>
            {this.props.name ?? "This section"} encountered an error
          </p>
          <p style={{ fontSize: "14px", opacity: 0.8 }}>
            Please refresh the page or try again later.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: "12px",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #fecaca",
              backgroundColor: "#ffffff",
              color: "#991b1b",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
