"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Spinner,
  Link,
  Divider,
  Alert,
  Chip,
} from "@heroui/react";

interface Account {
  _id: string;
  username: string;
  userId: string;
  useOwnCredentials: boolean;
  credentialsVerified: boolean;
  userAppName?: string;
  appCreatedAt?: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params?.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form data
  const [formData, setFormData] = useState({
    apiKey: "",
    apiSecret: "",
    bearerToken: "",
    accessToken: "",
    accessTokenSecret: "",
    appName: "",
    developerEmail: "",
  });

  useEffect(() => {
    if (accountId) {
      fetchAccountData();
    }
  }, [accountId]);

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accounts/${accountId}`);
      if (!response.ok) {
        throw new Error("Error al cargar la cuenta");
      }
      const data = await response.json();
      setAccount(data.account);

      // Pre-llenar datos si ya existen
      if (data.account.userAppName) {
        setFormData((prev) => ({
          ...prev,
          appName: data.account.userAppName,
        }));
      }
    } catch (err: any) {
      setError("Error al cargar la cuenta: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.apiKey || !formData.apiSecret) {
      setError("API Key y API Secret son requeridos");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`/api/accounts/${accountId}/credentials`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar credenciales");
      }

      const result = await response.json();
      setSuccess(
        "✅ Credenciales guardadas exitosamente. Ahora usas tus propias API keys."
      );
      setAccount((prev) => (prev ? { ...prev, ...result.account } : null));

      // Limpiar formulario por seguridad
      setFormData({
        apiKey: "",
        apiSecret: "",
        bearerToken: "",
        accessToken: "",
        accessTokenSecret: "",
        appName: formData.appName,
        developerEmail: formData.developerEmail,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCredentials = async () => {
    if (
      !confirm(
        "¿Estás seguro de eliminar tus API keys propias y volver a usar las compartidas?"
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/accounts/${accountId}/credentials`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar credenciales");
      }

      setSuccess(
        "✅ Credenciales eliminadas. Ahora usas las credenciales compartidas."
      );
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              useOwnCredentials: false,
              credentialsVerified: false,
              userAppName: undefined,
            }
          : null
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(""); // Limpiar errores cuando el usuario edita
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Cargando cuenta..." />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardBody className="text-center">
            <h1 className="text-xl font-bold mb-4">Cuenta no encontrada</h1>
            <Button onPress={() => router.push("/accounts")}>
              Volver a cuentas
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="light"
            isIconOnly
            onPress={() => router.push("/accounts")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurar API Keys</h1>
            <p className="text-default-500">
              Cuenta: @{account.username} •{" "}
              {account.useOwnCredentials
                ? "Usando credenciales propias"
                : "Usando credenciales compartidas"}
            </p>
          </div>
        </div>

        {account.useOwnCredentials && account.credentialsVerified && (
          <Card className="bg-success-50 border-success-200">
            <CardBody>
              <div className="flex items-center gap-3">
                <Chip color="success" variant="flat">
                  ✓ Configurado
                </Chip>
                <div>
                  <div className="font-medium text-success-800">
                    Esta cuenta usa sus propias API keys
                  </div>
                  <div className="text-small text-success-600">
                    App: {account.userAppName || "Sin nombre"} • Rate limits
                    independientes
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Instrucciones */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-bold">📋 Instrucciones</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">
              1. Crea tu aplicación en Twitter
            </h3>
            <p className="text-small text-default-600 mb-2">
              Ve a{" "}
              <Link
                href="https://developer.twitter.com/en/portal/dashboard"
                target="_blank"
                className="text-primary"
              >
                developer.twitter.com
              </Link>{" "}
              y:
            </p>
            <ul className="list-disc list-inside text-small text-default-600 space-y-1 ml-4">
              <li>Aplica para una cuenta de desarrollador</li>
              <li>Crea una nueva aplicación</li>
              <li>Obtén tus API Key, API Secret y Bearer Token</li>
              <li>Configura permisos de lectura y escritura</li>
            </ul>
          </div>

          <Divider />

          <div>
            <h3 className="font-semibold mb-2">
              2. Beneficios de usar tus propias keys
            </h3>
            <ul className="list-disc list-inside text-small text-default-600 space-y-1 ml-4">
              <li>
                🔒 Rate limits independientes (17 tweets/día solo para ti)
              </li>
              <li>⚡ Sin necesidad de refresh tokens</li>
              <li>📊 Control total sobre tu aplicación</li>
              <li>🎯 No dependes de límites compartidos</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">🔑 Configurar Credenciales</h2>
        </CardHeader>
        <CardBody>
          {error && (
            <Alert color="danger" className="mb-4">
              {error}
            </Alert>
          )}

          {success && (
            <Alert color="success" className="mb-4">
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información de la aplicación */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Información de la aplicación
              </h3>

              <Input
                label="Nombre de tu aplicación"
                placeholder="Mi App de Twitter"
                value={formData.appName}
                onChange={(e) => handleInputChange("appName", e.target.value)}
                description="Nombre descriptivo para identificar tu app"
              />

              <Input
                label="Email de desarrollador"
                type="email"
                placeholder="tu-email@example.com"
                value={formData.developerEmail}
                onChange={(e) =>
                  handleInputChange("developerEmail", e.target.value)
                }
                description="Email asociado a tu cuenta de desarrollador de Twitter"
              />
            </div>

            <Divider />

            {/* Credenciales requeridas */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Credenciales requeridas *
              </h3>

              <Input
                label="API Key (Consumer Key)"
                placeholder="Tu API Key de Twitter"
                value={formData.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                isRequired
                description="Clave de tu aplicación en Twitter Developer Portal"
              />

              <Input
                label="API Secret (Consumer Secret)"
                type="password"
                placeholder="Tu API Secret de Twitter"
                value={formData.apiSecret}
                onChange={(e) => handleInputChange("apiSecret", e.target.value)}
                isRequired
                description="Secreto de tu aplicación (manténlo seguro)"
              />
            </div>

            <Divider />

            {/* Credenciales opcionales */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Credenciales opcionales</h3>

              <Input
                label="Bearer Token"
                placeholder="Tu Bearer Token de Twitter"
                value={formData.bearerToken}
                onChange={(e) =>
                  handleInputChange("bearerToken", e.target.value)
                }
                description="Token para autenticación de aplicación (recomendado)"
              />

              <Input
                label="Access Token"
                placeholder="Tu Access Token"
                value={formData.accessToken}
                onChange={(e) =>
                  handleInputChange("accessToken", e.target.value)
                }
                description="Token de acceso del usuario (OAuth 1.0a)"
              />

              <Input
                label="Access Token Secret"
                type="password"
                placeholder="Tu Access Token Secret"
                value={formData.accessTokenSecret}
                onChange={(e) =>
                  handleInputChange("accessTokenSecret", e.target.value)
                }
                description="Secreto del token de acceso"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                color="primary"
                size="lg"
                isLoading={saving}
                disabled={!formData.apiKey || !formData.apiSecret}
              >
                {account.useOwnCredentials
                  ? "Actualizar Credenciales"
                  : "Guardar y Activar"}
              </Button>

              {account.useOwnCredentials && (
                <Button
                  color="danger"
                  variant="bordered"
                  size="lg"
                  onPress={handleRemoveCredentials}
                  isLoading={saving}
                >
                  Eliminar Credenciales Propias
                </Button>
              )}

              <Button
                variant="light"
                size="lg"
                onPress={() => router.push("/accounts")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
