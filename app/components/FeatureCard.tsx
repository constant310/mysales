"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -8,
        scale: 1.02,
      }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl"
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
        <Icon className="h-7 w-7 text-[#0E9F6E]" />
      </div>

      <h3 className="text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-4 text-gray-600 leading-7">
        {description}
      </p>
    </motion.div>
  );
}