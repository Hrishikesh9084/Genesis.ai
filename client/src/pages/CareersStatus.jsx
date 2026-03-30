import { useMemo, useState } from "react";
import api from "../services/api";

function toTitleCase(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

const statusDescriptions = {
  new: "Your application was received and is waiting for initial review.",
  reviewing: "Our team is actively reviewing your profile.",
  shortlisted: "You have been shortlisted for the next stage.",
  rejected: "We are not moving forward with this role at the moment.",
  hired: "Great news. Your application has reached the hired stage.",
  archived: "Your application is archived for now.",
};

export default function CareersStatus() {
  const [formValues, setFormValues] = useState({
    applicationId: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [application, setApplication] = useState(null);

  const statusLabel = useMemo(() => toTitleCase(application?.status || ""), [application]);
  const statusDescription = useMemo(
    () => statusDescriptions[String(application?.status || "").toLowerCase()] || "Status is available in your application record.",
    [application]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setApplication(null);

    try {
      const response = await api.post("/careers/status", {
        applicationId: formValues.applicationId.trim(),
        email: formValues.email.trim(),
      });
      setApplication(response.data?.application || null);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Unable to fetch application status right now.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
          Careers
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Track Application Status
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          Enter your application ID and the same email used during application to view current status.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Application ID</label>
            <input
              className="input-field"
              name="applicationId"
              value={formValues.applicationId}
              onChange={handleChange}
              placeholder="e.g. 7d94f7c2-2d89-4f12-a70d-3e5f8a5be4f8"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Email</label>
            <input
              className="input-field"
              type="email"
              name="email"
              value={formValues.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full rounded-xl" disabled={isLoading}>
            {isLoading ? "Checking..." : "Check Status"}
          </button>
        </form>

        {application && (
          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Current status</p>
            <p className="mt-2 text-2xl font-semibold text-white">{statusLabel}</p>
            <p className="mt-3 text-sm text-emerald-100">{statusDescription}</p>

            <div className="mt-5 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
              <p><span className="text-slate-400">Role:</span> {application.role_title}</p>
              <p><span className="text-slate-400">Candidate:</span> {application.full_name}</p>
              <p><span className="text-slate-400">Applied At:</span> {formatDateTime(application.created_at)}</p>
              <p><span className="text-slate-400">Last Updated:</span> {formatDateTime(application.updated_at)}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
