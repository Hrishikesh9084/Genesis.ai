import React from "react";
import HeroSection from "./hero-section";
import TrustedCompanies from "./trusted-companies";
import Features from "./features";
import WorkflowSteps from "./workflow-steps";
import Testimonials from "./testimonials";
import FaqSection from "./faq-section";
import PricingPlans from "./pricing-plans";
import CallToAction from "./call-to-action";
import Genesis from "../components/Genesis";

const Home = () => {
  return (
    <div>
      <HeroSection />
      <TrustedCompanies />
      {/* <Features /> */}
      {/* <WorkflowSteps /> */}
      <Testimonials />
      <FaqSection />
      <PricingPlans />
      <CallToAction />
      <Genesis />
    </div>
  );
};

export default Home;
