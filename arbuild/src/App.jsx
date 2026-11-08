import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import { ThemeProvider } from "./context/ThemeContext";

// ============================================================
// PAGES
// ============================================================

// The first screens come with the app; every other page loads when it's opened, so signing in on a
// phone doesn't wait for three.js and the 3D models (Main and the Build Lab bring those).
import Welcome from "./pages/Welcome";
import ProfileSetup from "./pages/ProfileSetup";
const MainPage = lazy(() => import("./pages/Main"));
const Profile = lazy(() => import("./pages/Profile"));
const BuildLab = lazy(() => import("./pages/BuildLab")); // Build Lab: assemble + disassemble in one page
const About = lazy(() => import("./pages/About")); // what ARBuild is, with the 3D model credits
const CalendarPage = lazy(() => import("./pages/Calendar")); // class meetings, due dates, anything missed
const ThreeCameraView = lazy(() => import("./pages/ThreeCameraView"));

// IMPORTANT:
// Admin must be a DEFAULT export.
// Your Admin.jsx should have:
// export default function Admin() { ... }

const Admin = lazy(() => import("./pages/Admin.jsx"));
const Instructor = lazy(() => import("./pages/Instructor"));
const Classes = lazy(() => import("./pages/Classes"));

// ============================================================
// STYLES
// ============================================================

// Every page's styles load up front, in the order they always have (a later file wins a tie), so a
// page looks the same whichever pages were opened before it. Only the pages' code loads later.
import "./styles/Classes.css";
import "./styles/Main.css";
import "./styles/AppShell.css";
import "./styles/Calendar.css";
import "./styles/RigStudio.css";
import "./styles/Profile.css";
import "./styles/BuildLab.css";
import "./styles/BuildLabParts.css";
import "./styles/BuildLabTask.css";
import "./styles/BuildLabPhone.css";
import "./styles/Admin.css";
import "./styles/Instructor.css";
import "./styles/InstructorClass.css";
import "./styles/Troubleshoot.css";
import "./styles/tokens.css";

// ============================================================
// LOADING SCREEN
// ============================================================

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
      }}
    >
      Loading…
    </div>
  );
}

// ============================================================
// ROOT REDIRECT
// ============================================================

// An invite link (/classes?join=CODE) opened while signed out: keep the code through sign-in
// (and first-time setup), then go to the class.
const PENDING_JOIN = "arbuild.pendingJoin";

function rememberJoin() {
  const code = new URLSearchParams(window.location.search).get("join");
  if (window.location.pathname === "/classes" && code) {
    try {
      sessionStorage.setItem(PENDING_JOIN, code);
    } catch {
      /* storage blocked */
    }
  }
}

// read only: the class page clears it once it has joined (renders may run twice)
function pendingJoin() {
  try {
    return sessionStorage.getItem(PENDING_JOIN);
  } catch {
    return null;
  }
}

/** Where a signed-in student or faculty member lands. */
function homeFor(profile) {
  // everyone starts on the main page; an invite link a student opened goes to that class
  const join = profile.role === "faculty" ? null : pendingJoin();
  return join ? `/classes?join=${encodeURIComponent(join)}` : "/main";
}

function RootRedirect() {
  const { user, profile, loading } = useAuth();

  // Firebase/AuthContext is still loading
  if (loading) return <LoadingScreen />;

  // Not logged in
  if (!user) return <Welcome />;

  // Firebase user exists but Firestore profile hasn't been loaded/created
  if (!profile) return <Navigate to="/" replace />;

  // Admin
  if (profile.role === "admin") return <Navigate to="/admin" replace />;

  // First-time student/faculty
  if (profile.profileCompleted !== true) return <Navigate to="/setup" replace />;

  // Students and faculty land on the main page (a student's invite link goes to that class)
  return <Navigate to={homeFor(profile)} replace />;
}

// ============================================================
// PROFILE SETUP ROUTE
// ============================================================

function SetupRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  // Not logged in
  if (!user) return <Navigate to="/" replace />;

  // Admin does not use ProfileSetup
  if (profile?.role === "admin") return <Navigate to="/admin" replace />;

  // Profile has already been completed
  if (profile?.profileCompleted === true) {
    return <Navigate to={homeFor(profile)} replace />;
  }

  // New student/faculty account
  return <ProfileSetup />;
}

// ============================================================
// GENERAL USER GATE
// ============================================================

function Gate({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  // Not logged in (an invite link's code is kept for after sign-in)
  if (!user) {
    rememberJoin();
    return <Navigate to="/" replace />;
  }

  // No Firestore profile
  if (!profile) return <Navigate to="/" replace />;

  // Admin cannot access normal student/faculty pages
  if (profile.role === "admin") return <Navigate to="/admin" replace />;

  // Student/faculty has not completed first-time setup
  if (profile.profileCompleted !== true) return <Navigate to="/setup" replace />;

  return children;
}

// ============================================================
// ADMIN GATE
// ============================================================

function AdminGate({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  // Not logged in
  if (!user) return <Navigate to="/" replace />;

  // No Firestore profile
  if (!profile) return <Navigate to="/" replace />;

  // Only administrators can access /admin
  if (profile.role !== "admin") return <Navigate to="/main" replace />;

  return children;
}

// ============================================================
// INSTRUCTOR GATE (faculty, and admins)
// ============================================================

function InstructorGate({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user || !profile) return <Navigate to="/" replace />;

  // Students have no instructor page
  if (profile.role === "student") return <Navigate to="/main" replace />;

  // Faculty must finish first-time setup
  if (profile.role === "faculty" && profile.profileCompleted !== true) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}

// ============================================================
// APP
// ============================================================

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
          <Routes>

            {/* ==================================================
                PUBLIC / ROOT
            ================================================== */}

            <Route path="/" element={<RootRedirect />} />

            {/* ==================================================
                ONE-TIME PROFILE SETUP
            ================================================== */}

            <Route path="/setup" element={<SetupRoute />} />

            {/* ==================================================
                STUDENT / FACULTY
            ================================================== */}

            <Route
              path="/main"
              element={
                <Gate>
                  <MainPage />
                </Gate>
              }
            />

            <Route
              path="/profile"
              element={
                <Gate>
                  <Profile />
                </Gate>
              }
            />

            <Route
              path="/about"
              element={
                <Gate>
                  <About />
                </Gate>
              }
            />

            {/* the credits moved into About */}
            <Route path="/credits" element={<Navigate to="/about#credits" replace />} />

            <Route
              path="/calendar"
              element={
                <Gate>
                  <CalendarPage />
                </Gate>
              }
            />

            {/* Build Lab (assemble + disassemble) */}
            <Route
              path="/lab"
              element={
                <Gate>
                  <BuildLab />
                </Gate>
              }
            />

            {/* Old routes now open the Build Lab and skip its start screen */}
            <Route
              path="/assemble"
              element={<Navigate to="/lab?start=build" replace />}
            />

            <Route
              path="/disassemble"
              element={<Navigate to="/lab?start=teardown" replace />}
            />

            <Route
              path="/3d-camera-view"
              element={
                <Gate>
                  <ThreeCameraView />
                </Gate>
              }
            />

            {/* ==================================================
                ADMIN
            ================================================== */}

            {/* ==================================================
                INSTRUCTOR (class sessions + live monitor)
            ================================================== */}

            <Route
              path="/instructor"
              element={
                <InstructorGate>
                  <Instructor />
                </InstructorGate>
              }
            />
            <Route path="/instructor/c/:classId" element={<InstructorGate><Instructor page="class" /></InstructorGate>} />
            <Route path="/instructor/c/:classId/lab/:code" element={<InstructorGate><Instructor page="classLab" /></InstructorGate>} />
            <Route path="/instructor/lab/:code" element={<InstructorGate><Instructor page="oldLab" /></InstructorGate>} />

            {/* Classes (students): join with a code, then announcements, materials, labs */}
            <Route path="/classes" element={<Gate><Classes /></Gate>} />
            <Route path="/classes/:classId" element={<Gate><Classes page="class" /></Gate>} />

            <Route
              path="/admin"
              element={
                <AdminGate>
                  <Admin />
                </AdminGate>
              }
            />

            {/* ==================================================
                UNKNOWN ROUTE
            ================================================== */}

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}