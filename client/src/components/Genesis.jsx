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
        <div className="absolute inset-x-0 bottom-0 mx-auto h-full max-h-32 w-full max-w-4xl rounded-full bg-orange-500/10 blur-[110px] pointer-events-none" />
        <h1 className="font-display mt-40 text-center text-[clamp(4rem,22vw,16rem)] font-semibold leading-[0.8] tracking-tight text-transparent md:text-[clamp(5rem,23vw,18rem)] [-webkit-text-stroke:5px_#fff]">
          Genesis
        </h1>
      </motion.div>
    </div>
  );
};

export default Genesis;
