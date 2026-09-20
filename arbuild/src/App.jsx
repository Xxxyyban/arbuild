import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Welcome from "./pages/Welcome";
import ProfileSetup from "./pages/ProfileSetup";
import MainPage from "./pages/Main";
import Profile from "./pages/Profile";
import ModePlaceholder from "./pages/ModePlaceholder";
import Assemble from "./pages/Assemble";
import Credits from "./pages/Credits";
import ThreeCameraView from "./pages/ThreeCameraView"; // Imported your new view page
import "./styles/tokens.css";

function Gate({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (!profile) return <Navigate to="/setup" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}

function RootRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && profile) return <Navigate to="/main" replace />;
  if (user && !profile) return <Navigate to="/setup" replace />;
  return <Welcome />;
}

function SetupRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (profile) return <Navigate to="/main" replace />;
  return <ProfileSetup />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/setup" element={<SetupRoute />} />
            <Route path="/main" element={<Gate><MainPage /></Gate>} />
            <Route path="/profile" element={<Gate><Profile /></Gate>} />
            <Route path="/credits" element={<Gate><Credits /></Gate>} />
            <Route path="/learn" element={<Gate><ModePlaceholder title="Learn / Explore" /></Gate>} />
            <Route path="/assemble" element={<Gate><Assemble /></Gate>} />
            <Route path="/disassemble" element={<Gate><ModePlaceholder title="Disassemble" /></Gate>} />
            <Route path="/3d-camera-view" element={<Gate><ThreeCameraView /></Gate>} /> {/* Added new AR / 3D camera route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}