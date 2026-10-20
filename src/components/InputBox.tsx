interface InputBoxProps {
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

export function InputBox({
  value,
  onChange,
  onSubmit,
  loading,
  error,
  strings,
}: InputBoxProps) {
  return (
    <section className="panel">
      <label htmlFor="situation" className="label">
        {strings.inputLabel}
      </label>
      <textarea
        id="situation"
        className="input"
        rows={8}
        placeholder={strings.inputPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        className="btn-primary"
        onClick={onSubmit}
        disabled={loading || !value.trim()}
      >
        {loading ? strings.submitLoading : strings.submitIdle}
      </button>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
