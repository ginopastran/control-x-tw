"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, Chip, Button } from "@heroui/react";

interface Account {
  _id: string;
  username: string;
  userId?: string;
  labels?: string[];
}

export default function UserIdsDebugPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Error al cargar cuentas");
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const accountsWithUserId = accounts.filter((acc) => acc.userId);
  const accountsWithoutUserId = accounts.filter((acc) => !acc.userId);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardBody>
            <p>Cargando cuentas...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div>
            <h1 className="text-2xl font-bold">Debug: User IDs</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Verificación de userIds configurados en las cuentas
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4">
            <Chip color="success" variant="flat">
              {accountsWithUserId.length} con userId
            </Chip>
            <Chip color="danger" variant="flat">
              {accountsWithoutUserId.length} sin userId
            </Chip>
            <Chip color="primary" variant="flat">
              {accounts.length} total
            </Chip>
          </div>
        </CardBody>
      </Card>

      {/* Cuentas con userId */}
      {accountsWithUserId.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-green-600">
              ✅ Cuentas con userId ({accountsWithUserId.length})
            </h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accountsWithUserId.map((account) => (
                <div
                  key={account._id}
                  className="p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">@{account.username}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ID: {account.userId}
                      </p>
                    </div>
                    <Chip size="sm" color="success" variant="flat">
                      ✓ Listo
                    </Chip>
                  </div>
                  {account.labels && account.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {account.labels.map((label) => (
                        <Chip
                          key={label}
                          size="sm"
                          variant="flat"
                          color="secondary"
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cuentas sin userId */}
      {accountsWithoutUserId.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-red-600">
              ❌ Cuentas sin userId ({accountsWithoutUserId.length})
            </h2>
            <p className="text-sm text-red-500">
              Estas cuentas no pueden usar las funciones de like y retweet
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accountsWithoutUserId.map((account) => (
                <div
                  key={account._id}
                  className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">@{account.username}</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        No userId configurado
                      </p>
                    </div>
                    <Chip size="sm" color="danger" variant="flat">
                      ⚠ Sin ID
                    </Chip>
                  </div>
                  {account.labels && account.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {account.labels.map((label) => (
                        <Chip
                          key={label}
                          size="sm"
                          variant="flat"
                          color="secondary"
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Instrucciones para solucionar */}
      {accountsWithoutUserId.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">🔧 Cómo solucionarlo</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Para que las cuentas sin userId puedan usar likes y retweets,
                necesitas:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  Obtener el userId de cada cuenta desde la API de Twitter
                </li>
                <li>Actualizar la base de datos con estos IDs</li>
                <li>El userId es diferente al username - es un número único</li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 <strong>Tip:</strong> Puedes obtener el userId usando la
                  API de Twitter:
                  <code className="ml-1 px-1 bg-blue-100 dark:bg-blue-900 rounded">
                    GET /2/users/by/username/:username
                  </code>
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
