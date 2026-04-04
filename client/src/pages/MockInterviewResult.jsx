import { Link, useLocation } from "react-router-dom";
import { Award, ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { useMemo } from "react";

function getMotivation(score, rounds) {
  if (score >= 9) {
    return rounds >= 4
      ? "Excellent performance across the full interview. You stayed sharp, confident, and ready for the real round."
      : "Excellent performance. Your answers were strong and confident, and that’s exactly the signal interviewers want to hear.";
  }

  if (score >= 8) {
    return rounds >= 4
      ? "Strong interview overall. You handled the questions well, and with one more practice run you’ll be even more polished."
      : "Strong performance. Your structure and clarity are already working well, so keep building on that momentum.";
  }

  if (score >= 7) {
    return rounds >= 4
      ? "Solid showing across the interview. Tightening a few examples and adding more impact will raise your next score quickly."
      : "Solid progress. You’re close to a very strong interview, and a bit more detail will make your answers stand out.";
  }

  if (score >= 6) {
    return rounds >= 4
      ? "Good foundation for a real interview. Focus on sharper examples and clearer outcomes, and your confidence will grow fast."
      : "Good practice session. You have the core ideas in place, and a little more polish will make your next interview much stronger.";
  }

  return rounds >= 4
    ? "This was a useful practice round. Keep going, because every answer you improve now will pay off in the real interview."
    : "This was a valuable start. Keep practicing the STAR format and your next run will feel much more natural.";
}

function getAccent(score) {
  if (score >= 8) return "emerald";
  if (score >= 6) return "cyan";
  return "amber";
}

export default function MockInterviewResult() {
  const location = useLocation();
  const result = useMemo(() => {
    try {
      const stored = window.sessionStorage.getItem("mockInterviewResult");
      const fallback = stored ? JSON.parse(stored) : null;
      return location.state || fallback || {};
    } catch (_err) {
      return location.state || {};
    }
  }, [location.state]);

  const score = Number(result.score || 0);
  const rounds = Number(result.rounds || 0);
  const accent = getAccent(score);
  const motivationalLine = result.motivationalLine || getMotivation(score, rounds);

  const accentClasses = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16 text-slate-200">
      <div className={`rounded-3xl border p-6 sm:p-8 md:p-10 ${accentClasses[accent]}`}>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/70">
          <Award className="h-4 w-4" />
          Interview Result
        </div>

        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Your interview score is {score.toFixed(1)}/10
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-100/90">
          {motivationalLine}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
            <p className="mt-2 text-lg font-medium text-white">{result.role || "General Software Engineer"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Rounds completed</p>
            <p className="mt-2 text-lg font-medium text-white">{rounds}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Next step</p>
            <p className="mt-2 text-lg font-medium text-white">Keep practicing</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Coach note
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-100/90">
            Use this score as feedback, not a verdict. The real interview will feel easier when you keep your answers structured, clear, and confident.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/careers/mock-interview" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Link>
          <Link to="/careers" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back to careers
          </Link>
        </div>
      </div>
    </section>
  );
}
