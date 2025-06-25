"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useLogout() {
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      // 1. Llamar a la API de logout
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // 2. Limpiar localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }

      // 3. Limpiar el caché del router
      router.refresh();

      // 4. Pequeña pausa para asegurar que el refresh se complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 5. Redirigir al login usando replace para no poder volver atrás
      router.replace("/login");
    } catch (error) {
      console.error("Error durante logout:", error);

      // Incluso si hay error, limpiar localStorage y cache, después redirigir
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.replace("/login");
    }
  }, [router]);

  return { logout };
}
