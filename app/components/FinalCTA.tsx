"use client";

import Button from "./ui/Button";

export default function FinalCTA() {
  return (
    <section className="py-24">

      <div className="container">

        <div className="rounded-[40px] bg-[#0E9F6E] p-14 text-center text-white">

          <h2 className="text-5xl font-bold">
            Ready to simplify your business?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-green-100">
            Join thousands of African businesses waiting
            for the smartest ERP & POS platform.
          </p>

          <Button className="mt-10 bg-white text-[#0E9F6E] hover:bg-gray-100">
            Join the Waitlist
          </Button>

        </div>

      </div>

    </section>
  );
}