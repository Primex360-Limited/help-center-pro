/**
 * Accessible on/off switch shared by the automation list and the rule form.
 * Styled from `src/styles/automations.css`.
 */
export default function ActiveToggle({
  checked,
  onChange,
  disabled = false,
  label = "Rule is active",
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      title={label}
      className={`automation-switch${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="automation-switch__thumb" aria-hidden="true" />
    </button>
  );
}
