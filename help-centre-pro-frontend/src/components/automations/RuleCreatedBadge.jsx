/**
 * "Rule created" seal — a 3D-style gold badge with a green check and a violet
 * ribbon. Drawn as inline SVG so it stays crisp at any density and ships no
 * binary asset. Size it from the consumer (see `.automation-dialog__badge`).
 */

/** Twelve rounded lobes around the seal, spaced evenly on a 60px radius. */
const BADGE_CENTER = { x: 120, y: 100 };
const LOBES = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * 30 * Math.PI) / 180;
  return {
    x: BADGE_CENTER.x + Math.cos(angle) * 60,
    y: BADGE_CENTER.y + Math.sin(angle) * 60,
  };
});

export default function RuleCreatedBadge({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 256"
      role="img"
      aria-label="Automation rule created"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="rcb-halo" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="62%" stopColor="#ffd98a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>

        <linearGradient
          id="rcb-gold"
          gradientUnits="userSpaceOnUse"
          x1="44"
          y1="20"
          x2="196"
          y2="180"
        >
          <stop offset="0%" stopColor="#ffe9b0" />
          <stop offset="42%" stopColor="#ffc961" />
          <stop offset="100%" stopColor="#f19a1e" />
        </linearGradient>

        <linearGradient
          id="rcb-gold-rim"
          gradientUnits="userSpaceOnUse"
          x1="70"
          y1="40"
          x2="176"
          y2="168"
        >
          <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#ffe2a2" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f0a02a" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="rcb-green" cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#c2f5b1" />
          <stop offset="36%" stopColor="#6ed167" />
          <stop offset="78%" stopColor="#45b355" />
          <stop offset="100%" stopColor="#2c9445" />
        </radialGradient>

        <linearGradient
          id="rcb-check"
          gradientUnits="userSpaceOnUse"
          x1="96"
          y1="84"
          x2="146"
          y2="120"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9fbe6" />
        </linearGradient>

        <linearGradient
          id="rcb-ribbon"
          gradientUnits="userSpaceOnUse"
          x1="82"
          y1="132"
          x2="120"
          y2="238"
        >
          <stop offset="0%" stopColor="#b3a8fb" />
          <stop offset="52%" stopColor="#9384f2" />
          <stop offset="100%" stopColor="#6d5ae4" />
        </linearGradient>

        <linearGradient
          id="rcb-ribbon-dark"
          gradientUnits="userSpaceOnUse"
          x1="122"
          y1="132"
          x2="158"
          y2="230"
        >
          <stop offset="0%" stopColor="#9183f1" />
          <stop offset="100%" stopColor="#5c4ad8" />
        </linearGradient>

        <linearGradient
          id="rcb-fold"
          gradientUnits="userSpaceOnUse"
          x1="108"
          y1="130"
          x2="132"
          y2="230"
        >
          <stop offset="0%" stopColor="#ded9ff" />
          <stop offset="100%" stopColor="#a99bf7" />
        </linearGradient>

        <filter
          id="rcb-badge-shadow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="7"
            stdDeviation="9"
            floodColor="#b26a00"
            floodOpacity="0.22"
          />
        </filter>

        <filter
          id="rcb-disc-shadow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="5"
            floodColor="#a45f00"
            floodOpacity="0.3"
          />
        </filter>

        <filter
          id="rcb-check-shadow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3"
            floodColor="#14532d"
            floodOpacity="0.32"
          />
        </filter>

        <filter
          id="rcb-ground"
          x="-40%"
          y="-140%"
          width="180%"
          height="380%"
        >
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <circle cx="120" cy="100" r="112" fill="url(#rcb-halo)" />

      <ellipse
        cx="120"
        cy="244"
        rx="54"
        ry="7"
        fill="#101828"
        opacity="0.14"
        filter="url(#rcb-ground)"
      />

      {/* Ribbon — drawn first so it tucks behind the seal. */}
      <path d="M108 126h24v104h-24z" fill="url(#rcb-fold)" />
      <path d="M122 130h40v98l-20-12-20 12z" fill="url(#rcb-ribbon-dark)" />
      <path
        d="M122 130h40v98l-20-12-20 12z"
        stroke="#4d3dc4"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <path d="M78 130h40v106l-20-13-20 13z" fill="url(#rcb-ribbon)" />
      <path
        d="M78 130h40v106l-20-13-20 13z"
        stroke="#4d3dc4"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />
      <path d="M82 134h5v94l-5-3.5z" fill="#ffffff" fillOpacity="0.22" />

      {/* Gold seal */}
      <g filter="url(#rcb-badge-shadow)">
        {LOBES.map((lobe) => (
          <circle
            key={`${lobe.x}-${lobe.y}`}
            cx={lobe.x}
            cy={lobe.y}
            r="22"
            fill="url(#rcb-gold)"
          />
        ))}
        <circle cx="120" cy="100" r="66" fill="url(#rcb-gold)" />
      </g>
      <circle
        cx="120"
        cy="100"
        r="64"
        stroke="url(#rcb-gold-rim)"
        strokeWidth="3"
      />

      {/* Check disc */}
      <g filter="url(#rcb-disc-shadow)">
        <circle cx="120" cy="100" r="48" fill="url(#rcb-green)" />
      </g>
      <circle
        cx="120"
        cy="100"
        r="47"
        stroke="#ffffff"
        strokeOpacity="0.32"
        strokeWidth="1.4"
      />
      <ellipse cx="112" cy="76" rx="30" ry="14" fill="#ffffff" opacity="0.14" />

      <g filter="url(#rcb-check-shadow)">
        <path
          d="M98 101l16 17 31-34"
          stroke="url(#rcb-check)"
          strokeWidth="17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
