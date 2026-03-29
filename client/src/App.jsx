import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { Navigate, Route, Routes } from "react-router-dom";
import LenisScroll from "./components/lenis-scroll";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import Background from "./components/Background";
import ScrollToTop from "./components/ScrollToTop";
import LoadingSpinner from "./components/LoadingSpinner";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const PricingPlans = lazy(() => import("./pages/pricing-plans"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewProject = lazy(() => import("./pages/NewProject"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const EditProject = lazy(() => import("./pages/EditProject"));
const DeployProject = lazy(() => import("./pages/DeployProject"));
const Settings = lazy(() => import("./pages/Settings"));
const GithubCallback = lazy(() => import("./pages/GithubCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const [showBootLoader, setShowBootLoader] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowBootLoader(false);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  if (showBootLoader) {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-black">
        <div className="fixed inset-0 opacity-60">
          <Background
            colorStops={["#5227FF", "#000", "#5227FF"]}
            blend={0.6}
            amplitude={1.2}
            speed={0.8}
          />
        </div>
        <div className="relative glass rounded-2xl px-8 py-10 text-center shadow-xl shadow-black/40">
          <LoadingSpinner text="Starting Genesis.ai..." size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      <LenisScroll />
      <ScrollToTop />
      <Navbar />
      <div className="fixed inset-0 -z-20 pointer-events-none backdrop-blur-2xl">
        <Background
          colorStops={["#5227FF", "#000", "#5227FF"]}
          blend={0.6}
          amplitude={1.2}
          speed={0.8}
        />
      </div>
      <main className="px-4">
        <Suspense
          fallback={
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
              <LoadingSpinner text="Loading..." />
            </div>
          }
        >
          <Routes>
            {/* Public routes - redirect to dashboard if logged in */}
            <Route path="/" element={<GuestRoute><Home /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

            {/* Public route - accessible by everyone */}
            <Route path="/plans" element={<PricingPlans />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-project" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
            <Route path="/project/:id/edit" element={<ProtectedRoute><EditProject /></ProtectedRoute>} />
            <Route path="/project/:id/deploy" element={<ProtectedRoute><DeployProject /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* OAuth callback - no guard, handles its own auth */}
            <Route path="/auth/github/callback" element={<GithubCallback />} />
            <Route path="/auth/google/callback" element={<GithubCallback />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}