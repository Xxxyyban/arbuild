// Where the Build Lab starts, for free build: learning on your own, with no task, clock or points. Class
// work doesn't start here: students open their lab activities from their class, which skips these choices
// (a lab on its way shows "Opening your lab…", and if it can't open, why, with the choices under it).
// The student doesn't choose the platform either: a teardown gets a random PC (working out what's
// inside is part of the lesson), and building means choosing every part, AM4 or AM5.
// Styles: styles/BuildLab.css (.lab-choice*, .lab-start*).
import { Link } from "react-router-dom";
import { PLATFORMS } from "../../lab/Catalog";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../AppShell";
import Icon from "../Icon";
import Logo from "../Logo";
import "../../styles/BuildLab.css";
import "../../styles/BuildLabParts.css";
import "../../styles/BuildLabTask.css";

const randomPlatform = () => PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];

const CHOICES = [
  {
    icon: "takeApart",
    title: "Take it apart",
    text: "Start with a running PC. See what's inside, then rebuild it.",
    start: { startMode: "disassemble", startState: "full" },
  },
  {
    icon: "buildUp",
    title: "Build it",
    text: "Start with an empty case. Choose every part and see what fits.",
    start: { startMode: "assemble", startState: "empty" },
  },
];

// the corner of each card: a bit of circuit board running out of a chip, as on the sign-in page
const TRACES = ["M150 172 H112 V132 H72", "M150 192 H58", "M172 150 V112 H132 V72", "M192 150 V58"];
const PADS = [[72, 132], [58, 192], [132, 72], [192, 58]];

function Traces() {
  return (
    <svg className="lab-choice__traces" viewBox="0 0 200 200" aria-hidden="true">
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

// opening: a class's lab is on its way; status: why it couldn't open; backTo: that class
export default function StartScreen({ onPractice, opening = false, status = null, backTo = null }) {
  const { profile } = useAuth();

  if (opening) {
    return (
      <div className="lab-start" role="status">
        <Logo size={44} />
        <span className="lab-start__spin" aria-hidden="true" />
        <p>Opening your lab…</p>
      </div>
    );
  }

  return (
    <AppShell
      eyebrow="Free build"
      title="Build Lab"
      subtitle="No task, no timer, no score. Practise here, then do it on real hardware."
      back={backTo ? { to: backTo, label: "Back to your class" } : undefined}
    >
      {status && (
        <p className="lab-choose-status" role="alert">
          <Icon name="alert" size={17} />
          {status}
        </p>
      )}

      <div className="lab-choices">
        {CHOICES.map((c) => (
          <button key={c.title} type="button" className="lab-choice" onClick={() => onPractice({ ...c.start, platform: randomPlatform() })}>
            <Traces />
            <span className="lab-choice__top" aria-hidden="true">
              <span className="lab-choice__icon">
                <Icon name={c.icon} size={28} strokeWidth={1.7} />
              </span>
              <span className="lab-choice__arrow">
                <Icon name="forward" size={18} />
              </span>
            </span>
            <strong>{c.title}</strong>
            <span className="lab-choice__about">{c.text}</span>
          </button>
        ))}
      </div>

      {profile?.role === "student" && (
        <p className="lab-choose-note">
          <Icon name="info" size={16} />
          <span>
            Got a lab activity from your instructor? Open it in <Link to="/classes" className="text-link">your classes</Link>.
          </span>
        </p>
      )}
    </AppShell>
  );
}
