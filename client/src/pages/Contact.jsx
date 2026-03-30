import { Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import api from "../services/api";

const contactCards = [
  {
    title: "Email",
    value: "hello@genesis-ai.example",
    helper: "We reply within 1 business day.",
    icon: Mail,
  },
  {
    title: "Phone",
    value: "+1 (555) 014-9230",
    helper: "Mon-Fri, 9:00 AM to 6:00 PM",
    icon: Phone,
  },
  {
    title: "Office",
    value: "San Francisco, CA",
    helper: "Remote-first team with global coverage.",
    icon: MapPin,
  },
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (submitted) setSubmitted(false);
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await api.post("/contact", formValues);
      setSubmitted(true);
      setFormValues({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitted(false);
      setErrorMessage(error.response?.data?.error || "Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
              Contact Us
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Tell us what you are building.
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-300">
              Have product questions, enterprise needs, or feedback for Genesis? Send us a message and
              our team will follow up with the right next steps.
            </p>

            <div className="mt-7 space-y-3">
              {contactCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{card.title}</p>
                        <p className="mt-1 text-sm text-slate-200">{card.value}</p>
                        <p className="mt-1 text-xs text-slate-400">{card.helper}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/3 p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-white">Send a Message</h2>
            <p className="mt-2 text-sm text-slate-300">
              Share context so we can route your request quickly.
            </p>

            {submitted && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                Thanks for reaching out. Your message has been received, and we sent a confirmation email.
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Name</label>
                <input
                  className="input-field"
                  type="text"
                  name="name"
                  placeholder="Your full name"
                  value={formValues.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Email</label>
                <input
                  className="input-field"
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  value={formValues.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Subject</label>
                <input
                  className="input-field"
                  type="text"
                  name="subject"
                  placeholder="How can we help?"
                  value={formValues.subject}
                  onChange={handleChange}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Message</label>
                <textarea
                  className="input-field min-h-32 resize-y"
                  name="message"
                  placeholder="Tell us about your use case"
                  value={formValues.message}
                  onChange={handleChange}
                  maxLength={5000}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full rounded-xl" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}