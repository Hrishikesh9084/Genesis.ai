import SectionTitle from "../components/section-title";
import { CheckIcon, CrownIcon, Loader2, RocketIcon, ZapIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PricingPlans() {
    const ref = useRef([]);
    const [buyingPlanId, setBuyingPlanId] = useState("");
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    const data = [
        {
            id: "starter",
            icon: RocketIcon,
            title: 'Starter',
            description: 'For individuals and small teams',
            price: 'Rs 199',
            credits: 15,
            buttonText: 'Buy Credits',
            features: [
                '15 project-generation credits',
                '1 credit consumed per generate/edit',
                'Access all stack templates',
                'Fast checkout with Razorpay',
                'Credit balance shown in account',
                'Email support'
            ],
        },
        {
            id: "professional",
            icon: ZapIcon,
            title: 'Professional',
            description: 'For growing teams and startups',
            price: 'Rs 499',
            credits: 40,
            mostPopular: true,
            buttonText: 'Buy Credits',
            features: [
                '40 project-generation credits',
                'Best value for regular usage',
                'Access all AI model options',
                'Priority support',
                'Credit usage flexibility',
                'Razorpay secure checkout'
            ],
        },
        {
            id: "enterprise",
            icon: CrownIcon,
            title: 'Enterprise',
            description: 'For enterprises and agencies',
            price: 'Rs 1499',
            credits: 120,
            buttonText: 'Buy Credits',
            features: [
                '120 project-generation credits',
                'Designed for heavy usage',
                'No monthly lock-in',
                'Fast top-up workflow',
                'Priority SLA support',
                'Account-level credit pool'
            ],
        },
    ];

    const handleBuyCredits = async (plan) => {
        if (!user) {
            toast.error("Please login first to buy credits.");
            navigate("/login");
            return;
        }

        setBuyingPlanId(plan.id);
        try {
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                toast.error("Unable to load Razorpay checkout.");
                return;
            }

            const { data: orderData } = await api.post("/payments/order", { planId: plan.id });

            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Genesis AI",
                description: `${plan.title} - ${plan.credits} credits`,
                order_id: orderData.orderId,
                prefill: {
                    name: user?.name || "",
                    email: user?.email || "",
                },
                theme: {
                    color: "#f97316",
                },
                handler: async (response) => {
                    try {
                        const verifyRes = await api.post("/payments/verify", response);
                        await refreshUser();
                        toast.success(`Payment successful. Credits: ${verifyRes.data.credits}`);
                    } catch (err) {
                        toast.error(err.response?.data?.error || "Payment verification failed.");
                    } finally {
                        setBuyingPlanId("");
                    }
                },
                modal: {
                    ondismiss: () => setBuyingPlanId(""),
                },
            };

            const checkout = new window.Razorpay(options);
            checkout.open();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to start payment.");
            setBuyingPlanId("");
        }
    };

    return (
        <section className="mt-16">
            <SectionTitle
                title="Our Pricing Plans"
                description="A visual collection of our most recent works - each piece crafted with intention, emotion and style."
            />

            <div className='mt-12 flex flex-wrap items-center justify-center gap-6'>
                {data.map((item, index) => (
                    <motion.div key={index} className='group w-full max-w-80 glass p-6 rounded-xl hover:-translate-y-0.5'
                        initial={{ y: 150, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: `${index * 0.15}`, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                        ref={(el) => (ref.current[index] = el)}
                        onAnimationComplete={() => {
                            const card = ref.current[index];
                            if (card) {
                                card.classList.add("transition", "duration-300");
                            }
                        }}
                    >
                        <div className="flex items-center w-max ml-auto text-xs gap-2 glass rounded-full px-3 py-1">
                            <item.icon className='size-3.5' />
                            <span>{item.title}</span>
                        </div>
                        <h3 className='mt-4 text-2xl font-semibold'>
                            {item.price}
                        </h3>
                        <p className="text-sm text-orange-300 mt-1">{item.credits} credits</p>
                        <p className='text-gray-200 mt-3'>{item.description}</p>
                        <button
                            onClick={() => handleBuyCredits(item)}
                            disabled={buyingPlanId === item.id}
                            className={`mt-7 rounded-md w-full btn disabled:opacity-70 disabled:cursor-not-allowed ${item.mostPopular ? 'bg-orange-500 text-white' : 'glass'}`}
                        >
                            {buyingPlanId === item.id ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="size-4 animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                item.buttonText
                            )}
                        </button>
                        <div className='mt-6 flex flex-col'>
                            {item.features.map((feature, index) => (
                                <div key={index} className='flex items-center gap-2 py-2'>
                                    <div className='rounded-full glass border-0 p-1'>
                                        <CheckIcon className='size-3 text-white' strokeWidth={3} />
                                    </div>
                                    <p>{feature}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}