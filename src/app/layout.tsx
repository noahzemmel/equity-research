import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Equity Research Co-Pilot",
  description: "Local-first AI equity research, paper trading, and risk analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
          <Disclaimer />
        </div>
      </body>
    </html>
  );
}
