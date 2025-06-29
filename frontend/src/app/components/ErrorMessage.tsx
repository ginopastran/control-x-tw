'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logError } from '@/lib/log-action';

interface ErrorMessageProps {
  title?: string;
  message: string;
  error?: Error;
  statusCode?: number;
  retry?: boolean;
  redirectPath?: string;
  redirectText?: string;
  timestamp?: string;
}

export default function ErrorMessage({
  title = "Ha ocurrido un error",
  message,
  error,
  statusCode,
  retry = false,
  redirectPath = "/",
  redirectText = "Volver al inicio",
  timestamp = new Date().toISOString()
}: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    // Registrar el error para facilitar depuración
    if (error) {
      logError('client_error_displayed', error, { statusCode, message });
    }
  }, [error, statusCode, message]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl mx-auto mt-8">
      <div className="flex items-center mb-4">
        <div className="mr-4 bg-red-100 dark:bg-red-900 p-2 rounded-full">
          <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {statusCode ? `Error ${statusCode}:` : ''} {title}
        </h2>
      </div>
      
      <div className="mb-4 text-gray-700 dark:text-gray-300">{message}</div>
      
      {error && (
        <div className="mb-6">
          <button
            className="text-blue-500 hover:underline text-sm focus:outline-none"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Ocultar detalles técnicos' : 'Mostrar detalles técnicos'}
          </button>
          
          {showDetails && (
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono overflow-x-auto">
              <p className="text-red-500">{error.name}: {error.message}</p>
              {error.stack && (
                <pre className="mt-2 whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-wrap gap-4 mt-4">
        {retry && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        )}
        
        <Link href={redirectPath} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600">
          {redirectText}
        </Link>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Código de referencia: {timestamp.substring(0, 19).replace('T', ' ')}
        </p>
      </div>
    </div>
  );
} 