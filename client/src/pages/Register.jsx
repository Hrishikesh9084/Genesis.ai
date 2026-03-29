import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Chrome, Github, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { GITHUB_OAUTH_URL, GOOGLE_OAUTH_URL } from '../services/api';
import { validateRegisterInput } from "../utils/validators";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateRegisterInput({ name, email, password });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await register(name, email, password);
      toast.success(response.message || 'Account created. Please verify your email.');
      navigate(`/login?verifyEmailSent=true&email=${encodeURIComponent(email)}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-white">Create account</h2>
          <p className="text-gray-400 text-sm mt-1">Get started with Genesis</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
          <input
            onChange={(e) => setName(e.target.value)}
            value={name}
            placeholder="Your name"
            className="input-field"
            type="text"
            required
          />
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
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            required
            className="input-field"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Creating account..." : "Create Account"}
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
          <Chrome className="w-5 h-5" />
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
          Already have an account?{" "}
          <Link to="/login" className="text-orange-400 hover:text-orange-300 font-medium">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}
