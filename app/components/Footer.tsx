"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
} from "react-icons/fa6";

export default function Footer() {
  return (
    <footer
      id="footer"
      className="bg-[#101828] text-gray-300 pt-20 pb-10"
    >
      <div className="container mx-auto px-6">
        {/* Top Section */}
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Company */}
          <div>
            <h2 className="text-3xl font-bold text-white">
              MySales
            </h2>

            <p className="mt-5 leading-8 text-gray-400">
              Modern ERP & POS software built for African businesses.
              Manage sales, inventory, customers, accounting and reports
              from one platform.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-6 text-lg font-semibold text-white">
              Product
            </h3>

            <ul className="space-y-4">
              <li>
                <Link
                  href="#features"
                  className="hover:text-white transition"
                >
                  Features
                </Link>
              </li>

              <li>
                <Link
                  href="#businesses"
                  className="hover:text-white transition"
                >
                  Business Types
                </Link>
              </li>

              <li>
                <Link
                  href="#pricing"
                  className="hover:text-white transition"
                >
                  Pricing
                </Link>
              </li>

              <li>
                <Link
                  href="#faq"
                  className="hover:text-white transition"
                >
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-6 text-lg font-semibold text-white">
              Resources
            </h3>

            <ul className="space-y-4">
              <li>
                <Link
                  href="#"
                  className="hover:text-white transition"
                >
                  Documentation
                </Link>
              </li>

              <li>
                <Link
                  href="#"
                  className="hover:text-white transition"
                >
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link
                  href="#"
                  className="hover:text-white transition"
                >
                  Terms of Service
                </Link>
              </li>

              <li>
                <Link
                  href="#"
                  className="hover:text-white transition"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-6 text-lg font-semibold text-white">
              Contact
            </h3>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Mail className="text-green-400" size={18} />
                <span>hello@mysales.africa</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="text-green-400" size={18} />
                <span>+234 800 000 0000</span>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="mt-1 text-green-400" size={18} />
                <span>
                  Warri,
                  <br />
                  Delta State,
                  <br />
                  Nigeria.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 border-t border-gray-700"></div>

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} MySales. All rights reserved.
          </p>

          <div className="flex items-center gap-6 text-2xl">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-green-400"
            >
              <FaFacebook />
            </a>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-green-400"
            >
              <FaInstagram />
            </a>

            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-green-400"
            >
              <FaXTwitter />
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-green-400"
            >
              <FaLinkedin />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}