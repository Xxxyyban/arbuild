// The ARBuild mark (public/favicon.svg): AR scan brackets around a chip. <Logo size={32} />;
// with `name`, the "ARBuild" wordmark sits beside it.
export default function Logo({ size = 32, name = false, className = "" }) {
  return (
    <span className={`logo ${className}`.trim()}>
      <svg viewBox="0 0 376 376" width={size} height={size} fill="none" role="img" aria-label="ARBuild">
        <g stroke="#34C795" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 108V60a10 10 0 0 1 10-10h48" />
          <path d="M268 50h48a10 10 0 0 1 10 10v48" />
          <path d="M326 268v48a10 10 0 0 1-10 10h-48" />
          <path d="M108 326H60a10 10 0 0 1-10-10v-48" />
        </g>
        <g stroke="#34C795" strokeWidth="9" strokeLinecap="round">
          <path d="M164 100v30M212 100v30M164 276v-30M212 276v-30M100 164h30M100 212h30M276 164h-30M276 212h-30" />
        </g>
        <rect x="130" y="130" width="116" height="116" rx="14" fill="#E4F7EF" stroke="#34C795" strokeWidth="9" />
      </svg>
      {name && <span className="logo__name">ARBuild</span>}
    </span>
  );
}
