import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Code2,
  CreditCard,
  ExternalLink,
  FolderCode,
  Mail,
  MonitorSmartphone,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const highlights = [
  {
    title: "Generate project code",
    description:
      "Create full-stack applications from prompts with model-backed generation, editable files, and project history.",
    icon: Sparkles,
  },
  {
    title: "Preview in a workspace",
    description:
      "Run projects in isolated previews so users can inspect the UI and behavior before they deploy.",
    icon: MonitorSmartphone,
  },
  {
    title: "Ship to production",
    description:
      "Deploy projects, inspect deployment state, and surface logs that make release troubleshooting faster.",
    icon: Rocket,
  },
  {
    title: "Keep accounts secure",
    description:
      "Authentication, profile settings, OAuth callbacks, and guarded routes are built into the app shell.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "1. Sign in and buy credits",
    description:
      "Users authenticate with email/password or OAuth, then top up credits through the pricing flow.",
    icon: CreditCard,
  },
  {
    title: "2. Create a project",
    description:
      "The project builder collects requirements, model preferences, and stack settings before generation starts.",
    icon: FolderCode,
  },
  {
    title: "3. Edit and preview",
    description:
      "Generated files can be edited, previewed, and iterated on from the project workspace and preview tools.",
    icon: Code2,
  },
  {
    title: "4. Deploy and track",
    description:
      "Deployment actions create live environments, persist status, and connect users back to the project detail view.",
    icon: Server,
  },
];

const operationalNotes = [
  {
    title: "Production routing",
    body:
      "The server serves the client build in production and returns JSON on /api routes, so the docs page can be opened directly from the deployed app.",
  },
  {
    title: "OAuth redirect safety",
    body:
      "OAuth and email links should use deployed URLs in production. Localhost values are sanitized and can break sign-in or newsletter links.",
  },
  {
    title: "Deployment diagnostics",
    body:
      "Deploy flows are designed to expose logs and status details so failed releases can be diagnosed without leaving the app.",
  },
];

const featureGroups = [
  {
    title: "Creation",
    icon: Sparkles,
    items: [
      "Generate full-stack projects from a prompt",
      "Describe the app you want with pages, features, and functionality",
      "Choose supported AI model options while creating a project",
      "Reuse generated output as a starting point for new iterations",
    ],
  },
  {
    title: "Workspace",
    icon: Code2,
    items: [
      "Edit generated projects after creation",
      "Inspect project details and generated files in one place",
      "Review changes before sending a project forward",
      "Work from a focused project dashboard instead of juggling tools",
    ],
  },
  {
    title: "Preview and release",
    icon: MonitorSmartphone,
    items: [
      "Preview projects before deployment",
      "Deploy projects when they are ready to ship",
      "Track deployment state during the release flow",
      "Use deployment logs and status feedback to debug failed releases",
    ],
  },
  {
    title: "Account and billing",
    icon: CreditCard,
    items: [
      "Sign up and sign in with email and password",
      "Continue with GitHub or Google sign-in",
      "Buy credits to power generation and editing workflows",
      "Manage profile details, avatars, GitHub token, and deployment keys from settings",
    ],
  },
  {
    title: "Publishing and sharing",
    icon: ExternalLink,
    items: [
      "Push generated projects to GitHub",
      "Connect projects to supported deployment providers",
      "Keep project delivery aligned with production release workflows",
      "Use account-level settings to prepare deployment credentials",
    ],
  },
  {
    title: "Support and operations",
    icon: CircleHelp,
    items: [
      "Send messages through the contact form",
      "Browse open roles and apply through the careers flow",
      "Track a career application after submitting it",
      "Subscribe to the newsletter and manage admin/newsletter workflows",
      "Use the built-in support chat for app help",
    ],
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-3xl">
      <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-3 leading-7 text-slate-300">{description}</p>
    </div>
  );
}

export default function Documentation() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              <BookOpen className="h-3.5 w-3.5 text-orange-300" />
              Application documentation
            </p>
            <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
              Genesis.ai documentation for the full application stack.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
              This page summarizes the product features, the user journey, and the operational behavior of Genesis.ai.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-95"
              >
                Open dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-orange-500/40 hover:bg-white/8"
              >
                Contact support
                <Mail className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Build workflow", "Prompt-based project creation, editing, previewing, and release-ready delivery."],
              ["Account tools", "Email login, OAuth sign-in, profile management, and credit top-ups."],
              ["Project operations", "Project detail views, GitHub publishing, settings, and deployment controls."],
              ["Platform integrations", "OAuth, AI providers, email delivery, Razorpay, and hosting support."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-12 border-t border-white/10 p-6 sm:p-8 lg:p-10">
          <section>
            <SectionHeading
              eyebrow="Platform overview"
              title="What Genesis.ai does"
              description="The app is designed to compress the path from idea to deployed software by combining generation, preview, editing, and release workflows in one workspace."
            />

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="inline-flex rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-base font-medium text-white">{item.title}</h3>
                    <p className="mt-2 leading-7 text-slate-300">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading
              eyebrow="Complete features"
              title="Everything the platform currently offers"
              description="These are the core product capabilities available across the Genesis.ai experience."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {featureGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <article key={group.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-2 text-white">
                      <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-medium">{group.title}</h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                      {group.items.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading
              eyebrow="User journey"
              title="How the app is intended to be used"
              description="The main workflow starts with authentication and credits, then moves through generation, editing, previewing, and deployment."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium text-white">{step.title}</h3>
                        <p className="mt-2 leading-7 text-slate-300">{step.description}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading
              eyebrow="Operational notes"
              title="Things that matter in production"
              description="These are the implementation details that tend to cause support issues if they are missed during deployment."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {operationalNotes.map((item) => (
                <article key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="inline-flex rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-base font-medium text-white">{item.title}</h3>
                  <p className="mt-2 leading-7 text-slate-300">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
                <CircleHelp className="h-3.5 w-3.5" />
                Need help
              </p>
              <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-white">
                Keep the docs page close to the workspace.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                If something in the app is unclear, the fastest path is usually to inspect the workspace, review the feature that matches the task, and then open a support channel from inside the product.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-95"
              >
                Open support form
                <ExternalLink className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-orange-500/40 hover:bg-white/8"
              >
                Return to workspace
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}