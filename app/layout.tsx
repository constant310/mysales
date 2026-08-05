import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MySales - Modern ERP & POS for African Businesses",

  description:
    "Manage sales, inventory, customers, accounting, and reports in one simple platform. Built for African businesses.",

  keywords: [
    "ERP Nigeria",
    "POS Nigeria",
    "Inventory Management",
    "Business Software",
    "Retail Software",
    "Accounting Software",
    "MySales",
    "ERP Africa",
  ],

  authors: [
    {
      name: "MySales",
    },
  ],

  creator: "MySales",

  metadataBase: new URL("https://mysales.africa"),

  openGraph: {
    title: "MySales",

    description:
      "The modern ERP and POS platform built for African businesses.",

    url: "https://mysales.africa",

    siteName: "MySales",

    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],

    locale: "en_US",

    type: "website",
  },

  twitter: {
    card: "summary_large_image",

    title: "MySales",

    description:
      "ERP & POS for African businesses.",

    images: ["/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}