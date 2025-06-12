"use client";

import { useEffect } from "react";
import { useLogout } from "@/hooks/useLogout";

export default function LogoutPage() {
  const { logout } = useLogout();

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center p-8 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Cerrando sesión...
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Por favor espera mientras procesamos tu solicitud
          </p>
        </div>
      </div>
    </div>
  );
}
