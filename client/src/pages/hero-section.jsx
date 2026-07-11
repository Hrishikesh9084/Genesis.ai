import { ArrowRight, DollarSign, Sparkles, ShieldCheck, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function HeroSection() {

    return (
        <>
            <motion.div className="fixed inset-0 overflow-hidden -z-20 pointer-events-none"
                initial={{ opacity: 0.4 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                {/* <div className="absolute rounded-full top-80 left-2/5 -translate-x-1/2 size-130 bg-[#D10A8A] blur-[100px]" />
                <div className="absolute rounded-full top-80 right-0 -translate-x-1/2 size-130 bg-[#2E08CF] blur-[100px]" />
                <div className="absolute rounded-full top-0 left-1/2 -translate-x-1/2 size-130 bg-[#F26A06] blur-[100px]" /> */}
            </motion.div>
            <motion.section className="flex flex-col items-center px-4 pt-18 sm:pt-24 pb-8 page-entrance">
               
                <motion.div className="flex items-center gap-3 mt-24"
                    initial={{ y: -20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    <p className="section-kicker">Genesis 3.0</p>
                    <Link to="/register" className="btn-secondary py-1 px-3 text-xs">
                        Launch App
                    </Link>
                </motion.div>
                <motion.h1 className="text-center text-4xl/13 md:text-6xl/19 mt-6 font-semibold tracking-tight max-w-5xl font-[var(--font-display)]"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 240, damping: 70, mass: 1 }}
                >
                    Turn an idea into a startup-grade product system with AI CTO, code generation, analytics, and deployment in one place.
                </motion.h1>
                <motion.p className="text-center text-gray-300 text-base/7 max-w-3xl mt-6"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    Genesis 3.0 combines a premium SaaS interface with an AI startup operating system for product planning, engineering, QA, security, marketing, and business decisions.
                </motion.p>

                <motion.div className="flex flex-col md:flex-row max-md:w-full items-center gap-4 md:gap-3 mt-8"
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                >
                    <Link to="/register" className="btn-primary max-md:w-full py-3 text-center inline-flex items-center justify-center gap-2">
                        Get Started Free
                        <ArrowRight className="size-4.5" />
                    </Link>
                    <Link to="/plans" className="btn-secondary max-md:w-full flex items-center justify-center gap-2 py-3">
                        <DollarSign className="size-4.5" />
                        View Plans
                    </Link>
                </motion.div>
                <motion.div
                    className="mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3"
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 40, mass: 0.9 }}
                >
                    {[
                        { icon: Sparkles, title: "AI CTO", text: "Analyze startup ideas and get architecture, roadmap, and risk analysis." },
                        { icon: ShieldCheck, title: "Production-ready", text: "Security, deployments, and account workflows are built for real usage." },
                        { icon: Cpu, title: "Unified workspace", text: "Plan, generate, preview, and launch from a single premium interface." },
                    ].map((item) => (
                        <div key={item.title} className="surface p-5 text-left">
                            <item.icon className="h-5 w-5 text-orange-300" />
                            <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                            <p className="mt-2 text-sm leading-7 text-gray-300">{item.text}</p>
                        </div>
                    ))}
                </motion.div>
                    {/* <div className="w-3/4 py-2.5 font-medium text-sm text-center mt-5 text-gray-700 hover:text-gray-500 duration-300 transition-all">
                        This application is in development. The developer is actively working <br /> to improve features, performance, and stability.
                    </div> */}
            </motion.section>
        </>
    );
}