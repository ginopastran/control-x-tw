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

      // 2. Limpiar el caché del router
      router.refresh();

      // 3. Pequeña pausa para asegurar que el refresh se complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 4. Redirigir al login usando replace para no poder volver atrás
      router.replace("/login");
    } catch (error) {
      console.error("Error durante logout:", error);

      // Incluso si hay error, limpiar caché y redirigir
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.replace("/login");
    }
  }, [router]);

  return { logout };
}
