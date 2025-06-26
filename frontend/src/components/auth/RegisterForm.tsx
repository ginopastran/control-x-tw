"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validar que las contraseñas coincidan
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Validar longitud de contraseña
    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError(
            "Tu correo electrónico no está autorizado para registrarse. " +
              "Solo los correos autorizados por el administrador pueden crear cuentas. " +
              "Contacta al administrador para obtener autorización."
          );
        } else {
          throw new Error(data.error || "Error al registrar usuario");
        }
        return;
      }

      // Mostrar mensaje de éxito si aplica
      if (data.message) {
        alert(data.message);
      }

      // Redireccionar al panel de administración
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Formulario con efecto glassmorphism */}
      <div className="w-full p-8 bg-white border border-gray-200 rounded-2xl shadow-lg relative z-10">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Registrarse
        </h2>

        {/* Información sobre autorización */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">Registro por Autorización</span>
          </div>
          <p className="text-sm">
            Solo los correos electrónicos autorizados previamente por el
            administrador pueden crear cuentas en el sistema.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Nombre */}
          <div className="group">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2 transition-colors group-focus-within:text-blue-400"
            >
              Nombre
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                         transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/10 relative z-20"
              placeholder="Tu nombre completo"
            />
          </div>

          {/* Campo Email */}
          <div className="group">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2 transition-colors group-focus-within:text-blue-400"
            >
              Correo Electrónico *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Debe estar autorizado por el administrador"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                         transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/10 relative z-20"
            />
            <p className="text-xs text-gray-400 mt-1">
              * Solo correos autorizados pueden registrarse
            </p>
          </div>

          {/* Campo Contraseña */}
          <div className="group">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2 transition-colors group-focus-within:text-blue-400"
            >
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                         transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/10 relative z-20"
            />
          </div>

          {/* Campo Confirmar Contraseña */}
          <div className="group">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300 mb-2 transition-colors group-focus-within:text-blue-400"
            >
              Confirmar Contraseña
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                         transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/10 relative z-20"
              placeholder="Confirma tu contraseña"
            />
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200 relative z-20
              ${
                loading
                  ? "bg-gray-600 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transform hover:scale-[1.02] active:scale-[0.98]"
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900
              shadow-lg hover:shadow-xl
            `}
          >
            <span className="flex items-center justify-center">
              {loading && (
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {loading ? "Registrando..." : "Registrarse"}
            </span>
          </button>
        </form>

        {/* Información adicional */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="text-center text-sm text-gray-400">
            <p>¿No tienes autorización?</p>
            <p className="mt-1 text-blue-400 font-medium">
              Contacta al administrador para obtener acceso
            </p>
          </div>
        </div>
      </div>

      {/* Efectos de resplandor - sin interferir con los inputs */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-lg opacity-30 -z-10 pointer-events-none"></div>
    </div>
  );
}
