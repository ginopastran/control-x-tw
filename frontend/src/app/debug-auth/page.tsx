"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface AuthDebugInfo {
  tokenExists: boolean;
  tokenValid: boolean;
  user: any;
  error?: string;
}

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch("/api/auth/debug");
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      setDebugInfo({
        tokenExists: false,
        tokenValid: false,
        user: null,
        error: "Error al cargar información de debug",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Debug de Autenticación</h1>
        <p className="text-muted-foreground mt-2">
          Información detallada sobre el estado de autenticación
        </p>
      </div>

      {debugInfo?.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{debugInfo.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado del Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Token existe</span>
              {debugInfo?.tokenExists ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Token válido</span>
              {debugInfo?.tokenValid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {debugInfo?.user && (
          <Card>
            <CardHeader>
              <CardTitle>Información del Usuario</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto">
                {JSON.stringify(debugInfo.user, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button onClick={fetchDebugInfo}>Actualizar Información</Button>
        </div>
      </div>
    </div>
  );
}
