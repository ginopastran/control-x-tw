import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavbarComponent from "./components/Navbar";
import { HeroUIProvider } from "@heroui/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control-X",
  description: "Gestiona tus cuentas de X",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${inter.className} dark min-h-screen bg-gray-50 dark:bg-gray-900`}
      >
        <HeroUIProvider>
          <NavbarComponent />
          <main className="pt-20 min-h-screen">{children}</main>
        </HeroUIProvider>
      </body>
    </html>
  );
}
