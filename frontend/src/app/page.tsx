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
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-green-600 mb-4">
            Control-X
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
            Tu plataforma para gestionar cuentas de X
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Acceso Restringido - Solo Usuarios Autorizados
          </div>
        </div>

        {/* Información sobre el acceso restringido */}
        <Card className="mb-8 border-l-4 border-l-orange-500">
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-orange-600 dark:text-orange-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                  Sistema de Registro por Autorización
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                  Esta plataforma utiliza un sistema de acceso restringido. Solo
                  los usuarios con correos electrónicos previamente autorizados
                  por el administrador pueden crear cuentas.
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <li>
                    • El primer usuario registrado automáticamente se convierte
                    en SUPERADMIN
                  </li>
                  <li>
                    • Usuarios posteriores requieren autorización previa de
                    correo electrónico
                  </li>
                  <li>
                    • Solo el SUPERADMIN puede autorizar nuevos correos
                    electrónicos
                  </li>
                  <li>• Cuentas autorizadas obtienen permisos de ADMIN</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
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

          {/* Tarjeta de Dashboard */}
          <Card className="shadow-md">
            <CardHeader className="flex flex-col items-center pb-0">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardBody className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Dashboard en Tiempo Real
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Monitorea acciones en cola y ejecutándose
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Versión 2.0 • Sistema de Autorización Implementado • Desarrollado
            con ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
