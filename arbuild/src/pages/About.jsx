// About ARBuild: what it is and who it's for, what each part of it does, and the credits: the 3D
// models it uses under Creative Commons licences, and the open-source software it's built on.
// /credits opens this page at its credits. Styles: styles/AppShell.css (.about*, .credits-list).
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import PolicyDialog from "../components/PolicyDialog";
import { useAuth } from "../context/AuthContext";

const CC_BY = { license: "CC Attribution 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };

const MODELS = [
  { name: "Fractal Design Meshify C — PC Case", creator: "MUSHROOM_BUILDS", url: "https://skfb.ly/6ZrH9" },
  { name: "MAXIMUS VI Formula (Motherboard)", creator: "Vivien Deroche", url: "https://skfb.ly/6SDPK" },
  { name: "Kingston Fury Beast DDR5 RAM Stick", creator: "Darky Vip 3D", url: "https://skfb.ly/pMxZQ" },
  { name: "Power supply Aerocool KCAS 500W ATX", creator: "nofurion", url: "https://skfb.ly/p9CIw" },
  { name: "DDR5 RAM - Teamgroup T-Force Black", creator: "PolyDavid", url: "https://skfb.ly/pIOSZ" },
  { name: "Samsung 990 PRO SSD", creator: "PolyDavid", url: "https://skfb.ly/pKpq9" },
  { name: "AM4 Cpu [ Free ]", creator: "Igor.Jop", url: "https://skfb.ly/pqx6R" },
  { name: "AMD Ryzen 5 7600X - HIGH POLY", creator: "PolyDavid", url: "https://skfb.ly/pKoWp" },
  { name: "RTX 3060 TI EAGLE", creator: "BlenderFace", url: "https://skfb.ly/oQUIt" },
  { name: "GPU AMD RX 6700 XT", creator: "BlenderFace", url: "https://skfb.ly/oRoEF" },
  { name: "Cooler Master CPU Cooler", creator: "BlenderFace", url: "https://skfb.ly/oQV6T" },
  { name: "(Free) AMD Wraith Stealth CPU Cooler", creator: "PolyDavid", url: "https://skfb.ly/pJXNM" },
].map((m) => ({ ...CC_BY, ...m }));

// the licences as each project's package states them
const SOFTWARE = [
  { name: "React", use: "The pages and everything on them", license: "MIT", url: "https://react.dev/" },
  { name: "three.js", use: "Drawing the 3D PC", license: "MIT", url: "https://threejs.org/" },
  { name: "React Three Fiber and drei", use: "The 3D scenes, in React", license: "MIT", url: "https://github.com/pmndrs/react-three-fiber" },
  { name: "@react-three/xr", use: "Augmented reality on phones that support it", license: "MIT", url: "https://github.com/pmndrs/xr" },
  { name: "js-aruco2", use: "Finding the printed marker for marker AR", license: "MIT", url: "https://github.com/damianofalcioni/js-aruco2" },
  { name: "Draco", use: "Smaller 3D model files", license: "Apache 2.0", url: "https://google.github.io/draco/" },
  { name: "Firebase", use: "Sign-in, classes and saved work", license: "Apache 2.0", url: "https://firebase.google.com/" },
  { name: "React Router", use: "Moving between pages", license: "MIT", url: "https://reactrouter.com/" },
  { name: "Vite", use: "Building the app", license: "MIT", url: "https://vite.dev/" },
];

const FACTS = ["3D and augmented reality", "Phones, tablets and computers", "Runs in the browser: nothing to install"];

function parts(teacher) {
  return [
    {
      icon: "rig",
      title: "Rig Studio",
      text: "Explore a complete AM4 or AM5 PC in 3D, or set it on your desk in augmented reality. Take it apart, power it on, and tap any part, port or pin to see what it's for.",
      to: "/main",
      go: "Open Rig Studio",
    },
    {
      icon: "wrench",
      title: "Build Lab",
      text: "Assemble and take apart a PC step by step: the safety steps, every part in its place, thermal paste, screws and cables, then the first boot. Practise with hints, or find and fix the faults in a PC your instructor set up.",
      to: "/lab",
      go: "Open Build Lab",
    },
    teacher
      ? {
          icon: "users",
          title: "Classes",
          text: "Make a class and share its code. Post announcements and learning materials, give lab activities and troubleshooting tasks, and watch your students work live.",
          to: "/instructor",
          go: "Open your classes",
        }
      : {
          icon: "users",
          title: "Classes",
          text: "Join your instructor's class with its code. Announcements, learning materials and lab activities come to one place, and the bell tells you what's new.",
          to: "/classes",
          go: "Open your classes",
        },
  ];
}

export default function About() {
  const { profile } = useAuth();
  const { hash } = useLocation();
  const [reading, setReading] = useState(null); // "privacy" | "terms"

  // /credits (and /about#credits) opens the page at the credits
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <AppShell
      className="app-page--content about-page"
      eyebrow="About"
      title="About ARBuild"
      subtitle="A virtual PC assembly and troubleshooting lab for Computer Systems Servicing NC II."
    >
      <section className="ins-panel about-intro" aria-label="What ARBuild is">
        <span className="about-intro__logo">
          <Logo size={44} />
        </span>
        <div>
          <h2>Build a PC before you touch one.</h2>
          <p>
            ARBuild lets you practise Computer Systems Servicing NC II in 3D and augmented reality, on any phone,
            tablet or computer, in school or at home. Learn the steps here, then do them for real on actual
            hardware.
          </p>
        </div>
        <ul className="about-facts">
          {FACTS.map((f) => (
            <li key={f} className="chip">
              <Icon name="check" size={13} strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section" aria-labelledby="about-parts">
        <h2 id="about-parts" className="section-label">What you can do</h2>
        <div className="about-grid">
          {parts(profile?.role === "faculty").map((p) => (
            <article key={p.title} className="ins-panel about-card">
              <span className="about-card__icon">
                <Icon name={p.icon} size={20} />
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <Link to={p.to} className="text-link">
                {p.go}
                <Icon name="forward" size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="credits" className="page-section about-section" aria-labelledby="about-credits">
        <div className="about-head">
          <h2 id="about-credits" className="section-label">3D model credits</h2>
          <p className="ins-muted">
            ARBuild&apos;s 3D parts are models shared under Creative Commons licences. Thank you to the people who
            made them.
          </p>
        </div>
        <ul className="credits-list">
          {MODELS.map((m) => (
            <li key={m.url} className="ins-panel">
              <strong>{m.name}</strong>
              <span className="ins-muted">
                by{" "}
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-link">
                  {m.creator}
                </a>
              </span>
              <a href={m.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-link">
                <Icon name="award" size={14} />
                {m.license}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section about-section" aria-labelledby="about-software">
        <div className="about-head">
          <h2 id="about-software" className="section-label">Built with</h2>
          <p className="ins-muted">The open-source software ARBuild runs on.</p>
        </div>
        <ul className="about-software">
          {SOFTWARE.map((s) => (
            <li key={s.name}>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-link">
                  {s.name}
                </a>
                <small>{s.use}</small>
              </span>
              <span className="chip">{s.license}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section about-section" aria-labelledby="about-policies">
        <div className="about-head">
          <h2 id="about-policies" className="section-label">Privacy and terms</h2>
          <p className="ins-muted">What you agreed to when you set up your account.</p>
        </div>
        <div className="cls-row cls-row--wrap">
          <button type="button" className="btn" onClick={() => setReading("privacy")}>
            <Icon name="eye" size={16} />
            Data Privacy Notice
          </button>
          <button type="button" className="btn" onClick={() => setReading("terms")}>
            <Icon name="book" size={16} />
            Terms of Use
          </button>
        </div>
      </section>

      <p className="about-foot">© 2026 Universidad de Dagupan · SITE · ARBuild Studio</p>
      {reading && <PolicyDialog which={reading} onClose={() => setReading(null)} />}
    </AppShell>
  );
}
