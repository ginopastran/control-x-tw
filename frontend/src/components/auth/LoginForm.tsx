"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
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
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      // Guardar token en localStorage para deploy cross-domain
      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token);
      }

      // Redireccionar al dashboard o a la página solicitada
      const urlParams = new URLSearchParams(window.location.search);
      const from = urlParams.get("from") || "/dashboard";

      router.push(from);
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
      <div className="w-full p-8 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl relative z-10">
        <h2 className="text-2xl font-bold text-center text-white mb-8">
          Iniciar Sesión
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/15"
              placeholder="tu@email.com"
            />
          </div>

          {/* Campo Contraseña */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2"
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
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       transition-all duration-200 backdrop-blur-sm
                       hover:bg-white/15"
              placeholder="••••••••"
            />
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200
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
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </span>
          </button>
        </form>

        {/* Línea divisoria */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-center text-xs text-gray-400">
            Acceso seguro con autenticación JWT
          </p>
        </div>
      </div>

      {/* Efectos de resplandor */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-lg opacity-30 -z-10"></div>
    </div>
  );
}
