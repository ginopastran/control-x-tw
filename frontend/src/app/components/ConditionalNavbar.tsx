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
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Error al obtener el usuario:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // No mostrar navbar en páginas de login, register o página de inicio
  const hiddenPaths = ["/login", "/register", "/"];

  // Si está cargando, no renderizar nada
  if (loading) {
    return null;
  }

  // Si no hay usuario o está en una página oculta, no mostrar navbar
  if (!user || !pathname || hiddenPaths.includes(pathname)) {
    return null;
  }

  return (
    <div className="pt-20">
      <NavbarComponent />
    </div>
  );
}
