import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drisora — Road Condition Assessment",
  description: "Automated IRC:82-2023 compliant road condition assessment from drone footage. PCI scoring, geospatial maps, and PDF reports.",
  icons: {
    icon: "/icon",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
