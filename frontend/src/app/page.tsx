import { redirect } from "next/navigation";
import { getTokenPayload } from "@/lib/auth";

export default async function Home() {
  // Verificar si el usuario está autenticado
  const user = await getTokenPayload();

  if (user) {
    // Si está autenticado, redirigir a dashboard
    redirect("/dashboard");
  } else {
    // Si no está autenticado, redirigir a login
    redirect("/login");
  }
}
