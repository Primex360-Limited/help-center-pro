import { useState, useRef, useEffect } from "react";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { Clock, ChevronDown, Check } from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 1 month", value: "1m" },
  { label: "Last 3 months", value: "3m" },
  { label: "Last 6 months", value: "6m" },
  { label: "Last 1 year", value: "1y" },
];

export default function PeriodFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handlePeriodChange(periodValue) {
    const now = new Date();
    let fromDate;

    switch (periodValue) {
      case "7d":
        fromDate = subDays(now, 7);
        break;
      case "1m":
        fromDate = subMonths(now, 1);
        break;
      case "3m":
        fromDate = subMonths(now, 3);
        break;
      case "6m":
        fromDate = subMonths(now, 6);
        break;
      case "1y":
        fromDate = subMonths(now, 12);
        break;
      default:
        return;
    }

    onChange({
      from: startOfDay(fromDate),
      to: endOfDay(now),
      period: periodValue
    });
    setIsOpen(false);
  }

  const selectedOption = PERIOD_OPTIONS.find((opt) => opt.value === value?.period);
  const displayLabel = selectedOption?.label || "Quick Select";

  return (
    <div ref={containerRef} className="period-filter">
      <button
        type="button"
        className="period-filter__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Select time period"
      >
        <Clock size={16} className="period-filter__icon" aria-hidden="true" />
        <span className="period-filter__label">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`period-filter__chevron${isOpen ? " is-open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="period-filter__dropdown">
          <div className="period-filter__dropdown-header">
            <span className="period-filter__dropdown-title">Time Period</span>
          </div>
          <div className="period-filter__dropdown-list">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`period-filter__dropdown-item${value?.period === option.value ? " is-selected" : ""}`}
                onClick={() => handlePeriodChange(option.value)}
              >
                <span className="period-filter__dropdown-item-label">{option.label}</span>
                {value?.period === option.value && (
                  <Check size={16} className="period-filter__dropdown-item-check" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
