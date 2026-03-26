import React from "react";
import { motion } from "framer-motion";

const Genesis = () => {
  return (
    <div>
      <motion.div
        className="relative"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl h-full max-h-24 hover:bg-slate-100 rounded-full blur-[100px] pointer-events-none" />
        <h1 className="text-4xl text-[clamp(1rem,22vw,21rem)] text-center font-extrabold leading-[0.7] text-transparent md:text-[clamp(2rem,24vw,21rem)] [-webkit-text-stroke:5px_#D4D4D4] mt-44">
          Genesis
        </h1>
      </motion.div>
    </div>
  );
};

export default Genesis;
