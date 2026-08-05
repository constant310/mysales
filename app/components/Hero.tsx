"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

import Button from "./ui/Button";
import FloatingCard from "./FloatingCard";
import WaitlistModal from "./WaitlistModal";
import ThankYouModal from "./ThankYouModal";

export default function Hero() {
  // Modal state
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [thankYouOpen, setThankYouOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden pt-36 pb-24">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-60 top-0 h-[700px] w-[700px] rounded-full bg-green-100 blur-[150px]" />
          <div className="absolute -right-60 bottom-0 h-[600px] w-[600px] rounded-full bg-emerald-100 blur-[150px]" />
        </div>

        <div className="container mx-auto px-6">
          <div className="grid items-center gap-20 lg:grid-cols-2">

            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                🚀 Launching Soon
              </div>

              <h1 className="mt-8 text-5xl font-extrabold leading-tight lg:text-7xl">
                Manage your{" "}
                <span className="text-[#0E9F6E]">
                  business
                </span>{" "}
                in one place.
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-gray-600">
                MySales helps retailers, supermarkets,
                pharmacies, restaurants and wholesalers
                manage inventory, POS, staff, customers,
                reports and accounting from one platform.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
               <Button
  onClick={() => {
    console.log("Opening modal");
    setJoinOpen(true);
  }}
>
  Join Waitlist
</Button>

                <Button className="border border-gray-300 bg-white text-black hover:bg-gray-100">
                  Watch Demo
                </Button>
              </div>

              <div className="mt-10 flex gap-10">
                <div>
                  <h2 className="text-3xl font-bold">2000+</h2>
                  <p className="text-gray-500">Businesses</p>
                </div>

                <div>
                  <h2 className="text-3xl font-bold">25+</h2>
                  <p className="text-gray-500">Industries</p>
                </div>

                <div>
                  <h2 className="text-3xl font-bold">99%</h2>
                  <p className="text-gray-500">Easier Management</p>
                </div>
              </div>
            </motion.div>

            {/* Right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, -10, 0],
              }}
              transition={{
                duration: 1,
                y: {
                  repeat: Infinity,
                  duration: 4,
                },
              }}
              className="relative flex justify-center"
            >
              <FloatingCard
                title="Today's Sales"
                amount="₦1,245,500"
                className="absolute left-0 top-10"
              />

              <FloatingCard
                title="Inventory"
                amount="1,240 Items"
                className="absolute right-0 top-36"
              />

              <FloatingCard
                title="Profit"
                amount="+₦420,000"
                className="absolute bottom-16 left-10"
              />

              <Image
                src="/phone.png"
                alt="Phone"
                width={420}
                height={820}
                priority
              />
            </motion.div>

          </div>
        </div>
      </section>

      {/* Waitlist Modal */}
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        onSuccess={() => {
          setWaitlistOpen(false);
          setThankYouOpen(true);
        }}
      />

      {/* Thank You Modal */}
      <ThankYouModal
        open={thankYouOpen}
        onClose={() => setThankYouOpen(false)}
      />
    </>
  );
}