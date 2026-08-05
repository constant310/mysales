"use client";

import { CheckCircle2, Mail, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ThankYouModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ThankYouModal({
  open,
  onClose,
}: ThankYouModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
          >
            {/* Success Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>

            {/* Title */}
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              You're on the list! 🎉
            </h2>

            {/* Description */}
            <p className="mt-4 text-center text-gray-600 leading-7">
              Thank you for joining the <strong>MySales</strong> waitlist.
              You're among the first businesses that will get access when we
              launch.
            </p>

            {/* What's Next */}
            <div className="mt-8 rounded-2xl bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 text-green-600" />

                <div>
                  <h3 className="font-semibold">
                    What happens next?
                  </h3>

                  <p className="mt-2 text-sm text-gray-600">
                    We'll send you an email as soon as MySales launches,
                    including early access, exclusive offers, and product
                    updates.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 text-green-600" />

                <p className="text-sm text-gray-600">
                  As an early supporter, you'll receive priority onboarding and
                  special launch pricing.
                </p>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={onClose}
              className="mt-8 w-full rounded-xl bg-[#0E9F6E] py-4 text-lg font-semibold text-white transition hover:bg-[#0b8a5f]"
            >
              Continue Exploring
            </button>

            <p className="mt-5 text-center text-sm text-gray-500">
              We can't wait to help you grow your business.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}