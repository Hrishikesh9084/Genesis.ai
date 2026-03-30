import { BriefcaseBusiness, Building2, MapPin, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function JobCard({ job }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-orange-300">
          {job.type}
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          {job.department}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold text-white">{job.title}</h3>

      <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-300">
        <MapPin className="h-4 w-4" />
        {job.location}
      </p>

      <p className="mt-4 leading-7 text-slate-300">{job.summary}</p>

      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {job.requirements?.map((requirement) => (
          <li key={requirement} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
            <span>{requirement}</span>
          </li>
        ))}
      </ul>

      <Link
        to={`/careers/apply?role=${encodeURIComponent(job.id)}`}
        className="btn-primary mt-6 inline-flex rounded-xl"
      >
        Apply for this role
      </Link>
    </article>
  );
}

export default function Careers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/careers/jobs");
        if (!mounted) return;
        setJobs(response.data?.jobs || []);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.error || "Unable to load openings right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadJobs();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
            Careers
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Help us build the future of AI product creation.
          </h1>
          <p className="mt-4 leading-7 text-slate-300">
            We are a product-focused team shipping fast, with strong engineering quality and strong user empathy.
            Explore our open roles and apply in minutes.
          </p>
        </div>

        <div className="mt-8 grid gap-4 rounded-xl border border-white/10 bg-white/3 p-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/4 p-4">
            <p className="inline-flex items-center gap-2 text-sm text-slate-300"><Rocket className="h-4 w-4" /> High ownership</p>
            <p className="mt-2 text-sm text-slate-200">Ship impactful features end-to-end.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/4 p-4">
            <p className="inline-flex items-center gap-2 text-sm text-slate-300"><BriefcaseBusiness className="h-4 w-4" /> Real product work</p>
            <p className="mt-2 text-sm text-slate-200">Solve production challenges used by real teams.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/4 p-4">
            <p className="inline-flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4" /> Flexible location</p>
            <p className="mt-2 text-sm text-slate-200">Remote-first setup with global collaboration.</p>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/3 p-5 text-slate-300">
            Loading open roles...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
