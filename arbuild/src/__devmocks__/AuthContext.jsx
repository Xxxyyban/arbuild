// TEMP-DEVTEST: a stand-in signed-in user for the showcase.
import { useState , useSyncExternalStore } from "react";
// ?as=student (default), student2, instructor, admin or guest (signed out), remembered per tab.
// Signing in on the welcome page picks a role from the email: "admin…" is the admin,
// "prof…"/"rsantos…" the instructor, anything else the student. Nothing reaches Firebase.
const params = new URLSearchParams(window.location.search);
if (params.get("as")) sessionStorage.setItem("devAs", params.get("as"));
const as = sessionStorage.getItem("devAs") || "student";

const PEOPLE = {
  instructor: {
    user: { uid: "inst1", email: "rsantos@cdd.edu.ph" },
    profile: { role: "faculty", email: "rsantos@cdd.edu.ph", facultyTitle: "Prof.", firstName: "Rosa", lastName: "Santos", facultyId: "F-1043", department: "SITE", photoURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAHqUlEQVR4nO3cS1cTZxgHcDZWcuOULa12UysfQj2tPd3Xigvpwm6rbW1RAUFBDLcQIYAoVQNqRRGDKJRjrVqrIkITrpaQONPbkWsyCV/h6XnnkmQSQAzvzDMJs/hvWP7+4Z2Zd553Mjad/xr4nDu4TA7BphYh70TyjZCzsflWSHNsvoumScpheRoPw+bG7+Vx/LBMCmBzQ3yOCKmPzVE+mWdicywau5TCaOqkFMljIymOxCCl9nhiakqWSSkYquNzQkiVEGPVScjQ8QvR8IUC9F8+YOGvUIC+7GSqhG+sTChAx89UET+uAB0/U2V8Y2WZVICOn4mALxag42ci4QsF6Pf5gIUfKUB/yCpGwTdayyBDxy9Gwzday6UC9O0FAwK+WICOb0DCjxagb6wBBr5QgI4PWPhxBehbygaV8Y2nT0kF6PgGBHyxAB3fgIQfLUB/kwUY+EIBOj5g4ccVoO13uB9dqIGv+juhyfMM+pgpGFmYgelQgI9n/jX/tyb3ABz4+SZsa61NCXxjRYVUgDbxTWeKYG/PZXD5JoBZ4lZOODEu3yTs7b4KZlupZvHFArSJ/2nneXj0H7M6/Ar4sXn4DwOfdlzQJL5JVoBG8LMdJWAb/u3N8GvAj03N4GPItpdpCj9agEbwc1rKoZf5kzq+lLv+KchxWDWDLxSgIfwH/75SDD92ScpxVGoC31RxWioAf9npVfCXn/if4IV3beXo+KZTfAH4F1ybAmv+m1I18BgdP7EABPzdN86pji/ls2tOVHx5AUj3+Y8o3Gommwd/M2CuLkPDjxaA9ISb13MFDV/Knq5raPimU1bIwNxe6PZPouKT3PK+RMPnC8Dc22GQ8ZlwCJgQB9ua7Sj4pvL4AlQ8HEE21hhsfDEHem6h4MsLUPlkCtnVZDSAT9I0/BwFP1oAwrGgPtarCXySXv80Cr6pvBIysM5kkT18RgP4JH/MzqDgr1CAOgfivNyiJvBJvMEACr6pLKEA9U4jRgoI4+JHCkDAjytA3aOg/BIUxsePLEEI+DEFqH8Ot4/xagI/chFGwDeVVZECcA5BN7qfaQKfpHFoEAVfKADpBDqZXmA0gC88iLlQ8JcpQL3j/2R05FU4iI5PtiI+bKxHwTeflBWg/rcXXL5JXPxwCLqmXqLhxxSA8+GLvd1XUfFJPr/RgYZvPllNCsD76ojZVsq/JMfCv88yYLFWoOFHC0D85Mvujh9R8Ek+bnOi4gsFaOB7OzWDj1XHr3r6BB3ffEJWAN7HjrLtZfzQlFr4t71eyK6youPHFID/pakch/UtrgfJ4z/4i4WculpN4JtP1JAC8PENkRIq4c4b/xPW98t/z27TDH6kAC3gG8RZzey6cn5oSok1XyvLjoTPF6AlfENMPvnpIj+3Q+NWUwt3O8vhxxWgHXyDOC5Ihqa+6LrGj46QLYM1w4c4/gl3T2cHmJHv81fDN5dGCtAeviFuXJCMjpDpBfICnWwfe+ZmYToY4OOeneH/1jQ0yG+sYe7tvA2+ubSWFKB9fCPS0JTS+PICdHxQGz9agI4PGPhCATo+YOHHFKCv+SYEfHOJjRSg45uQ8OUFqHi3876jGvbf7oSGoQHo9XvBMzcDPi6Y3MNWaOWwK8QXDIJ7dhZ6fX5oeP4C8rtcsNVWrzp+tACV8HdeaQXnmBt8oSCV7QUmCfxowrL4gxw4PaOw62K7avhCASrgbz9nh8sTI1T3dhiK+PFpHxmD3PpmxfEtJXVSAcrh73N1wOTifMrgs2ImFxZh3/VbiuJbjvMFKId/8N4d6ruajAr4sSm9/0gx/MQCKOIfedCf8vismIL+XxXBlxdAedlJF3xWzL4OF3X8aAGUL7gvAwtphc+Sa8L8IuTaW6jiW47bIYP2rWYq3e2waw0npN0zThVfLIDufX664rNidrVepoZvKY4pgMYTbtu4J63xWS4MTvcYNfxIAbS2F7T4hMtSxCfxB0OwtaqJCj5fAK03Wfk9nWmPz4rJv95DBd9SfEYsgMJrRLKxthHwWS4M9U+HqOALBVB6h0t2NTcCPsuF4e6Unwr+8gUk+QKdbClvBHyWC4P79RwVfEtRfAHrmF4g4yEbAZ/lwuBd5KjgywtY5+hIUgWEUg8/voD14FuK6sUCKMztvPUSlKL4bMwStF58oQBKQ1NkMm0j4LP8RfgVFfwVCkhuYq3hxcCGwGfJbeiTYSr4lsKEApIfF/zy9s0Ngc9yS5DfcYcKflwB65vV3NJQC/7VJhvSBN8XCMEH1rNU8C2FDVIBdAZlnaOetMZnuSVwDo9TwxcLoDelvLPtYlrjs9wS7Gy5Sg0/iy+A8oh4+9hI2uI7I79+OvjLFLD++fztzQ0wubiQdvgTcwHIrW2lip91TFYAvcMReTdvpBU+w4Uh70o3dfysYw6pAPonUwp+uZcW+Cy3BAW9DxXBFwtQ7ljQof6+lMcvvfe7YvjRAhQ8k5XX2QkTCwspuebnKbTsyAtQ4UDcdocD2kZHU+puJ1eBC248fqQAtU4j7rhwCS55RsDPcZp8wr00PA47ztK9z18NP+toI2RgHAXdYrPD/i4X1D8fhN5pH7hnZmE6EFQNfzrAgef1PL+rSTbWyN4Oze2FteKTAv4H1EeJzqpGbsIAAAAASUVORK5CYII=", profileCompleted: true },
  },
  student: {
    user: { uid: "stu1", email: "jdelacruz@cdd.edu.ph" },
    profile: { role: "student", email: "jdelacruz@cdd.edu.ph", firstName: "Juan", lastName: "Dela Cruz", studentId: "2023-0142", section: "BSIT 3A", contactNumber: "0917 123 4567", photoURL: "data:image/png;base64,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", profileCompleted: true },
  },
  student2: {
    user: { uid: "stu3", email: "abautista@cdd.edu.ph" },
    profile: { role: "student", email: "abautista@cdd.edu.ph", firstName: "Ana", lastName: "Bautista", studentId: "2023-0190", section: "BSIT 3A", profileCompleted: true },
  },
  admin: {
    user: { uid: "adm1", email: "admin@cdd.edu.ph" },
    profile: { role: "admin", email: "admin@cdd.edu.ph", firstName: "SITE", lastName: "Administrator" },
  },
  newstudent: {
    user: { uid: "stu9", email: "lsoriano@cdd.edu.ph" },
    profile: { role: "student", email: "lsoriano@cdd.edu.ph", firstName: "", lastName: "", studentId: "2023-0222", section: "BSIT 1A", profileCompleted: false },
  },
  guest: { user: null, profile: null },
};
const me = PEOPLE[as] || PEOPLE.student;

function become(who) {
  sessionStorage.setItem("devAs", who);
  window.location.assign("/");
}

const ROLES = [
  ["student", "Student", "/main"],
  ["instructor", "Instructor", "/instructor"],
  ["admin", "Admin", "/admin"],
  ["guest", "Signed out", "/"],
];

/** The showcase's role switcher, bottom left; tap "Showcase" to fold it away. Only in this harness. */
function ShowcaseBar() {
  const [open, setOpen] = useState(() => !window.location.pathname.startsWith("/lab") && window.innerWidth > 640);
  const pick = (who, to) => {
    sessionStorage.setItem("devAs", who);
    window.location.assign(to);
  };
  const current = ROLES.find(([who]) => who === as)?.[1] || "Student";
  return (
    <div style={{ position: "fixed", left: 12, bottom: open ? 12 : 76, zIndex: 9999, display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 999, background: "rgba(2,44,34,.92)", boxShadow: "0 8px 24px rgba(0,0,0,.25)", font: "600 12px system-ui, sans-serif" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: 0, background: "none", padding: "6px 8px", cursor: "pointer", font: "inherit", color: "#a7f3d0" }}>
        {open ? "Showcase ◂" : `Showcase: ${current} ▸`}
      </button>
      {open &&
        ROLES.map(([who, label, to]) => (
          <button
            key={who}
            type="button"
            onClick={() => pick(who, to)}
            style={{ border: 0, borderRadius: 999, padding: "6px 10px", cursor: "pointer", font: "inherit", background: who === as ? "#10b981" : "transparent", color: who === as ? "#fff" : "#d1fae5" }}
          >
            {label}
          </button>
        ))}
    </div>
  );
}

export function AuthProvider({ children }) {
  return (
    <>
      {children}
      <ShowcaseBar />
    </>
  );
}

let version = 0;
const listeners = new Set();
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
export const useAuth = () => (useSyncExternalStore(subscribe, () => version), {
  user: me.user,
  currentUser: me.user,
  profile: me.profile,
  userProfile: me.profile,
  loading: false,
  authError: null,
  loginWithEmail: async (email) => {
    const e = String(email).toLowerCase();
    become(e.startsWith("admin") ? "admin" : e.startsWith("prof") || e.startsWith("rsantos") ? "instructor" : "student");
  },
  logout: async () => become("guest"),
  updateUserProfile: async (patch) => {
    me.profile = { ...me.profile, ...patch };
    version++;
    listeners.forEach((l) => l());
  },
  changePassword: async () => {},
  // the admin lock: "letmein" is the right password here, anything else is wrong
  confirmPassword: async (pw) => {
    if (pw !== "letmein") throw Object.assign(new Error("Wrong password"), { code: "auth/wrong-password" });
  },
  completeProfile: async (data) => {
    me.profile = { ...me.profile, ...data, consent: { ...data.consent, at: Date.now() }, profileCompleted: true };
    window.__lastConsent = me.profile.consent;
    version++;
    listeners.forEach((l) => l());
  },
});
