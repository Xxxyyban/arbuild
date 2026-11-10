// Where the Build Lab starts, for free build: learning on your own, with no task, clock or points.
// Under the choices, a student's lab activities still to do, from all their classes: each opens the lab
// the way its class does, which skips these choices (a lab on its way shows "Opening your lab…", and if
// it can't open, why, with the choices under it).
// The student doesn't choose the platform either: a teardown gets a random PC (working out what's
// inside is part of the lesson), and building means choosing every part, AM4 or AM5.
// Styles: styles/BuildLab.css (.lab-choice*, .lab-start*, .lab-todo).
import { Link } from "react-router-dom";
import { PLATFORMS } from "../../lab/Catalog";
import { useAuth } from "../../context/AuthContext";
import ClassFeed from "../class/ClassFeed";
import { TodoList } from "../class/ProfileClasses";
import AppShell from "../AppShell";
import Circuit from "../Circuit";
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

// opening: a class's lab is on its way; status: why it couldn't open; backTo: that class
export default function StartScreen({ onPractice, opening = false, status = null, backTo = null }) {
  const { user, profile } = useAuth();

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
            <Circuit className="lab-choice__traces" />
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
        <ClassFeed user={user} profile={profile}>
          {(feed) =>
            feed.todo.length > 0 ? (
              <section className="page-section lab-todo" aria-label="Lab activities to do">
                <h2 className="section-label">
                  To do
                  <span className="section-count">{feed.todo.length}</span>
                </h2>
                <TodoList items={feed.todo} />
              </section>
            ) : (
              <p className="lab-choose-note">
                <Icon name="info" size={16} />
                <span>
                  No lab activities to do right now. When your instructor gives one, it shows here and in{" "}
                  <Link to="/classes" className="text-link">your classes</Link>.
                </span>
              </p>
            )
          }
        </ClassFeed>
      )}
    </AppShell>
  );
}
