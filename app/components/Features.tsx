"use client";

import Section from "./ui/Section";

import FeatureCard from "./FeatureCard";

import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Wallet,
  ScanBarcode,
} from "lucide-react";

const features = [
  {
    icon: ShoppingCart,
    title: "Smart POS",
    description:
      "Fast checkout with barcode scanning, receipts, discounts, returns, and multiple payment methods.",
  },
  {
    icon: Package,
    title: "Inventory",
    description:
      "Track stock in real time, receive low-stock alerts, and manage warehouses with ease.",
  },
  {
    icon: Wallet,
    title: "Accounting",
    description:
      "Automatically record income, expenses, profits, and generate financial reports.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    description:
      "Manage customer profiles, loyalty points, debts, and purchase history.",
  },
  {
    icon: BarChart3,
    title: "Business Analytics",
    description:
      "Visual dashboards showing sales, profits, expenses, best-selling products, and trends.",
  },
  {
    icon: ScanBarcode,
    title: "Barcode & QR",
    description:
      "Generate and scan barcodes and QR codes directly from the application.",
  },
];

export default function Features() {
  return (
    <Section>

      <div id="features" className="text-center">

        <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-[#0E9F6E]">
          FEATURES
        </span>

        <h2 className="mt-6 text-5xl font-bold">
          Everything your business needs
        </h2>

        <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600">
          MySales combines inventory management, POS, accounting,
          CRM, reports, and analytics into one modern platform.
        </p>

      </div>

      <div className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-3">

        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            {...feature}
          />
        ))}

      </div>

    </Section>
  );
}