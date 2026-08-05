"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

interface Props {
  name: string;
  role: string;
  company: string;
  review: string;
}

export default function TestimonialCard({
  name,
  role,
  company,
  review,
}: Props) {
  return (
    <motion.div
      whileHover={{
        y: -8,
      }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl"
    >
      <Quote className="text-[#0E9F6E]" size={36} />

      <p className="mt-6 text-gray-600 leading-8">
        "{review}"
      </p>

      <div className="mt-8 flex items-center gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-[#0E9F6E]">
          {name.charAt(0)}
        </div>

        <div>

          <h3 className="font-semibold">
            {name}
          </h3>

          <p className="text-sm text-gray-500">
            {role}
          </p>

          <p className="text-sm text-[#0E9F6E]">
            {company}
          </p>

        </div>

      </div>

    </motion.div>
  );
}