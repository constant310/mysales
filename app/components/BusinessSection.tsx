"use client";

import {
  ShoppingBag,
  Pill,
  Store,
  UtensilsCrossed,
  Shirt,
  Hotel,
  GraduationCap,
  Warehouse,
} from "lucide-react";

import Section from "./ui/Section";
import BusinessCard from "./BusinessCard";

const businesses = [
  {
    icon: Store,
    title: "Supermarkets",
    description:
      "Manage inventory, checkout, suppliers, and customer loyalty in one system.",
  },
  {
    icon: Pill,
    title: "Pharmacies",
    description:
      "Track medicine stock, expiry dates, prescriptions, and sales.",
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants",
    description:
      "Handle orders, kitchen workflow, tables, and daily sales reports.",
  },
  {
    icon: Shirt,
    title: "Fashion Stores",
    description:
      "Manage sizes, colours, inventory, customers, and sales effortlessly.",
  },
  {
    icon: Warehouse,
    title: "Wholesalers",
    description:
      "Track bulk inventory, invoices, suppliers, and warehouse stock.",
  },
  {
    icon: Hotel,
    title: "Hotels",
    description:
      "Manage rooms, bookings, payments, guests, and housekeeping.",
  },
  {
    icon: GraduationCap,
    title: "Schools",
    description:
      "Manage fees, students, attendance, staff, and financial reports.",
  },
  {
    icon: ShoppingBag,
    title: "General Retail",
    description:
      "Perfect for electronics, cosmetics, mobile stores, and many more.",
  },
];

export default function BusinessSection() {
  return (
    <Section>
      <div id="businesses" className="text-center">

        <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-[#0E9F6E]">
          BUSINESS TYPES
        </span>

        <h2 className="mt-6 text-5xl font-bold">
          Built for every business
        </h2>

        <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600">
          Whether you run a supermarket, pharmacy, restaurant,
          boutique, or wholesale business, MySales adapts to
          your workflow.
        </p>

      </div>

      <div className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {businesses.map((business) => (
          <BusinessCard
            key={business.title}
            {...business}
          />
        ))}
      </div>
    </Section>
  );
}