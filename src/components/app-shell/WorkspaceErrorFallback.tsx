"use client";

export function WorkspaceErrorFallback() {
  return (
    <main className="workspace-error-recovery" role="alert" aria-labelledby="workspace-error-title">
      <section>
        <h1 id="workspace-error-title">We couldn't display your workspace</h1>
        <p>
          SolenOS could not display this part of your workspace. We cannot confirm whether your last action
          was saved, so check your Care Record before trying that action again.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </section>
    </main>
  );
}
