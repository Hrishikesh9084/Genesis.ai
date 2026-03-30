import React from "react";

const sections = [
  {
    title: "Information We Collect",
    body:
      "We collect account details (such as name and email), authentication/security data, project and prompt content, integration metadata, and technical usage information needed to operate Genesis.ai.",
  },
  {
    title: "How We Use Information",
    body:
      "We use information to provide and improve the service, secure accounts, generate and edit projects, support preview/deploy workflows, and send transactional emails such as verification or password reset messages.",
  },
  {
    title: "Third-Party Services",
    body:
      "Depending on your settings and usage, Genesis.ai may process data through providers such as AI model APIs, GitHub, and deployment/email infrastructure partners.",
  },
  {
    title: "Your Rights",
    body:
      "Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict processing of your personal data.",
  },
  {
    title: "Contact",
    body:
      "For privacy requests, contact privacy@genesis-ai.example. Replace this with your production contact email before launch.",
  },
];

export default function PrivacyPolicy() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-sm">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-300">Last updated: March 30, 2026</p>

        <p className="mt-6 leading-7 text-slate-200">
          This page provides a public summary of how Genesis.ai handles personal information.
          The full policy is maintained in the project legal document.
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
