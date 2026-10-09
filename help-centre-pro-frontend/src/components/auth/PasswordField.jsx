import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  bordered = false,
  autoComplete = "current-password",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label ? (
        <label className="auth-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="auth-input-wrap">
        <input
          id={id}
          className={`auth-input has-toggle ${bordered ? "auth-input--bordered" : ""}`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
    </div>
  );
}
