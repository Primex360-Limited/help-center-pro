import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";

const EMPTY_RANGE = { from: null, to: null };

function normaliseRange(range) {
  if (!range?.from) return EMPTY_RANGE;
  return { from: range.from, to: range.to ?? null };
}

function formatDay(date) {
  return format(date, "MMM d, yyyy");
}

function rangeLabel(range) {
  if (!range?.from) return null;
  if (!range?.to) return formatDay(range.from);
  return `${formatDay(range.from)} – ${formatDay(range.to)}`;
}

export default function DateRangePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(() => normaliseRange(value));
  const containerRef = useRef(null);

  useEffect(() => {
    setDraftRange(normaliseRange(value));
  }, [value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const appliedLabel = rangeLabel(normaliseRange(value));
  const draftLabel = rangeLabel(draftRange);
  const hasAppliedRange = Boolean(value?.from);
  const canApply = Boolean(draftRange.from && draftRange.to);

  function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setDraftRange(normaliseRange(value));
    setIsOpen(true);
  }

  function handleSelect(range) {
    setDraftRange(normaliseRange(range));
  }

  function handleApply() {
    if (!draftRange.from) return;
    onChange({ from: draftRange.from, to: draftRange.to ?? draftRange.from });
    setIsOpen(false);
  }

  function handleClear() {
    setDraftRange(EMPTY_RANGE);
    onChange(EMPTY_RANGE);
    setIsOpen(false);
  }

  const fieldClassName = [
    "date-range-picker__field",
    isOpen ? "is-open" : "",
    hasAppliedRange ? "has-value" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className="date-range-picker">
      <div className={fieldClassName}>
        <button
          type="button"
          className="date-range-picker__trigger"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Select date range"
        >
          <CalendarDays size={16} className="date-range-picker__icon" aria-hidden="true" />
          <span
            className={
              appliedLabel
                ? "date-range-picker__label"
                : "date-range-picker__label date-range-picker__label--placeholder"
            }
          >
            {appliedLabel || "Date Range"}
          </span>
        </button>

        {hasAppliedRange ? (
          <button
            type="button"
            className="date-range-picker__clear"
            onClick={handleClear}
            aria-label="Clear date range"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown size={14} className="date-range-picker__chevron" aria-hidden="true" />
        )}
      </div>

      {isOpen ? (
        <div className="date-range-picker__popover" role="dialog" aria-label="Choose a date range">
          <div className="date-range-picker__header">
            <p className="date-range-picker__header-label">Date range</p>
            <p
              className={
                draftLabel
                  ? "date-range-picker__header-value"
                  : "date-range-picker__header-value is-placeholder"
              }
            >
              {draftLabel || "Select a start date"}
            </p>
          </div>

          <div className="date-range-picker__calendar-wrapper">
            <DayPicker
              mode="range"
              selected={draftRange}
              onSelect={handleSelect}
              defaultMonth={draftRange.from || new Date()}
              numberOfMonths={1}
              fixedWeeks
              showOutsideDays
              className="date-range-picker__calendar"
            />
          </div>

          <div className="date-range-picker__footer">
            <button
              type="button"
              className="date-range-picker__btn date-range-picker__btn--ghost"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="date-range-picker__btn date-range-picker__btn--primary"
              onClick={handleApply}
              disabled={!canApply}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
