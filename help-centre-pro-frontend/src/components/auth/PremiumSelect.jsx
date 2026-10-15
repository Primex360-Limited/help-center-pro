import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Premium searchable-feel select used on company details + admin invite.
 * options: [{ value, label }] or string[]
 */
export default function PremiumSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = "Select",
  required = false,
  disabled = false,
  className = "",
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const normalized = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
  const selected = normalized.find((opt) => opt.value === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`premium-select${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        id={id}
        type="button"
        className={`premium-select__trigger${!selected ? " is-placeholder" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={18} className="premium-select__chevron" />
      </button>

      {required ? (
        <input tabIndex={-1} className="premium-select__native" value={value || ""} required readOnly />
      ) : null}

      {open ? (
        <ul id={listId} className="premium-select__menu" role="listbox">
          {normalized.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={`premium-select__option${opt.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
