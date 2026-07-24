interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  strings: {
    inputLabel: string;
    inputPlaceholder: string;
    submitIdle: string;
    submitLoading: string;
  };
}

/**
 * Persistent input bar — always visible.
 * Input updates system state; it never becomes a chat transcript.
 */
export function InputBar({
  value,
  onChange,
  onSubmit,
  loading,
  error,
  strings,
}: InputBarProps) {
  return (
    <section className="input-bar" aria-label="Situation input" data-persistent="true">
      <label htmlFor="situation-input" className="label">
        {strings.inputLabel}
      </label>
      <textarea
        id="situation-input"
        className="input input-bar-field"
        rows={3}
        placeholder={strings.inputPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !loading && value.trim()) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="input-bar-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
        >
          {loading ? strings.submitLoading : strings.submitIdle}
        </button>
        <span className="input-bar-hint">Updates operational state — not a chat</span>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
