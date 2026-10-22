import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { createAutomationRule } from "../../api/automations.api.js";
import { listUsers } from "../../api/users.api.js";
import {
  AUTOMATION_RULE_TYPES,
  agentName,
  automationRuleType,
} from "../../constants/automationRules.js";
import { useDialogChrome } from "../workspace/dialogUtils.js";
import ActiveToggle from "./ActiveToggle.jsx";

const EMPTY_FORM = {
  name: "",
  type: "auto_acknowledge",
  assignToUserId: "",
  description: "",
  isActive: true,
};

const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;

/**
 * "New Automation Rule" dialog. Mirrors the workspace rule contract: a name is
 * always required, an agent is only required for routing rules, and the rule
 * is live the moment it is saved unless the workspace turns it off here.
 */
export default function AutomationRuleDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const requestClose = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  useDialogChrome(true, requestClose);

  useEffect(() => {
    let cancelled = false;

    async function loadAgents() {
      try {
        const res = await listUsers();
        if (cancelled) return;
        const directory = (res?.data?.users || []).filter(
          (user) => String(user.status || "").toLowerCase() !== "inactive"
        );
        setAgents(directory);
      } catch {
        /* The rule still works without a directory — the picker just stays empty. */
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    }

    loadAgents();
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = automationRuleType(form.type);
  const needsAssignee = Boolean(meta.needsAssignee);

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
    setFormError("");
  }

  function validate() {
    const errors = {};
    const name = form.name.trim();

    if (!name) errors.name = "Give this rule a name";
    else if (name.length < 2) errors.name = "Use at least 2 characters";
    else if (name.length > NAME_MAX) {
      errors.name = `Keep the name under ${NAME_MAX} characters`;
    }

    if (needsAssignee && !form.assignToUserId) {
      errors.assignToUserId = `Pick the agent ${meta.label} routes tickets to`;
    }

    if (form.description.trim().length > DESCRIPTION_MAX) {
      errors.description = `Keep the description under ${DESCRIPTION_MAX} characters`;
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const res = await createAutomationRule({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        assignToUserId: form.assignToUserId || null,
        isActive: form.isActive,
      });
      onCreated(res?.data?.rule || null);
    } catch (err) {
      setFormError(err.message || "We could not create this rule. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="automation-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <form
        className="automation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-create-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <header className="automation-dialog__head">
          <h2 id="automation-create-title">New Automation Rule</h2>
          <button
            type="button"
            className="automation-dialog__close"
            onClick={requestClose}
            aria-label="Close"
            disabled={saving}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="automation-dialog__body">
          {formError ? (
            <p className="automation-dialog__error" role="alert">
              <AlertCircle size={14} />
              <span>{formError}</span>
            </p>
          ) : null}

          <div
            className={`automation-field${fieldErrors.name ? " has-error" : ""}`}
          >
            <label htmlFor="automation-rule-name">Rule Name</label>
            <input
              id="automation-rule-name"
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="e.g. Auto-Assign to John"
              maxLength={NAME_MAX}
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? "automation-rule-name-error" : undefined
              }
            />
            {fieldErrors.name ? (
              <p
                className="automation-field-error"
                id="automation-rule-name-error"
              >
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="automation-field">
            <label htmlFor="automation-rule-type">Type</label>
            <select
              id="automation-rule-type"
              value={form.type}
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
            className={`automation-field${
              fieldErrors.assignToUserId ? " has-error" : ""
            }`}
          >
            <label htmlFor="automation-rule-agent">
              Assign to
              {needsAssignee ? (
                <span className="automation-required" aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>
            <select
              id="automation-rule-agent"
              value={form.assignToUserId}
              onChange={(event) =>
                update({ assignToUserId: event.target.value })
              }
              aria-invalid={Boolean(fieldErrors.assignToUserId)}
              aria-describedby={
                fieldErrors.assignToUserId
                  ? "automation-rule-agent-error"
                  : undefined
              }
            >
              <option value="">
                {agentsLoading ? "Loading agents…" : "Select Agent"}
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agentName(agent)}
                </option>
              ))}
            </select>
            {fieldErrors.assignToUserId ? (
              <p
                className="automation-field-error"
                id="automation-rule-agent-error"
              >
                {fieldErrors.assignToUserId}
              </p>
            ) : null}
          </div>

          <div className="automation-field">
            <label htmlFor="automation-rule-description">
              Rule Description
            </label>
            <textarea
              id="automation-rule-description"
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="What does the rule do"
              rows={3}
              maxLength={DESCRIPTION_MAX}
            />
          </div>

          <div className="automation-dialog__toggle">
            <ActiveToggle
              checked={form.isActive}
              onChange={(next) => update({ isActive: next })}
              label={form.isActive ? "Deactivate this rule" : "Activate this rule"}
            />
            <span>{form.isActive ? "Active" : "Paused"}</span>
          </div>
        </div>

        <footer className="automation-dialog__foot">
          <button
            type="button"
            className="automation-btn automation-btn--ghost"
            onClick={requestClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="automation-btn automation-btn--primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="automation-spin" /> Creating…
              </>
            ) : (
              "Create Rule"
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
