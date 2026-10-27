/** Brand logos for email integrate modal — match product mock. */

export function GoogleLogo({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M44.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h11.5c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8c4-3.7 6.4-9.1 6.4-15.8Z"
        fill="#4285F4"
      />
      <path
        d="M24 45c5.7 0 10.5-1.9 14-5.1l-6.8-5.2c-1.9 1.3-4.3 2-7.2 2-5.5 0-10.2-3.7-11.9-8.7H5.1v5.4C8.6 40.4 15.8 45 24 45Z"
        fill="#34A853"
      />
      <path
        d="M12.1 28c-.4-1.3-.7-2.6-.7-4s.3-2.7.7-4V14.6H5.1C3.7 17.4 3 20.6 3 24s.7 6.6 2.1 9.4L12.1 28Z"
        fill="#FBBC05"
      />
      <path
        d="M24 11.3c3.1 0 5.9 1.1 8.1 3.2l6.1-6.1C34.5 4.8 29.7 3 24 3 15.8 3 8.6 7.6 5.1 14.6l7 5.4c1.7-5 6.4-8.7 11.9-8.7Z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Alias used by the integrate modal (Google OAuth). */
export function GmailLogo(props) {
  return <GoogleLogo {...props} />;
}

export function OutlookLogo({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hcpOlFace" x1="14" y1="8" x2="42" y2="40">
          <stop stopColor="#0A66C2" />
          <stop offset="1" stopColor="#28A8EA" />
        </linearGradient>
        <linearGradient id="hcpOlCube" x1="4" y1="10" x2="22" y2="38">
          <stop stopColor="#106EBE" />
          <stop offset="1" stopColor="#0078D4" />
        </linearGradient>
      </defs>
      <rect x="14" y="10" width="28" height="28" rx="3" fill="url(#hcpOlFace)" />
      <path
        d="M16 14h24v6L28 28 16 20v-6Z"
        fill="#fff"
        opacity="0.95"
      />
      <path d="M16 20 28 28l12-8v12H16V20Z" fill="#DEECF9" opacity="0.85" />
      <rect x="4" y="12" width="20" height="24" rx="2.5" fill="url(#hcpOlCube)" />
      <ellipse cx="14" cy="24" rx="6.5" ry="7.5" fill="#fff" />
      <ellipse cx="14" cy="24" rx="3.6" ry="4.2" fill="#0078D4" />
    </svg>
  );
}

export function SmtpMailboxLogo({ size = 56 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="16"
        width="52"
        height="34"
        rx="5"
        fill="#fff"
        stroke="#D0D5DD"
        strokeWidth="2"
      />
      <path d="M8 18h48v10L32 40 8 28V18Z" fill="#12B76A" />
      <path
        d="M8 18.5 32 36.5 56 18.5"
        stroke="#039855"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <rect x="16" y="38" width="32" height="14" rx="3" fill="#1570EF" />
      <text
        x="32"
        y="48"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="9"
        fill="#fff"
        letterSpacing="1"
      >
        SMTP
      </text>
    </svg>
  );
}
