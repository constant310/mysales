"use client";

import { X } from "lucide-react";
import Button from "./ui/Button";

const links = [
  {
    name: "Features",
    href: "#features",
  },
  {
    name: "Business Types",
    href: "#businesses",
  },
  {
    name: "Pricing",
    href: "#pricing",
  },
  {
    name: "Contact",
    href: "#footer",
  },
];

interface Props {
  open: boolean;
  close: () => void;
}

export default function MobileMenu({
  open,
  close,
}: Props) {
  return (
    <div
      className={`fixed inset-0 z-[60] transition-all duration-300 ${
        open
          ? "opacity-100 visible"
          : "opacity-0 invisible"
      }`}
    >
      {/* Overlay */}
      <div
        onClick={close}
        className="absolute inset-0 bg-black/40"
      />

      {/* Drawer */}
      <div
        className={`absolute right-0 top-0 h-full w-80 bg-white transition-transform duration-300 ${
          open
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-xl">
            MySales
          </h2>

          <button onClick={close}>
            <X size={28} />
          </button>
        </div>

        <nav className="flex flex-col p-6 gap-6">
          {links.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={close}
              className="text-lg font-medium text-gray-700 hover:text-[#0E9F6E]"
            >
              {item.name}
            </a>
          ))}

          <Button className="mt-6 w-full">
            Join Waitlist
          </Button>
        </nav>
      </div>
    </div>
  );
}