"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AuthStatusProps {
  user: {
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function AuthStatus({ user }: AuthStatusProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      // Limpiar datos del cliente primero
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Usar el endpoint GET /logout para server-side logout
      window.location.href = "/logout";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);

      // En caso de error, aún así limpiar y redirigir
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
      }
    }
  };

  useEffect(() => {
    // Verificar cookies del navegador
    console.log("🍪 Todas las cookies:", document.cookie);

    // Verificar si la cookie auth existe
    const authCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth="));

    console.log("🔑 Cookie de auth:", authCookie);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <Link href="/login">Iniciar Sesión</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/register">Registrarse</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {user.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="hidden md:block">
          <Badge
            variant={user.role === "SUPERADMIN" ? "destructive" : "default"}
          >
            {user.role}
          </Badge>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "..." : "Cerrar Sesión"}
      </Button>
    </div>
  );
}
