import { Check } from "lucide-react";
import { getPasswordRequirements } from "../../utils/password.js";

const TONE_BY_ID = {
  length: "tone-blue",
  uppercase: "tone-green",
  lowercase: "tone-green",
  number: "tone-violet",
  special: "tone-blue",
};

export default function PasswordRequirements({ password }) {
  const requirements = getPasswordRequirements(password);

  return (
    <div className="password-reqs" aria-live="polite">
      {requirements.map((req) => (
        <span
          key={req.id}
          className={`password-req ${TONE_BY_ID[req.id] || ""} ${req.met ? "is-met" : ""}`}
        >
          {req.met ? <Check size={12} strokeWidth={3} /> : null}
          {req.label}
        </span>
      ))}
    </div>
  );
}
