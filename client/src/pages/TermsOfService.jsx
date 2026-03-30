import React from "react";

const sections = [
  {
    title: "Acceptance of Terms",
    body:
      "By creating an account, signing in, or using Genesis.ai, you agree to these Terms of Service and the Privacy Policy.",
  },
  {
    title: "Account Responsibilities",
    body:
      "You are responsible for maintaining account security and for activity that occurs under your account credentials.",
  },
  {
    title: "Acceptable Use",
    body:
      "You must not use the service for unlawful activity, abuse, malware distribution, rights infringement, or attempts to bypass security controls.",
  },
  {
    title: "Generated Output",
    body:
      "AI-generated code is provided as-is. You are responsible for reviewing, testing, and validating generated output before production use.",
  },
  {
    title: "Contact",
    body:
      "For legal questions, contact legal@genesis-ai.example. Replace this with your production legal contact before launch.",
  },
];

export default function TermsOfService() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-sm">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-slate-300">Last updated: March 30, 2026</p>

        <p className="mt-6 leading-7 text-slate-200">
          This page provides a public summary of Genesis.ai terms. The full legal
          terms are maintained in the project legal document.
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-xl border border-white/10 bg-white/2 p-5">
              <h2 className="text-lg font-medium text-white">{section.title}</h2>
              <p className="mt-2 leading-7 text-slate-300">{section.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
