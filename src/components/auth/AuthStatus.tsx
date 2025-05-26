"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error al cerrar sesión");
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <Link href="/login" className="text-blue-600 hover:text-blue-800">
          Iniciar Sesión
        </Link>
        <span className="text-gray-400">|</span>
        <Link href="/register" className="text-blue-600 hover:text-blue-800">
          Registrarse
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm text-gray-700">
        <span className="font-medium">{user.name}</span>
        <span className="text-xs ml-1 text-gray-500">({user.role})</span>
      </div>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-70"
      >
        {isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
      </button>
    </div>
  );
}
