// A corner of circuit board running out of a chip, as on the sign-in page: the app's one bit of decoration.
// It draws itself once, in the bottom right corner of its card (the card: position relative, overflow
// hidden), in the text colour you give it. Styles: styles/AppShell.css (.circuit).
const TRACES = ["M150 172 H112 V132 H72", "M150 192 H58", "M172 150 V112 H132 V72", "M192 150 V58"];
const PADS = [[72, 132], [58, 192], [132, 72], [192, 58]];

export default function Circuit({ className = "" }) {
  return (
    <svg className={`circuit ${className}`.trim()} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {TRACES.map((d, i) => (
        <path key={d} d={d} pathLength="1" style={{ animationDelay: `${0.1 + i * 0.08}s` }} />
      ))}
      {PADS.map(([cx, cy], i) => (
        <circle key={cx} cx={cx} cy={cy} r="4" style={{ animationDelay: `${0.7 + i * 0.06}s` }} />
      ))}
      <rect x="150" y="150" width="80" height="80" rx="8" />
    </svg>
  );
}
