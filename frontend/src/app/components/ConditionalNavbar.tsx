"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NavbarComponent from "./Navbar";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include", // ✅ CRÍTICO: Incluir cookies
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error al obtener el usuario:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [pathname]);

  // Solo ocultar navbar en páginas de login y register
  const hiddenPaths = ["/login", "/register"];

  // Si está en una página oculta, no mostrar navbar
  if (pathname && hiddenPaths.includes(pathname)) {
    return null;
  }

  return (
    <>
      <NavbarComponent user={user} loading={loading} />
      <div className="h-16" /> {/* Spacer para la navbar fija */}
    </>
  );
}
