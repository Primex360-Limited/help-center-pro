import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AuthBackLink({ to = "/login", circled = false }) {
  const navigate = useNavigate();

  return (
    <button type="button" className="auth-back" onClick={() => navigate(to)}>
      {circled ? (
        <span className="auth-back-circle">
          <ArrowLeft size={14} strokeWidth={2.5} />
        </span>
      ) : (
        <ArrowLeft size={16} strokeWidth={2.25} />
      )}
      Back
    </button>
  );
}
