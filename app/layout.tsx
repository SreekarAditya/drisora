import type { Metadata } from "next"
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import "leaflet/dist/leaflet.css"
import "./globals.css"

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--heading-font",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--sans-font",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--mono-font",
})

export const metadata: Metadata = {
  title: "Drisora — Road Condition Assessment",
  description: "Automated IRC:82-2023 compliant road condition assessment from drone footage. PCI scoring, geospatial maps, and PDF reports.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
