import SectionTitle from "../components/section-title";
import { BotIcon, BrainIcon, ShieldCheck, Sparkles, ZapIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useRef } from "react";

export default function Features() {

    const refs = useRef([]);

    const featuresData = [
        {
            icon: BotIcon,
            title: "AI CTO",
            description: "Analyze startup ideas, recommend architecture, and shape an MVP plan.",
        },
        {
            icon: BrainIcon,
            title: "Project Brain",
            description: "Keep architecture, stack choices, and business context aligned across projects.",
        },
        {
            icon: ZapIcon,
            title: "Real-time Execution",
            description: "Generate, preview, analyze, and deploy through live async workflows.",
        },
        {
            icon: ShieldCheck,
            title: "Security & QA",
            description: "Surface security risks and test gaps before a project goes live.",
        },
        {
            icon: Sparkles,
            title: "Premium SaaS UI",
            description: "A dark, glassmorphic interface with modern dashboards and polished motion.",
        }
    ];

    return (
        <section className="mt-28">
            <SectionTitle
                title="Genesis features"
                description="A startup operating system where AI helps you plan, build, secure, and grow software products."
            />

            <div className="mt-10 grid gap-5 px-4 sm:px-6 md:grid-cols-2">
                {featuresData.map((feature, index) => (
                    <motion.div
                        key={index}
                        ref={(el) => (refs.current[index] = el)}
                        className="surface p-6 space-y-4 hover:-translate-y-1 transition-transform duration-300"
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{
                            delay: index * 0.15,
                            type: "spring",
                            stiffness: 320,
                            damping: 70,
                            mass: 1
                        }}
                        onAnimationComplete={() => {
                            const card = refs.current[index];
                            if (card) {
                                card.classList.add("transition", "duration-300");
                            }
                        }}
                    >
                        <feature.icon className="size-8.5 text-orange-300" />
                        <h3 className="text-base font-medium text-white">
                            {feature.title}
                        </h3>
                        <p className="text-gray-300 line-clamp-2 pb-2">
                            {feature.description}
                        </p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
