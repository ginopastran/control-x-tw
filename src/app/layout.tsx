import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import NavbarComponent from "./components/Navbar";

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
      <body className={`${inter.className} min-h-screen `}>
        <Providers>
          <NavbarComponent />
          <main className="pt-20 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
