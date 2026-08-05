"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Button from "./ui/Button";
import MobileMenu from "./MobileMenu";

const navLinks = [
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

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0E9F6E] text-white font-bold text-lg">
              M
            </div>

            <div>
              <h1 className="text-lg font-bold text-[#101828]">
                MySales
              </h1>

              <p className="text-xs text-gray-500">
                ERP & POS
              </p>
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 hover:text-[#0E9F6E] transition font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop Button */}
          <div className="hidden lg:block">
            <Button>
              Join Waitlist
            </Button>
          </div>

          {/* Mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
          >
            <Menu size={28} />
          </button>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        close={() => setMobileOpen(false)}
      />
    </>
  );
}