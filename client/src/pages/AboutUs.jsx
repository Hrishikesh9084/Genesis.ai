import { Layers3, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const principles = [
  {
    title: "Build Fast, Ship Smart",
    description:
      "We help teams turn ideas into production-ready software quickly without skipping quality checks.",
    icon: Sparkles,
  },
  {
    title: "Developer First",
    description:
      "Every workflow is built around how real developers plan, write, test, and iterate.",
    icon: Workflow,
  },
  {
    title: "Security by Default",
    description:
      "From auth to deployment, we prioritize secure defaults so teams can move confidently.",
    icon: ShieldCheck,
  },
  {
    title: "Composable Platform",
    description:
      "Projects, previews, and deployments are modular so teams can adapt Genesis to their process.",
    icon: Layers3,
  },
];

const stats = [
  { label: "Projects launched", value: "10k+" },
  { label: "Preview environments", value: "25k+" },
  { label: "Avg. setup time", value: "< 10 min" },
];

export default function AboutUs() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
          About Genesis
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          We help teams create production-grade AI applications with less friction.
        </h1>
        <p className="mt-5 max-w-3xl leading-7 text-slate-300">
          Genesis is an all-in-one platform for building, previewing, and deploying AI-powered projects.
          Our mission is to remove repetitive setup work so teams can focus on product decisions,
          developer experience, and customer value.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((item) => (
            <article key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-sm text-slate-300">{item.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-semibold text-white">What Guides Us</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {principles.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-xl border border-white/10 bg-white/3 p-5">
                  <div className="inline-flex rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-base font-medium text-white">{item.title}</h3>
                  <p className="mt-2 leading-7 text-slate-300">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}