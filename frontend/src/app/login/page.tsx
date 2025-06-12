import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Control-X
          </h1>
          <p className="text-gray-400 text-lg">
            Gestor Centralizado de Cuentas de X
          </p>
        </div>

        <LoginForm />

        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            ¿No tienes una cuenta?{" "}
            <Link
              href="/register"
              className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium hover:underline"
            >
              Registrarse
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
