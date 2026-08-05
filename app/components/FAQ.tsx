"use client";

import FAQItem from "./FAQItem";

const faqs = [
  {
    question: "When will MySales launch?",
    answer:
      "We're currently in early access. Join the waitlist and you'll be among the first to receive an invitation.",
  },
  {
    question: "Is MySales free?",
    answer:
      "Yes. Early access users will enjoy free access during the beta period.",
  },
  {
    question: "Can I use MySales offline?",
    answer:
      "Yes. MySales supports offline sales and automatically syncs your data when you're back online.",
  },
  {
    question: "Does it support multiple branches?",
    answer:
      "Absolutely. You can manage multiple branches, staff, inventory, and reports from one dashboard.",
  },
  {
    question: "Which businesses can use MySales?",
    answer:
      "Supermarkets, pharmacies, restaurants, boutiques, wholesalers, electronics stores, schools, hotels, and many more.",
  },
];

export default function FAQ() {
  return (
    <section className="py-28 bg-gray-50">

      <div className="container max-w-4xl">

        <div className="text-center">

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-[#0E9F6E]">
            FAQ
          </span>

          <h2 className="mt-6 text-5xl font-bold">
            Frequently Asked Questions
          </h2>

          <p className="mt-6 text-lg text-gray-600">
            Everything you need to know before joining the waitlist.
          </p>

        </div>

        <div className="mt-16 space-y-5">

          {faqs.map((faq) => (
            <FAQItem
              key={faq.question}
              {...faq}
            />
          ))}

        </div>

      </div>

    </section>
  );
}