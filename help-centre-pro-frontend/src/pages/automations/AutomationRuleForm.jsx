import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  createAutomationRule,
  getAutomationRule,
  updateAutomationRule,
} from "../../api/automations.api.js";
import { listUsers } from "../../api/users.api.js";
import ActiveToggle from "../../components/automations/ActiveToggle.jsx";
import {
  AUTOMATION_RULE_TYPES,
  agentInitials,
  agentName,
  automationRuleType,
} from "../../constants/automationRules.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/automations.css";

const EMPTY_FORM = {
  name: "",
  type: "auto_acknowledge",
  description: "",
  assignToUserId: "",
  isActive: true,
};

/** Create or edit a single automation rule. */
export default function AutomationRuleForm() {
  const navigate = useNavigate();
  const { ruleId } = useParams();
  const isEdit = Boolean(ruleId);
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("ticket:assign");

  const [form, setForm] = useState(EMPTY_FORM);
  /** Snapshot used to decide whether Cancel should warn about losing edits. */
  const [baseline, setBaseline] = useState(EMPTY_FORM);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const meta = automationRuleType(form.type);
  const TypeIcon = meta.icon;
  /** Only routing rules hard-require a target agent; the catalog owns that flag. */
  const requiresAssignee = Boolean(meta.needsAssignee);
  /** Readers can inspect a rule but never mutate it. */
  const readOnly = !canWrite;

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === form.assignToUserId) || null,
    [agents, form.assignToUserId]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [ruleRes, usersRes] = await Promise.all([
          isEdit ? getAutomationRule(ruleId) : Promise.resolve(null),
          listUsers().catch(() => null),
        ]);

        if (cancelled) return;

        const directory = (usersRes?.data?.users || []).filter(
          (user) => String(user.status || "").toLowerCase() !== "inactive"
        );
        setAgents(directory);

        if (isEdit) {
          const rule = ruleRes?.data?.rule;
          if (!rule) {
            throw new Error("This automation rule no longer exists");
          }
          setForm({
            name: rule.name || "",
            type: rule.type || "auto_acknowledge",
            description: rule.description || "",
            assignToUserId: rule.assignToUserId || "",
            isActive: rule.isActive !== false,
          });
          setBaseline({
            name: rule.name || "",
            type: rule.type || "auto_acknowledge",
            description: rule.description || "",
            assignToUserId: rule.assignToUserId || "",
            isActive: rule.isActive !== false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Unable to load this automation rule");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isEdit, ruleId]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 3600);
    return () => clearTimeout(timer);
  }, [banner]);

  const update = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
    setFormError("");
  }, []);

  function validate() {
    const errors = {};

    if (form.name.trim().length < 2) {
      errors.name = "Give this rule a name with at least 2 characters.";
    }
    if (requiresAssignee && !form.assignToUserId) {
      errors.assignToUserId = "Choose the agent that should receive these tickets.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    if (!canWrite) {
      setFormError("You need the “Assign tickets” permission to change automations.");
      return;
    }
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      assignToUserId: form.assignToUserId || null,
      isActive: form.isActive,
    };

    setSaving(true);
    setFormError("");

    try {
      if (isEdit) {
        await updateAutomationRule(ruleId, payload);
      } else {
        await createAutomationRule(payload);
      }

      navigate("/automations", {
        replace: true,
        state: {
          flash: {
            tone: "success",
            message: isEdit
              ? `"${payload.name}" updated`
              : `"${payload.name}" created`,
          },
        },
      });
    } catch (err) {
      setFormError(err.message || "Unable to save this automation rule");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    const dirty = Object.keys(EMPTY_FORM).some(
      (key) => form[key] !== baseline[key]
    );

    if (dirty && !readOnly && !window.confirm("Discard your unsaved changes?")) return;
    navigate("/automations");
  }

  if (loading) {
    return (
      <div className="automation-page automation-page--form">
        <p className="automation-loading">
          <Loader2 size={16} className="automation-spin" />
          {isEdit ? "Loading rule…" : "Preparing your new rule…"}
        </p>
      </div>
    );
  }

  return (
    <div className="automation-page automation-page--form">
      {banner ? (
        <div className={`automation-toast automation-toast--${banner.tone}`} role="status">
          {banner.tone === "error" ? (
            <AlertCircle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          <span>{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ) : null}

      <button type="button" className="automation-back" onClick={handleCancel}>
        <ArrowLeft size={15} /> Automations
      </button>

      <header className="automation-form-head">
        <span className={`automation-form-head__icon tone-${meta.tone}`}>
          <TypeIcon size={22} strokeWidth={1.8} />
        </span>
        <div>
          <span className="automation-eyebrow">
            <Sparkles size={13} /> {isEdit ? "Editing rule" : "New rule"}
          </span>
          <h1>{isEdit ? "Edit automation rule" : "New automation rule"}</h1>
          <p>
            {isEdit
              ? "Adjust how this rule behaves. Changes apply to new tickets as soon as you save."
              : "Choose what should happen automatically, then give the rule a name the team will recognise."}
          </p>
        </div>
      </header>

      {readOnly ? (
        <p className="automation-viewonly">
          <Info size={15} />
          You have view-only access to automations — ask a workspace owner if this
          rule needs to change.
        </p>
      ) : null}

      {loadError ? (
        <div className="automation-error" role="alert">
          <AlertCircle size={16} />
          <div>
            <strong>We could not load this rule</strong>
            <p>{loadError}</p>
          </div>
          <button
            type="button"
            className="automation-btn automation-btn--ghost"
            onClick={() => navigate("/automations")}
          >
            Back to automations
          </button>
        </div>
      ) : (
        <form className="automation-form" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <p className="automation-form__error" role="alert">
              <AlertCircle size={15} /> {formError}
            </p>
          ) : null}

          <div className="automation-form__main">

            <section className="automation-panel">
              <header className="automation-panel__head">
                <h2>Rule details</h2>
                <p>Everything here appears in the automation list.</p>
              </header>

              <div className={`automation-field${fieldErrors.name ? " has-error" : ""}`}>
                <label htmlFor="automation-name">
                  Rule name <span className="automation-required">*</span>
                </label>
                <input
                  id="automation-name"
                  type="text"
                  value={form.name}
                  maxLength={80}
                  placeholder="e.g. Route billing tickets to Ada"
                  autoFocus
                  autoComplete="off"
                  disabled={readOnly}
                  onChange={(event) => update({ name: event.target.value })}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name ? (
                  <p className="automation-field-error">{fieldErrors.name}</p>
                ) : (
                  <p className="automation-field-hint">
                    Keep it short and action-led — agents see this name first.
                  </p>
                )}
              </div>

              <div className="automation-form__row">
                <div className="automation-field">
                  <label htmlFor="automation-type">Type</label>
                  <select
                    id="automation-type"
                    value={form.type}
                    disabled={readOnly}
                    onChange={(event) => update({ type: event.target.value })}
                  >
                    {AUTOMATION_RULE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={`automation-field${fieldErrors.assignToUserId ? " has-error" : ""}`}
                >
                  <label htmlFor="automation-assignee">
                    Assign to
                    {requiresAssignee ? (
                      <span className="automation-required"> *</span>
                    ) : (
                      <span className="automation-optional"> optional</span>
                    )}
                  </label>
                  <select
                    id="automation-assignee"
                    value={form.assignToUserId}
                    disabled={readOnly}
                    onChange={(event) =>
                      update({ assignToUserId: event.target.value })
                    }
                    aria-invalid={Boolean(fieldErrors.assignToUserId)}
                  >
                    <option value="">No specific agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agentName(agent)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.assignToUserId ? (
                    <p className="automation-field-error">
                      {fieldErrors.assignToUserId}
                    </p>
                  ) : (
                    <p className="automation-field-hint">
                      {selectedAgent
                        ? `${agentName(selectedAgent)} will be notified for every match.`
                        : "Leave empty to keep matched tickets in the team queue."}
                    </p>
                  )}
                </div>
              </div>

              <div className={`automation-typehint tone-${meta.tone}`}>
                <Info size={16} />
                <div>
                  <strong>{meta.label}</strong>
                  <span>{meta.description}</span>
                </div>
              </div>


              <div className="automation-field">
                <label htmlFor="automation-description">Description</label>
                <textarea
                  id="automation-description"
                  rows={5}
                  maxLength={500}
                  disabled={readOnly}
                  value={form.description}
                  placeholder="Explain when this rule should fire and what it changes, so the team knows why it exists."
                  onChange={(event) => update({ description: event.target.value })}
                />
                <div className="automation-field-foot">
                  <p className="automation-field-hint">
                    Optional — visible to every agent in this workspace.
                  </p>
                  <span className="automation-counter">
                    {form.description.length}/500
                  </span>
                </div>
              </div>
            </section>
          </div>

          <aside className="automation-form__side">
            <section className="automation-panel">
              <header className="automation-panel__head">
                <h2>Status</h2>
              </header>
              <div className="automation-status">
                <div>
                  <strong>{form.isActive ? "Rule is active" : "Rule is paused"}</strong>
                  <p>
                    {form.isActive
                      ? "Runs on every matching ticket as soon as you save."
                      : "Saved but dormant until you switch it back on."}
                  </p>
                </div>
                <ActiveToggle
                  checked={form.isActive}
                  onChange={(next) => update({ isActive: next })}
                  disabled={readOnly}
                  label={form.isActive ? "Pause this rule" : "Activate this rule"}
                />
              </div>
            </section>

            <section className="automation-panel automation-panel--summary">
              <header className="automation-panel__head">
                <h2>Summary</h2>
              </header>

              <div className="automation-summary">
                <span className={`automation-summary__icon tone-${meta.tone}`}>
                  <TypeIcon size={16} strokeWidth={2} />
                </span>
                <div>
                  <strong>{meta.label}</strong>
                  <span>{meta.tagline}</span>
                </div>
              </div>

              <ul className="automation-checklist">
                <li>{requiresAssignee && !form.assignToUserId
                  ? "Pick an agent — this rule routes tickets to a person."
                  : form.assignToUserId
                    ? `Matched tickets go to ${agentName(selectedAgent)}.`
                    : "Matched tickets stay in the shared team queue."}</li>
                <li>
                  {form.isActive
                    ? "Live immediately after you save."
                    : "Paused — nothing changes until it is switched on."}
                </li>
              </ul>

              {selectedAgent ? (
                <div className="automation-summary__agent">
                  <span className="automation-avatar">
                    {agentInitials(selectedAgent)}
                  </span>
                  <div>
                    <strong>{agentName(selectedAgent)}</strong>
                    <span>{selectedAgent.email}</span>
                  </div>
                </div>
              ) : null}
            </section>
          </aside>

          <footer className="automation-form__foot">
            <p className="automation-form__foot-hint">
              {readOnly
                ? "Read-only view — no changes can be saved from this session."
                : isEdit
                  ? "Changes are applied to this rule immediately."
                  : "You can pause or edit this rule at any time."}
            </p>
            <div className="automation-form__foot-actions">
              <button
                type="button"
                className="automation-btn automation-btn--ghost"
                onClick={handleCancel}
                disabled={saving}
              >
                {readOnly ? "Back to automations" : "Cancel"}
              </button>
              {readOnly ? null : (
                <button
                  type="submit"
                  className="automation-btn automation-btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="automation-spin" /> Saving…
                    </>
                  ) : isEdit ? (
                    "Save changes"
                  ) : (
                    "Create Rule"
                  )}
                </button>
              )}
            </div>
          </footer>
        </form>
      )}
    </div>
  );
}

