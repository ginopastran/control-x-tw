import Link from "next/link";
import { redirect } from "next/navigation";
import { getTokenPayload } from "@/lib/auth";
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Divider,
} from "@heroui/react";

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
          <Button
            as={Link}
            href="/login"
            color="primary"
            size="lg"
            className="mr-4"
          >
            Iniciar Sesión
          </Button>
          <Button
            as={Link}
            href="/register"
            color="default"
            variant="flat"
            size="lg"
          >
            Registrarse
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Tarjeta de Cuentas */}
          <Card className="shadow-md">
            <CardHeader className="flex flex-col items-center pb-0">
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
            </CardHeader>
            <CardBody className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Gestionar Cuentas
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Administra y organiza todas tus cuentas de X en un solo lugar
              </p>
            </CardBody>
          </Card>

          {/* Tarjeta de Tweets */}
          <Card className="shadow-md">
            <CardHeader className="flex flex-col items-center pb-0">
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
            </CardHeader>
            <CardBody className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Publicar Tweets
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Crea y programa tweets para todas tus cuentas
              </p>
            </CardBody>
          </Card>
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
