"use client";

import { motion } from "framer-motion";
import {
  Check,
  ShieldCheck,
  Zap,
  Headphones,
} from "lucide-react";

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-gradient-to-b from-green-50 to-white py-28"
    >
      <div className="container">

        <div className="text-center">

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-[#0E9F6E]">
            PRICING
          </span>

          <h2 className="mt-6 text-5xl font-bold">
            Affordable for every business
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600">
            Start free during our early access.
            Upgrade only when you're ready to grow.
          </p>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: .7 }}
          viewport={{ once: true }}
          className="mx-auto mt-20 max-w-5xl rounded-[40px] bg-white shadow-2xl overflow-hidden lg:grid lg:grid-cols-2"
        >

          {/* Left */}

          <div className="p-12">

            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-[#0E9F6E]">

              EARLY ACCESS

            </span>

            <h3 className="mt-6 text-4xl font-bold">

              Free

            </h3>

            <p className="mt-2 text-gray-500">

              while we're in beta

            </p>

            <div className="mt-10 space-y-5">

              {[
                "Unlimited Sales",
                "Inventory Management",
                "POS System",
                "Barcode Scanning",
                "Reports & Analytics",
                "Customer Management",
                "Staff Management",
                "Cloud Backup"
              ].map((feature) => (

                <div
                  key={feature}
                  className="flex items-center gap-3"
                >

                  <Check
                    className="text-green-600"
                    size={20}
                  />

                  <span>{feature}</span>

                </div>

              ))}

            </div>

          </div>

          {/* Right */}

          <div className="bg-[#0E9F6E] text-white p-12 flex flex-col justify-between">

            <div>

              <h3 className="text-4xl font-bold">

                Join the Waitlist

              </h3>

              <p className="mt-6 text-green-100 leading-8">

                Be among the first businesses
                to experience MySales before
                public launch.

              </p>

            </div>

            <div className="space-y-6 mt-12">

              <div className="flex items-center gap-4">

                <ShieldCheck />

                <span>

                  Secure Cloud Storage

                </span>

              </div>

              <div className="flex items-center gap-4">

                <Zap />

                <span>

                  Early Access Features

                </span>

              </div>

              <div className="flex items-center gap-4">

                <Headphones />

                <span>

                  Priority Support

                </span>

              </div>

            </div>

            <button
              className="mt-12 rounded-2xl bg-white text-[#0E9F6E] py-4 font-bold text-lg hover:scale-105 transition"
            >

              Join Waitlist

            </button>

          </div>

        </motion.div>

      </div>

    </section>
  );
}