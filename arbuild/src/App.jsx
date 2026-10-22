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

import Welcome from "./pages/Welcome";
import ProfileSetup from "./pages/ProfileSetup";
import MainPage from "./pages/Main";
import Profile from "./pages/Profile";
import BuildLab from "./pages/BuildLab"; // Build Lab: assemble + disassemble in one page
import Credits from "./pages/Credits";
import ThreeCameraView from "./pages/ThreeCameraView";

// IMPORTANT:
// Admin must be a DEFAULT import.
// Your Admin.jsx should have:
// export default function Admin() { ... }

import Admin from "./pages/Admin.jsx";
import Instructor from "./pages/Instructor";

// ============================================================
// STYLES
// ============================================================

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

  // Faculty land on the instructor page
  if (profile.role === "faculty") return <Navigate to="/instructor" replace />;

  // Normal student user
  return <Navigate to="/main" replace />;
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
    return <Navigate to={profile.role === "faculty" ? "/instructor" : "/main"} replace />;
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

  // Not logged in
  if (!user) return <Navigate to="/" replace />;

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
              path="/credits"
              element={
                <Gate>
                  <Credits />
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
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}