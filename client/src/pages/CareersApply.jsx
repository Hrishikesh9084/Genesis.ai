import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import api from "../services/api";

export default function CareersApply() {
  const [searchParams] = useSearchParams();
  const roleFromQuery = searchParams.get("role") || "";

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [hcaptchaToken, setHcaptchaToken] = useState("");
  const hcaptchaRef = useRef(null);
  const hcaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY || "";
  const [formValues, setFormValues] = useState({
    roleId: "",
    fullName: "",
    email: "",
    phone: "",
    location: "",
    yearsExperience: "",
    linkedinUrl: "",
    portfolioUrl: "",
    coverLetter: "",
  });

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError("");
      try {
        const response = await api.get("/careers/jobs");
        if (!mounted) return;
        const nextJobs = response.data?.jobs || [];
        setJobs(nextJobs);

        const hasRoleFromQuery = nextJobs.some((job) => job.id === roleFromQuery);
        setFormValues((prev) => ({
          ...prev,
          roleId: hasRoleFromQuery ? roleFromQuery : nextJobs[0]?.id || "",
        }));
      } catch (err) {
        if (!mounted) return;
        setJobsError(err.response?.data?.error || "Unable to load openings right now.");
      } finally {
        if (mounted) setJobsLoading(false);
      }
    };

    loadJobs();
    return () => {
      mounted = false;
    };
  }, [roleFromQuery]);

  const selectedRole = useMemo(
    () => jobs.find((job) => job.id === formValues.roleId),
    [jobs, formValues.roleId]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (submitted) setSubmitted(false);
    if (errorMessage) setErrorMessage("");
  };

  const handleResumeFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setResumeFile(nextFile);
    if (errorMessage) setErrorMessage("");
    if (submitted) setSubmitted(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!resumeFile) {
      setErrorMessage("Please upload your resume file (PDF, DOC, or DOCX).");
      return;
    }

    if (!hcaptchaToken) {
      setErrorMessage("Please complete the hCaptcha challenge.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = new FormData();
      Object.entries(formValues).forEach(([key, value]) => {
        payload.append(key, value ?? "");
      });
      payload.append("resume", resumeFile);
      payload.append("hcaptchaToken", hcaptchaToken);

      const response = await api.post("/careers/apply", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const applicationId = response?.data?.applicationId || "";

      setSubmitted(true);
      setSubmittedApplicationId(applicationId);
      setFormValues((prev) => ({
        ...prev,
        fullName: "",
        email: "",
        phone: "",
        location: "",
        yearsExperience: "",
        linkedinUrl: "",
        portfolioUrl: "",
        coverLetter: "",
      }));
      setResumeFile(null);
      setHcaptchaToken("");
      if (hcaptchaRef.current) {
        hcaptchaRef.current.resetCaptcha();
      }
    } catch (error) {
      setSubmitted(false);
      setSubmittedApplicationId("");
      setErrorMessage(error.response?.data?.error || "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
          Careers Application
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Apply to join Genesis.ai
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          Complete this application and our hiring team will review your profile.
        </p>

        {jobsLoading && (
          <div className="mt-6 rounded-lg border border-white/10 bg-white/3 px-4 py-3 text-sm text-slate-300">
            Loading open roles...
          </div>
        )}

        {jobsError && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {jobsError}
          </div>
        )}

        {submitted && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <p>Application submitted successfully. We have sent a confirmation email.</p>
            {submittedApplicationId && (
              <p className="mt-2">
                Application ID: <span className="font-semibold text-white">{submittedApplicationId}</span>
              </p>
            )}
            <p className="mt-2">
              Track anytime at{" "}
              <Link className="font-medium text-emerald-100 underline" to="/careers/status">
                /careers/status
              </Link>
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Role</label>
            <select
              className="input-field"
              name="roleId"
              value={formValues.roleId}
              onChange={handleChange}
              required
              disabled={jobsLoading || jobs.length === 0}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.location})
                </option>
              ))}
            </select>
            {selectedRole && (
              <p className="mt-2 text-xs text-slate-400">{selectedRole.department} • {selectedRole.type}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Full name</label>
              <input className="input-field" name="fullName" value={formValues.fullName} onChange={handleChange} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Email</label>
              <input className="input-field" type="email" name="email" value={formValues.email} onChange={handleChange} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Phone</label>
              <input className="input-field" name="phone" value={formValues.phone} onChange={handleChange} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Current location</label>
              <input className="input-field" name="location" value={formValues.location} onChange={handleChange} placeholder="City, Country" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Years of experience</label>
            <input
              className="input-field"
              type="number"
              min="0"
              max="60"
              name="yearsExperience"
              value={formValues.yearsExperience}
              onChange={handleChange}
              placeholder="Enter Your Experience"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">LinkedIn URL</label>
              <input
                className="input-field"
                type="url"
                name="linkedinUrl"
                value={formValues.linkedinUrl}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Portfolio URL</label>
              <input
                className="input-field"
                type="url"
                name="portfolioUrl"
                value={formValues.portfolioUrl}
                onChange={handleChange}
                placeholder="https://your-portfolio.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Resume file (PDF, DOC, DOCX)</label>
            <input
              className="input-field"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeFileChange}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Max file size: 8MB.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Spam protection</label>
            {hcaptchaSiteKey ? (
              <HCaptcha
                ref={hcaptchaRef}
                sitekey={hcaptchaSiteKey}
                onVerify={(token) => setHcaptchaToken(token)}
                onExpire={() => setHcaptchaToken("")}
                onError={() => setHcaptchaToken("")}
              />
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                hCaptcha site key is not configured. Set VITE_HCAPTCHA_SITE_KEY in client environment.
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Cover letter</label>
            <textarea
              className="input-field min-h-36 resize-y"
              name="coverLetter"
              value={formValues.coverLetter}
              onChange={handleChange}
              minLength={50}
              maxLength={5000}
              placeholder="Tell us why you are a fit for this role."
            />
            <p className="mt-1 text-xs text-slate-500">Minimum 50 characters.</p>
          </div>

          <button type="submit" className="btn-primary w-full rounded-xl" disabled={isSubmitting || jobsLoading || jobs.length === 0}>
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-400">
          Looking for role details first? <Link className="text-orange-300 hover:text-orange-200" to="/careers">Browse open roles</Link>
          <span className="mx-2 text-slate-500">•</span>
          <Link className="text-orange-300 hover:text-orange-200" to="/careers/status">Track application status</Link>
          <span className="mx-2 text-slate-500">•</span>
          <Link className="text-cyan-300 hover:text-cyan-200" to="/careers/mock-interview">Practice AI mock interview</Link>
        </div>
      </div>
    </section>
  );
}
