"use client";

import { useSearchParams } from "next/navigation";
import ErrorMessage from '@/app/components/ErrorMessage';
import { useEffect, useState, Suspense } from 'react';

// Componente interno que usa useSearchParams
function ErrorContent() {
  const searchParams = useSearchParams() || new URLSearchParams();
  const [error, setError] = useState<Error | null>(null);
  
  // Obtener parámetros de consulta con valores por defecto seguros
  const message = searchParams?.get('message') || 'Ha ocurrido un error inesperado';
  const statusCode = searchParams?.get('statusCode') ? parseInt(searchParams.get('statusCode') || '0', 10) : undefined;
  const retry = searchParams?.get('retry') === 'true';
  const redirectPath = searchParams?.get('redirectPath') || '/';
  const redirectText = searchParams?.get('redirectText') || 'Volver al inicio';
  const title = searchParams?.get('title') || 'Ha ocurrido un error';
  
  // Si hay un error en la sesión de almacenamiento local, usarlo
  useEffect(() => {
    // Intentar recuperar información de error desde sessionStorage
    try {
      const storedErrorData = sessionStorage.getItem('lastError');
      if (storedErrorData) {
        const errorData = JSON.parse(storedErrorData);
        setError(new Error(errorData.message));
      }
    } catch (e) {
      // Ignorar errores al leer sessionStorage
    }
  }, []);

  return (
    <ErrorMessage
      title={title}
      message={message}
      error={error || undefined}
      statusCode={statusCode}
      retry={retry}
      redirectPath={redirectPath}
      redirectText={redirectText}
    />
  );
}

export default function ErrorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Cargando...</div>}>
        <ErrorContent />
      </Suspense>
    </div>
  );
}