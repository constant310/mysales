"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface BusinessCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function BusinessCard({
  icon: Icon,
  title,
  description,
}: BusinessCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
        <Icon className="h-8 w-8 text-[#0E9F6E]" />
      </div>

      <h3 className="mt-6 text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-4 text-gray-600 leading-7">
        {description}
      </p>
    </motion.div>
  );
}