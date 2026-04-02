import React from "react";

const sections = [
  {
    title: "What Are Cookies",
    body:
      "Cookies are small text files stored in your browser that help Genesis.ai remember preferences, maintain sessions, and improve reliability.",
  },
  {
    title: "How We Use Cookies",
    body:
      "We use cookies and similar technologies for authentication, session continuity, security checks, performance analysis, and improving user experience.",
  },
  {
    title: "Types of Cookies",
    body:
      "Genesis.ai may use essential cookies (required for core functionality), analytics cookies (to understand usage trends), and preference cookies (to remember selected settings).",
  },
  {
    title: "Third-Party Cookies",
    body:
      "Some integrated services may set their own cookies based on your usage, such as sign-in providers, payment tools, or analytics infrastructure.",
  },
  {
    title: "Managing Cookies",
    body:
      "You can control or delete cookies through your browser settings. Disabling essential cookies may affect login, session handling, or other core platform behavior.",
  },
  {
    title: "Contact",
    body:
      "For cookie-related questions, contact privacy@genesis-ai.example. Replace this with your production contact email before launch.",
  },
];

export default function CookiesPolicy() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-sm">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Cookies Policy
        </h1>
        <p className="mt-3 text-sm text-slate-300">Last updated: April 2, 2026</p>

        <p className="mt-6 leading-7 text-slate-200">
          This page explains how Genesis.ai uses cookies and similar technologies
          to provide secure and reliable product functionality.
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