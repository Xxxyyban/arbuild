// Who is looking, written faintly across the screen with the date and time: a screenshot or photo of
// the screen that gets out shows whose it was and when. Clicks go through it. Used by a graded lab run
// as an exam (pages/BuildLab.jsx) and by the admin portal (pages/Admin.jsx).
import { useEffect, useState } from "react";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** One tile of the pattern: the lines, turned a little, as an SVG picture. */
function tile(lines, color) {
  const w = 360;
  const h = 150 + lines.length * 18;
  const text = lines
    .map((l, i) => `<text x="${w / 2}" y="${h / 2 + (i - (lines.length - 1) / 2) * 20}" text-anchor="middle">${esc(l)}</text>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<g transform="rotate(-24 ${w / 2} ${h / 2})" fill="${color}" font-family="system-ui, sans-serif" font-size="14" font-weight="600">${text}</g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/**
 * lines: who (name, ID, email...); the date and time are added, and kept current.
 * fixed: over the whole window (the admin portal); otherwise over its positioned parent (the lab's view).
 * color, opacity: a grey that shows on a light screen and a dark one.
 */
export default function Watermark({ lines, fixed = false, color = "#64748b", opacity = 0.16 }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const stamp = now.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div
      aria-hidden="true"
      className="watermark"
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: "none",
        opacity,
        backgroundImage: tile([...lines.filter(Boolean), stamp], color),
        backgroundRepeat: "repeat",
      }}
    />
  );
}
