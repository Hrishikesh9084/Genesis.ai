import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Github, Loader2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import api from '../services/api';
import { GITHUB_OAUTH_URL, GOOGLE_OAUTH_URL } from '../services/api';
import { validateLoginInput } from '../utils/validators';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const verified = searchParams.get("verified") === "true";
    const verifyEmailSent = searchParams.get("verifyEmailSent") === "true";
    const email = searchParams.get("email");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
      const friendlyMessageMap = {
        google_no_code: "Google sign-in did not return an authorization code.",
        google_token_failed: "Google token exchange failed. Check your Google OAuth credentials and redirect URI.",
        google_no_email: "Google account did not return an email.",
        google_failed: "Google sign-in failed. Please try again.",
        google_access_denied: "Google sign-in was cancelled.",
      };

      const message = friendlyMessageMap[oauthError] || `Google sign-in error: ${oauthError}`;
      const fullMessage = oauthErrorDescription
        ? `${message} (${oauthErrorDescription})`
        : message;

      toast.error(fullMessage);
      navigate("/login", { replace: true });
      return;
    }

    if (!verified && !verifyEmailSent) {
      return;
    }

    if (verified) {
      toast.success("Email verified. You can now log in.");
    }

    if (verifyEmailSent) {
      toast.success(
        email
          ? `Verification email sent to ${email}. Please verify before login.`
          : "Verification email sent. Please verify before login.",
      );
    }

    navigate("/login", { replace: true });
  }, [navigate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast.error("Please accept the Terms and Conditions to continue.");
      return;
    }

    const validationError = validateLoginInput({ email, password });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    const emailToUse = forgotEmail.trim() || email.trim();
    if (!emailToUse) {
      toast.error("Enter your email to receive a reset link.");
      return;
    }

    setForgotLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: emailToUse });
      toast.success(response.data?.message || 'If this email is registered, a reset link has been sent.');
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset link');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-white">Welcome back</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
          <input
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            placeholder="you@example.com"
            className="input-field"
            type="email"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword((prev) => !prev);
                setForgotEmail(email.trim());
              }}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              Forgot password?
            </button>
          </div>
          <input
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            placeholder="Enter your password"
            className="input-field"
            type="password"
            required
          />
        </div>

        {showForgotPassword && (
          <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3 space-y-3">
            <p className="text-xs text-gray-400">
              Enter your account email. We will send a password reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {forgotLoading ? 'Sending reset link...' : 'Send reset link'}
              </button>
            </form>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-orange-500 focus:ring-orange-500"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            I accept the{" "}
            <Link to="/terms-of-service" className="text-orange-400 hover:text-orange-300" target="_blank" rel="noreferrer">
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy-policy" className="text-orange-400 hover:text-orange-300" target="_blank" rel="noreferrer">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !acceptedTerms}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-900/50 px-3 text-gray-500">or</span>
          </div>
        </div>

        <a
          href={GOOGLE_OAUTH_URL}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-700/60 bg-white text-gray-900 hover:bg-gray-100 transition-all"
        >
          <FcGoogle className="w-5 h-5" />
          <span>Continue with Google</span>
        </a>

        <a
          href={GITHUB_OAUTH_URL}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-700/60 bg-gray-800/50 text-white hover:bg-gray-700/50 transition-all"
        >
          <Github className="w-5 h-5" />
          <span>Continue with GitHub</span>
        </a>

        <p className="text-center text-sm text-gray-400">
          Don't have an account?{" "}
          <Link to="/register" className="text-orange-400 hover:text-orange-300 font-medium">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
