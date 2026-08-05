"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WaitlistModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    businessType: "",
    phone: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        setLoading(false);

        setForm({
          fullName: "",
          email: "",
          businessType: "",
          phone: "",
        });

        onSuccess();
      } else {
        setLoading(false);
        alert(data.message || "Something went wrong.");
      }
    } catch (error) {
      setLoading(false);
      alert("Unable to join waitlist.");
      console.error(error);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.9,
              y: 20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
            }}
            transition={{
              duration: 0.25,
            }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-5 top-5 rounded-full p-2 hover:bg-gray-100"
            >
              <X size={20} />
            </button>

            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                🚀
              </div>

              <h2 className="text-3xl font-bold">
                Join the Waitlist
              </h2>

              <p className="mt-3 text-gray-600">
                Be among the first businesses to experience
                MySales before launch.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                required
                value={form.fullName}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-green-600"
              />

              <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-green-600"
              />

              <select
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-green-600"
              >
                <option value="">
                  Select Business Type
                </option>

                <option>Supermarket</option>
                <option>Restaurant</option>
                <option>Pharmacy</option>
                <option>Boutique</option>
                <option>Electronics Store</option>
                <option>Wholesale</option>
                <option>Hotel</option>
                <option>School</option>
                <option>Other</option>
              </select>

              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={form.phone}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-green-600"
              />

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E9F6E] py-4 text-lg font-semibold text-white transition hover:bg-[#0B8A5F] disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={20}
                    />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              No spam. We'll only email you when MySales launches.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}