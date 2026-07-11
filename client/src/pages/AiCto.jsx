import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, BrainCircuit, CheckCircle2, ChevronDown, Loader2, Lightbulb, Shield, Sparkles, Target, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

const MODEL_FALLBACKS = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "mistral-large-latest", label: "Mistral Large" },
  { id: "grok-3", label: "Grok 3" },
];

const defaultState = {
  idea: "",
  audience: "",
  goal: "",
  budget: "",
  timeline: "",
  constraints: "",
};

function SectionCard({ title, icon: Icon, children, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? "border-orange-500/20 bg-orange-500/5"
      : "border-white/10 bg-white/5";

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${toneClass}`}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-orange-300" /> : null}
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatPill({ label, value, tone = "orange" }) {
  const classes =
    tone === "green"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : tone === "red"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
        : "border-orange-500/20 bg-orange-500/10 text-orange-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${classes}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function AiCto() {
  const { refreshUser, user } = useAuth();
  const [form, setForm] = useState(defaultState);
  const [model, setModel] = useState("gemini-2.5-pro");
  const [showModelList, setShowModelList] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [creditsRemaining, setCreditsRemaining] = useState(user?.credits ?? null);

  useEffect(() => {
    if (user?.credits !== undefined) {
      setCreditsRemaining(user.credits);
    }
  }, [user?.credits]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest?.("[data-model-picker]")) {
        setShowModelList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedModelLabel = useMemo(
    () => MODEL_FALLBACKS.find((item) => item.id === model)?.label || model,
    [model]
  );

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();

    if (form.idea.trim().length < 30) {
      toast.error("Describe the idea in at least 30 characters.");
      return;
    }

    setAnalyzing(true);
    try {
      const { data } = await api.post("/cto/analyze", {
        ...form,
        model,
      });

      setReport(data.report);
      setCreditsRemaining(data.creditsRemaining);
      await refreshUser().catch(() => {});
      toast.success("AI CTO analysis generated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to analyze idea.");
    } finally {
      setAnalyzing(false);
    }
  };

  const score = report?.startupScore ?? "-";
  const productScore = report?.scores?.product ?? "-";
  const technicalScore = report?.scores?.technical ?? "-";
  const marketScore = report?.scores?.market ?? "-";
  const executionScore = report?.scores?.execution ?? "-";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:py-10">
      <div className="mb-6 flex items-center gap-3 text-sm text-gray-300">
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-orange-200">
          AI CTO
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-orange-200">
                <BrainCircuit className="h-3.5 w-3.5" />
                Startup intelligence
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                AI CTO for startup idea analysis
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300 sm:text-base">
                Describe your idea and Genesis will analyze product fit, architecture, launch risk, engineering scope, security, and go-to-market direction.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[18rem]">
              <StatPill label="Credits" value={creditsRemaining ?? "-"} />
              <StatPill label="Status" value={analyzing ? "Analyzing" : "Ready"} tone={analyzing ? "green" : "orange"} />
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Startup idea</label>
              <textarea
                value={form.idea}
                onChange={updateField("idea")}
                className="input-field min-h-40 resize-y"
                placeholder="Example: A SaaS platform for small clinics to manage appointments, staff, reminders, billing, and patient communication."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Target audience</label>
                <input value={form.audience} onChange={updateField("audience")} className="input-field" placeholder="Who is the product for?" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Primary goal</label>
                <input value={form.goal} onChange={updateField("goal")} className="input-field" placeholder="What business outcome do you want?" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Budget</label>
                <input value={form.budget} onChange={updateField("budget")} className="input-field" placeholder="Example: under $10k" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Timeline</label>
                <input value={form.timeline} onChange={updateField("timeline")} className="input-field" placeholder="Example: MVP in 8 weeks" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Constraints</label>
              <textarea
                value={form.constraints}
                onChange={updateField("constraints")}
                className="input-field min-h-28 resize-y"
                placeholder="Technical, budget, team, compliance, or platform constraints."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div data-model-picker className="relative">
                <label className="mb-2 block text-sm font-medium text-gray-200">Model</label>
                <button
                  type="button"
                  onClick={() => setShowModelList((current) => !current)}
                  className="input-field flex w-full items-center justify-between gap-3"
                >
                  <span className="truncate text-left">{selectedModelLabel}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition ${showModelList ? "rotate-180" : ""}`} />
                </button>
                {showModelList && (
                  <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-gray-950/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    {MODEL_FALLBACKS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setModel(item.id);
                          setShowModelList(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5 ${model === item.id ? "text-orange-200" : "text-gray-200"}`}
                      >
                        <span>{item.label}</span>
                        {model === item.id && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analyzing ? "Analyzing..." : "Run AI CTO Analysis"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <SectionCard title="What this analysis returns" icon={Lightbulb} tone="accent">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Architecture recommendation",
                "MVP scope and priorities",
                "Roadmap and milestones",
                "Product, QA, security, and DevOps guidance",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-gray-200">
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          {report ? (
            <div className="space-y-6">
              <SectionCard title="Startup scores" icon={Target}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatPill label="Overall" value={score} />
                  <StatPill label="Product" value={productScore} />
                  <StatPill label="Technical" value={technicalScore} />
                  <StatPill label="Market" value={marketScore} />
                  <StatPill label="Execution" value={executionScore} />
                </div>
              </SectionCard>

              <SectionCard title="AI CTO summary" icon={Bot}>
                <p className="leading-7 text-gray-200">{report?.ideaSummary || "No summary returned."}</p>
              </SectionCard>

              <SectionCard title="Recommended stack" icon={Wrench}>
                <div className="flex flex-wrap gap-2">
                  {(report?.aiCto?.recommendedStack || []).map((item) => (
                    <span key={item} className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-sm text-orange-100">
                      {item}
                    </span>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Roadmap" icon={CheckCircle2}>
                <div className="space-y-3">
                  {(report?.roadmap || []).map((item, index) => (
                    <div key={`${item.phase}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">{item.phase}</p>
                      <p className="mt-1 text-sm text-gray-300">{item.duration} - {item.outcome}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Risks and security" icon={Shield}>
                <div className="space-y-3 text-sm text-gray-200">
                  {(report?.security?.topRisks || report?.aiCto?.risks || []).map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : (
            <SectionCard title="No analysis yet" icon={BrainCircuit} tone="accent">
              <p className="leading-7 text-gray-300">
                Submit a startup idea to generate your CTO-style analysis, product plan, and business guidance.
              </p>
            </SectionCard>
          )}
        </aside>
      </div>

      {analyzing && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <LoadingSpinner text="Analyzing your startup idea..." />
        </div>
      )}
    </div>
  );
}