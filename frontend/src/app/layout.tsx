import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import ConditionalNavbar from "./components/ConditionalNavbar";
import BackgroundGradient from "@/components/ui/BackgroundGradient";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control X",
  description: "Control X - Twitter Automation Tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className}`}>
        <Providers>
          <BackgroundGradient>
            <ConditionalNavbar />
            <main className="min-h-screen">{children}</main>
          </BackgroundGradient>
        </Providers>
      </body>
    </html>
  );
}
