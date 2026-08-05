"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItemProps {
  question: string;
  answer: string;
}

export default function FAQItem({
  question,
  answer,
}: FAQItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <h3 className="font-semibold text-lg">
          {question}
        </h3>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
        >
          <ChevronDown />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-gray-600 leading-7">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}