"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Button } from "@heroui/react";

interface DebugInfo {
  serverUser: any;
  clientCookies: any;
  localStorage: any;
  sessionStorage: any;
}

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const loadDebugInfo = async () => {
    try {
      // Verificar usuario del servidor
      const response = await fetch("/api/auth/me");
      const serverUser = response.ok ? await response.json() : null;

      // Verificar cookies del cliente
      const clientCookies = document.cookie
        .split(";")
        .reduce((acc: any, cookie) => {
          const [key, value] = cookie.trim().split("=");
          acc[key] = value;
          return acc;
        }, {});

      // Verificar localStorage
      const localStorage: any = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          localStorage[key] = window.localStorage.getItem(key);
        }
      }

      // Verificar sessionStorage
      const sessionStorage: any = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          sessionStorage[key] = window.sessionStorage.getItem(key);
        }
      }

      setDebugInfo({
        serverUser,
        clientCookies,
        localStorage,
        sessionStorage,
      });
    } catch (error) {
      console.error("Error loading debug info:", error);
    }
  };

  const clearEverything = () => {
    // Limpiar localStorage
    window.localStorage.clear();

    // Limpiar sessionStorage
    window.sessionStorage.clear();

    // Intentar limpiar cookies manualmente
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos) : c;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie =
        name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/admin";
      document.cookie =
        name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/accounts";
    });

    // Recargar info
    loadDebugInfo();
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  if (!debugInfo) {
    return <div>Cargando debug info...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Debug de Autenticación</h1>
        <div className="flex gap-2">
          <Button onClick={loadDebugInfo} color="primary">
            Recargar
          </Button>
          <Button onClick={clearEverything} color="danger">
            Limpiar Todo
          </Button>
          <Button
            onClick={() => (window.location.href = "/logout")}
            color="warning"
          >
            Logout Server-Side
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Usuario del Servidor</h3>
          </CardHeader>
          <CardBody>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.serverUser, null, 2)}
            </pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Cookies del Cliente</h3>
          </CardHeader>
          <CardBody>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.clientCookies, null, 2)}
            </pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">localStorage</h3>
          </CardHeader>
          <CardBody>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.localStorage, null, 2)}
            </pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">sessionStorage</h3>
          </CardHeader>
          <CardBody>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.sessionStorage, null, 2)}
            </pre>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
