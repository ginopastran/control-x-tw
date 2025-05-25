"use client";

import { useSearchParams } from "next/navigation";
import ErrorMessage from '@/app/components/ErrorMessage';
import { useEffect, useState } from 'react';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<Error | null>(null);
  
  // Obtener parámetros de consulta
  const message = searchParams.get('message') || 'Ha ocurrido un error inesperado';
  const statusCode = searchParams.get('statusCode') ? parseInt(searchParams.get('statusCode')!) : undefined;
  const retry = searchParams.get('retry') === 'true';
  const redirectPath = searchParams.get('redirectPath') || '/';
  const redirectText = searchParams.get('redirectText') || 'Volver al inicio';
  
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
    <div className="container mx-auto px-4 py-8">
      <ErrorMessage
        title={searchParams.get('title') || 'Ha ocurrido un error'}
        message={message}
        error={error || undefined}
        statusCode={statusCode}
        retry={retry}
        redirectPath={redirectPath}
        redirectText={redirectText}
      />
    </div>
  );
} 