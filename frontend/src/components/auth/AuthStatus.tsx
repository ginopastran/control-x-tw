"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";

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

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          as={Link}
          href="/login"
          color="primary"
          variant="flat"
          size="sm"
        >
          Iniciar Sesión
        </Button>
        <Button
          as={Link}
          href="/register"
          color="primary"
          variant="light"
          size="sm"
        >
          Registrarse
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
          {user.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="hidden md:block">
          <span
            className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
              user.role === "SUPERADMIN"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {user.role}
          </span>
        </div>
      </div>
      <Button
        color="danger"
        variant="light"
        size="sm"
        onClick={handleLogout}
        isDisabled={isLoggingOut}
      >
        {isLoggingOut ? "..." : "Cerrar Sesión"}
      </Button>
    </div>
  );
}
