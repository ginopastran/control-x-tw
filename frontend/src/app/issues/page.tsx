"use client";

import Link from "next/link";
import { useState } from "react";

interface Issue {
  id: number;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
}

export default function IssuesPage() {
  const [issues] = useState<Issue[]>([
    {
      id: 1,
      title: "Error en la autenticación con X",
      description: "Algunos usuarios reportan problemas al conectar sus cuentas de X debido a la actualización de la API.",
      status: "open",
      createdAt: new Date().toISOString(),
    }
  ]);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Problemas del Sistema</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Volver al inicio
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-6 py-3">
          <h2 className="text-lg font-semibold">Issues activos ({issues.length})</h2>
        </div>
        
        {issues.length === 0 ? (
          <p className="p-6 text-gray-500">No hay issues activos en este momento.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {issues.map((issue) => (
              <li key={issue.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">{issue.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{issue.description}</p>
                    <div className="flex items-center text-xs">
                      <span className={`px-2 py-1 rounded-full 
                        ${issue.status === 'open' ? 'bg-red-100 text-red-800' : 
                          issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'}`}
                      >
                        {issue.status === 'open' ? 'Abierto' : 
                          issue.status === 'in_progress' ? 'En progreso' : 'Resuelto'}
                      </span>
                      <span className="ml-3 text-gray-500">
                        Creado el {new Date(issue.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 