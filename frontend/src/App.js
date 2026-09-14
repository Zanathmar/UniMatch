import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CompareProvider } from "./context/CompareContext";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword } from "./pages/Auth";
import ProfileWizard from "./pages/ProfileWizard";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import UniversityDetail from "./pages/UniversityDetail";
import Compare from "./pages/Compare";
import Scholarships from "./pages/Scholarships";
import Saved from "./pages/Saved";
import Timeline from "./pages/Timeline";

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Protected><ProfileWizard /></Protected>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/discover" element={<Protected><Discover /></Protected>} />
      <Route path="/university/:slug" element={<Protected><UniversityDetail /></Protected>} />
      <Route path="/compare" element={<Protected><Compare /></Protected>} />
      <Route path="/scholarships" element={<Protected><Scholarships /></Protected>} />
      <Route path="/saved" element={<Protected><Saved /></Protected>} />
      <Route path="/timeline" element={<Protected><Timeline /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CompareProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </CompareProvider>
    </AuthProvider>
  );
}
