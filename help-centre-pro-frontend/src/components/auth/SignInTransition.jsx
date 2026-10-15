import BrandLogo from "./BrandLogo.jsx";

/**
 * Branded hand-off shown between a successful sign-in and the dashboard so the
 * user never sees the sign-in form (or a flashing dashboard) again.
 */
export default function SignInTransition({
  message = "Preparing your workspace…",
}) {
  return (
    <div className="auth-page-dark">
      <div className="auth-handoff" role="status" aria-live="polite">
        <BrandLogo compact light />
        <p className="auth-handoff__message">{message}</p>
        <span className="auth-handoff__bar" aria-hidden="true" />
      </div>
    </div>
  );
}
