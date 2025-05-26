import Link from "next/link";
import { redirect } from "next/navigation";
import { getTokenPayload } from "@/lib/auth";

export default async function Home() {
  // Verificar si el usuario está autenticado y redirigir a /admin
  const user = await getTokenPayload();
  if (user) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-green-600 mb-4">
            Control-X
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Tu plataforma para gestionar cuentas de X
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mr-4"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Registrarse
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Botón de Cuentas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-800 dark:text-white mb-2">
              Gestionar Cuentas
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
              Administra y organiza todas tus cuentas de X en un solo lugar
            </p>
          </div>

          {/* Botón de Tweets */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-800 dark:text-white mb-2">
              Publicar Tweets
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
              Crea y programa tweets para todas tus cuentas
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Versión 2.0 • Desarrollado con ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
