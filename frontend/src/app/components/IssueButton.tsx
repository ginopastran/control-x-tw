"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function IssueButton() {
  // Usar un estado para controlar la hidratación
  const [isClient, setIsClient] = useState(false);
  const [issues, setIssues] = useState(0);
  
  // Este efecto solo se ejecutará en el cliente después de la hidratación
  useEffect(() => {
    setIsClient(true);
    // Aquí puedes cargar el número real de issues
    setIssues(1);
  }, []);
  
  // Si no estamos en el cliente, renderizamos un placeholder vacío
  if (!isClient) {
    return null; // Esto evita discrepancias entre servidor y cliente
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Link href="/issues" className="relative flex items-center justify-center">
        <div className="flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors">
          <span className="text-xl font-bold">N</span>
        </div>
        {issues > 0 && (
          <div className="absolute -top-1 -right-1 flex items-center justify-center min-w-[24px] h-6 px-1 bg-red-700 text-white text-xs rounded-full">
            {issues} {issues === 1 ? 'Issue' : 'Issues'}
          </div>
        )}
      </Link>
    </div>
  );
} 