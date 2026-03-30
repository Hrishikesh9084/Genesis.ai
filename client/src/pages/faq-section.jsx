import SectionTitle from '../components/section-title';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { motion } from "framer-motion";

export default function FaqSection() {
    const [isOpen, setIsOpen] = useState(null);
    const data = [
        {
            question: 'What is Genesis.ai and what can I build with it?',
            answer: 'Genesis.ai helps you generate, edit, preview, and deploy full-stack projects from a prompt. You can build apps with a frontend and backend, then push code to GitHub and deploy to supported platforms.',
        },
        {
            question: 'Do I need coding experience to use Genesis.ai?',
            answer: 'No, you can start with plain-language prompts. Basic coding knowledge helps when customizing generated files, but the platform is designed for both technical and non-technical users.',
        },
        {
            question: 'Why do I need to accept Terms and Conditions on login/register?',
            answer: 'Acceptance is required to continue. It confirms you agree to the platform rules, privacy practices, and acceptable-use requirements before creating or accessing an account.',
        },
        {
            question: 'Where can I read the Privacy Policy and Terms of Service?',
            answer: 'You can open them any time from the footer or directly at /privacy-policy and /terms-of-service.',
        },
        {
            question: 'Can I connect GitHub and deploy my generated projects?',
            answer: 'Yes. After generation, you can push your project to GitHub and deploy to supported providers. Deployment status and logs are available in the project flow.',
        },
        {
            question: 'Is AI-generated code production-ready?',
            answer: 'Generated code can accelerate development, but you should always review, test, and secure it before production deployment.',
        },
    ];

    return (
        <section className='mt-32'>
            <SectionTitle title="FAQ's" description="Looking for answers to your frequently asked questions? Check out our FAQ's section below to find." />
            <div className='mx-auto mt-12 space-y-4 w-full max-w-xl'>
                {data.map((item, index) => (
                    <motion.div key={index} className='flex flex-col glass rounded-md'
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: `${index * 0.15}`, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                    >
                        <h3 className='flex cursor-pointer hover:bg-white/10 transition items-start justify-between gap-4 p-4 font-medium' onClick={() => setIsOpen(isOpen === index ? null : index)}>
                            {item.question}
                            <ChevronDownIcon className={`size-5 transition-all shrink-0 duration-400 ${isOpen === index ? 'rotate-180' : ''}`} />
                        </h3>
                        <p className={`px-4 text-sm/6 transition-all duration-400 overflow-hidden ${isOpen === index ? 'pt-2 pb-4 max-h-80' : 'max-h-0'}`}>{item.answer}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}