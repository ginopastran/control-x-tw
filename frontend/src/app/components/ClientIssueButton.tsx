'use client';

import dynamic from 'next/dynamic';

// Importar IssueButton de forma dinámica con SSR desactivado
const IssueButton = dynamic(() => import('./IssueButton'), { 
  ssr: false,
  loading: () => null
});

export default function ClientIssueButton() {
  return <IssueButton />;
} 