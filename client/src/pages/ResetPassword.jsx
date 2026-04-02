import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const id = useMemo(() => searchParams.get("id") || "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const hasValidParams = Boolean(id && token);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasValidParams) {
      toast.error("Invalid or expired password reset link.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        id,
        token,
        newPassword,
      });

      toast.success(response.data?.message || "Password reset successful.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-white">Reset Password</h2>
          <p className="text-gray-400 text-sm mt-1">
            Set a new password for your account.
          </p>
        </div>

        {!hasValidParams && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            This reset link is invalid or incomplete.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className="input-field"
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="input-field"
            minLength={6}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !hasValidParams}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        <p className="text-center text-sm text-gray-400">
          Back to{" "}
          <Link to="/login" className="text-orange-400 hover:text-orange-300 font-medium">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}