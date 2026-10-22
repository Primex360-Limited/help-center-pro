import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  deleteAutomationRule,
  listAutomationRules,
  updateAutomationRule,
} from "../../api/automations.api.js";
import ActiveToggle from "../../components/automations/ActiveToggle.jsx";
import AutomationRuleDialog from "../../components/automations/AutomationRuleDialog.jsx";
import RuleCreatedDialog from "../../components/automations/RuleCreatedDialog.jsx";
import { useDialogChrome } from "../../components/workspace/dialogUtils.js";
import {
  agentInitials,
  agentName,
  automationRuleType,
} from "../../constants/automationRules.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/automations.css";

/**
 * Automations — the workspace rules that acknowledge, route and escalate
 * tickets. Creating a rule is a dialog over this list (route
 * `/automations/new`) so the rules the team already owns stay in view.
 */
export default function Automations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("ticket:assign");

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [createdOpen, setCreatedOpen] = useState(false);

  const isCreating = location.pathname === "/automations/new";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAutomationRules();
      setRules(res?.data?.rules || []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load automation rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Saves on the edit screen and the create dialog hand us router state:
   * `flash` for the toast, `created` for the success confirmation.
   */
  useEffect(() => {
    const routerState = location.state;
    if (!routerState) return;
    if (routerState.flash) setBanner(routerState.flash);
    if (routerState.created) setCreatedOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 4200);
    return () => clearTimeout(timer);
  }, [banner]);

  const closeDeleteDialog = useCallback(() => {
    if (!deleting) setDeleteTarget(null);
  }, [deleting]);

  useDialogChrome(Boolean(deleteTarget), closeDeleteDialog);

  const closeCreatedDialog = useCallback(() => setCreatedOpen(false), []);

  function closeCreateDialog() {
    navigate("/automations", { replace: true });
  }

  function handleCreated(rule) {
    if (rule) setRules((prev) => [...prev, rule]);
    navigate("/automations", { replace: true, state: { created: true } });
  }

  async function handleToggle(rule) {
    if (!canWrite || busyId) return;

    const nextActive = !rule.isActive;
    setBusyId(rule.id);
    setRules((prev) =>
      prev.map((item) =>
        item.id === rule.id ? { ...item, isActive: nextActive } : item
      )
    );

    try {
      const res = await updateAutomationRule(rule.id, { isActive: nextActive });
      const updated = res?.data?.rule;
      if (updated) {
        setRules((prev) =>
          prev.map((item) => (item.id === rule.id ? updated : item))
        );
      }
      setBanner({
        tone: "success",
        message: `"${rule.name}" is now ${nextActive ? "active" : "paused"}`,
      });
    } catch (err) {
      setRules((prev) =>
        prev.map((item) =>
          item.id === rule.id ? { ...item, isActive: rule.isActive } : item
        )
      );
      setBanner({
        tone: "error",
        message: err.message || "Unable to update this rule",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteAutomationRule(deleteTarget.id);
      setRules((prev) => prev.filter((rule) => rule.id !== deleteTarget.id));
      setBanner({
        tone: "success",
        message: `"${deleteTarget.name}" deleted`,
      });
      setDeleteTarget(null);
    } catch (err) {
      setBanner({
        tone: "error",
        message: err.message || "Unable to delete this rule",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="automation-page">
      {banner ? (
        <div
          className={`automation-toast automation-toast--${banner.tone}`}
          role="status"
        >
          {banner.tone === "error" ? (
            <AlertCircle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          <span>{banner.message}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <header className="automation-head">
        <div>
          <h1>Automation</h1>
          <p>Set up rules to automate ticket handling</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="automation-btn automation-btn--primary"
            onClick={() => navigate("/automations/new")}
          >
            <Plus size={15} strokeWidth={2.5} /> New Rule
          </button>
        ) : null}
      </header>

      {loading ? (
        <div
          className="automation-grid"
          aria-busy="true"
          aria-label="Loading automation rules"
        >
          {[0, 1].map((index) => (
            <div className="automation-skeleton" key={index}>
              <div className="automation-skeleton__row">
                <span className="automation-skeleton__dot" />
                <span className="automation-skeleton__line" />
              </div>
              <span className="automation-skeleton__body" />
              <span className="automation-skeleton__body is-short" />
              <span className="automation-skeleton__foot" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="automation-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>We could not load your automations</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="automation-btn automation-btn--ghost"
            onClick={load}
          >
            Try again
          </button>
        </div>
      ) : rules.length === 0 ? (
        <div className="automation-empty">
          <span className="automation-empty__icon">
            <Zap size={22} strokeWidth={1.8} />
          </span>
          <h3>No automation rules yet</h3>
          <p>
            Create your first rule to acknowledge, assign or escalate tickets
            without lifting a finger.
          </p>
          {canWrite ? (
            <button
              type="button"
              className="automation-btn automation-btn--primary"
              onClick={() => navigate("/automations/new")}
            >
              <Plus size={15} strokeWidth={2.5} /> New Rule
            </button>
          ) : null}
        </div>
      ) : (
        <div className="automation-grid">
          {rules.map((rule) => {
            const meta = automationRuleType(rule.type);
            const busy = busyId === rule.id;

            return (
              <article
                key={rule.id}
                className={`automation-card${rule.isActive ? "" : " is-paused"}`}
              >
                <header className="automation-card__head">
                  <button
                    type="button"
                    className="automation-card__name"
                    onClick={() => navigate(`/automations/${rule.id}/edit`)}
                    title={`${canWrite ? "Edit" : "View"} ${rule.name}`}
                  >
                    {rule.name}
                  </button>
                  <span className="automation-card__type">{meta.label}</span>
                </header>

                <p className="automation-card__desc">
                  {rule.description ||
                    "No description yet — add one so the team knows what this rule does."}
                </p>

                <footer className="automation-card__foot">
                  <div className="automation-card__toggle">
                    <ActiveToggle
                      checked={rule.isActive}
                      onChange={() => handleToggle(rule)}
                      disabled={busy || !canWrite}
                      label={`${rule.isActive ? "Pause" : "Activate"} ${rule.name}`}
                    />
                    <span>
                      {busy ? "Saving…" : rule.isActive ? "Active" : "Paused"}
                    </span>
                  </div>

                  {canWrite ? (
                    <button
                      type="button"
                      className="automation-card__delete"
                      onClick={() => setDeleteTarget(rule)}
                      aria-label={`Delete ${rule.name}`}
                    >
                      <Trash2 size={14} strokeWidth={2} /> Delete
                    </button>
                  ) : null}

                  {rule.assignee ? (
                    <span
                      className="automation-card__agent"
                      title={`Routed to ${agentName(rule.assignee)}`}
                    >
                      {rule.assignee.profileImage ? (
                        <img
                          className="automation-avatar"
                          src={rule.assignee.profileImage}
                          alt=""
                        />
                      ) : (
                        <span className="automation-avatar">
                          {agentInitials(rule.assignee)}
                        </span>
                      )}
                      {agentName(rule.assignee)}
                    </span>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {deleteTarget ? (
        <div
          className="automation-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <div
            className="automation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="automation-delete-title"
          >
            <header className="automation-dialog__head">
              <h2 id="automation-delete-title">Delete automation rule</h2>
              <button
                type="button"
                className="automation-dialog__close"
                onClick={closeDeleteDialog}
                aria-label="Close"
                disabled={deleting}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </header>

            <div className="automation-dialog__body">
              <p className="automation-dialog__lede">
                <strong>{deleteTarget.name}</strong> will stop running immediately
                and is removed from this workspace. This cannot be undone.
              </p>
            </div>

            <footer className="automation-dialog__foot automation-dialog__foot--compact">
              <button
                type="button"
                className="automation-btn automation-btn--ghost"
                onClick={closeDeleteDialog}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="automation-btn automation-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="automation-spin" /> Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Delete
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {isCreating && canWrite ? (
        <AutomationRuleDialog
          onClose={closeCreateDialog}
          onCreated={handleCreated}
        />
      ) : null}

      {createdOpen ? (
        <RuleCreatedDialog onClose={closeCreatedDialog} />
      ) : null}
    </div>
  );
}
