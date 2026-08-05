"use client";

import { motion } from "framer-motion";
import TestimonialCard from "./TestimonialCard";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Retail Store Owner",
    company: "Sarah's Mart",
    review:
      "Managing inventory manually is exhausting. I'm excited to switch to MySales when it launches.",
  },
  {
    name: "David Okafor",
    role: "Pharmacy Manager",
    company: "HealthCare Pharmacy",
    review:
      "The inventory tracking and expiry-date features are exactly what our pharmacy needs.",
  },
  {
    name: "Grace Mensah",
    role: "Restaurant Owner",
    company: "Taste Kitchen",
    review:
      "I've tried several POS systems. MySales looks much more complete for African businesses.",
  },
];

const stats = [
  {
    value: "2,000+",
    label: "Businesses Interested",
  },
  {
    value: "8",
    label: "Business Categories",
  },
  {
    value: "99%",
    label: "Cloud Uptime Goal",
  },
  {
    value: "24/7",
    label: "Support",
  },
];

export default function Testimonials() {
  return (
    <section className="py-28 bg-gray-50">

      <div className="container">

        <div className="text-center">

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-[#0E9F6E]">
            TRUSTED
          </span>

          <h2 className="mt-6 text-5xl font-bold">
            Built for growing African businesses
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600">
            Businesses are already joining the waitlist to get
            early access to MySales.
          </p>

        </div>

        <div className="mt-16 grid grid-cols-2 gap-8 lg:grid-cols-4">

          {stats.map((item) => (

            <motion.div

              key={item.label}

              whileHover={{ scale: 1.05 }}

              className="rounded-3xl bg-white p-8 text-center shadow"

            >

              <h3 className="text-5xl font-bold text-[#0E9F6E]">

                {item.value}

              </h3>

              <p className="mt-3 text-gray-600">

                {item.label}

              </p>

            </motion.div>

          ))}

        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-3">

          {testimonials.map((testimonial) => (

            <TestimonialCard

              key={testimonial.name}

              {...testimonial}

            />

          ))}

        </div>

      </div>

    </section>
  );
}