"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewAccountApiKeysPage() {
  const router = useRouter();

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
    username: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.apiKey || !formData.apiSecret || !formData.username) {
      setError("API Key, API Secret y Username son requeridos");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Primero crear la cuenta básica
      const createResponse = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          useOwnCredentials: true,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Error al crear la cuenta");
      }

      const { account } = await createResponse.json();

      // Luego agregar las credenciales
      const credentialsResponse = await fetch(
        `/api/accounts/${account._id}/credentials`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: formData.apiKey,
            apiSecret: formData.apiSecret,
            bearerToken: formData.bearerToken,
            accessToken: formData.accessToken,
            accessTokenSecret: formData.accessTokenSecret,
            appName: formData.appName,
            developerEmail: formData.developerEmail,
          }),
        }
      );

      if (!credentialsResponse.ok) {
        const errorData = await credentialsResponse.json();
        throw new Error(errorData.error || "Error al guardar credenciales");
      }

      setSuccess(
        `✅ Cuenta @${formData.username} creada exitosamente con API keys propias.`
      );

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push("/accounts");
      }, 2000);
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="light"
            onPress={() => router.push("/accounts")}
            startContent={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            }
          >
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agregar Cuenta con API Keys</h1>
            <p className="text-default-500">
              Conecta una cuenta usando tus propias credenciales de
              desarrollador
            </p>
          </div>
        </div>

        <Card className="bg-warning-50 border-warning-200">
          <CardBody>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-warning mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="font-medium text-warning-800">
                  Necesitas una cuenta de desarrollador de X
                </div>
                <div className="text-warning-700 text-sm mt-1">
                  Este método requiere que tengas tu propia app de desarrollador
                  en X para obtener las credenciales necesarias.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" className="mb-6">
          {success}
        </Alert>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Información de la Cuenta</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Username de X"
              placeholder="ejemplo_usuario"
              value={formData.username}
              onValueChange={(value) => handleInputChange("username", value)}
              required
              description="El username de la cuenta que quieres conectar (sin @)"
              startContent="@"
            />
          </CardBody>
        </Card>

        {/* Credenciales requeridas */}
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Credenciales Requeridas</h2>
              <p className="text-sm text-default-500 mt-1">
                Obtén estas credenciales desde tu app de desarrollador de X
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="API Key"
              placeholder="Tu API Key"
              value={formData.apiKey}
              onValueChange={(value) => handleInputChange("apiKey", value)}
              required
              description="Consumer Key de tu app de X"
            />

            <Input
              label="API Secret"
              placeholder="Tu API Secret"
              type="password"
              value={formData.apiSecret}
              onValueChange={(value) => handleInputChange("apiSecret", value)}
              required
              description="Consumer Secret de tu app de X"
            />
          </CardBody>
        </Card>

        {/* Credenciales opcionales */}
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Credenciales Opcionales</h2>
              <p className="text-sm text-default-500 mt-1">
                Mejoran la funcionalidad pero no son estrictamente necesarias
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Bearer Token"
              placeholder="Tu Bearer Token"
              type="password"
              value={formData.bearerToken}
              onValueChange={(value) => handleInputChange("bearerToken", value)}
              description="Para operaciones que no requieren autenticación de usuario"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Access Token"
                placeholder="Tu Access Token"
                type="password"
                value={formData.accessToken}
                onValueChange={(value) =>
                  handleInputChange("accessToken", value)
                }
                description="Token de acceso OAuth 1.0a"
              />

              <Input
                label="Access Token Secret"
                placeholder="Tu Access Token Secret"
                type="password"
                value={formData.accessTokenSecret}
                onValueChange={(value) =>
                  handleInputChange("accessTokenSecret", value)
                }
                description="Secret del token de acceso"
              />
            </div>
          </CardBody>
        </Card>

        {/* Información de la app */}
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Información de la App</h2>
              <p className="text-sm text-default-500 mt-1">
                Datos adicionales para identificar tu app
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Nombre de la App"
              placeholder="Mi App de X"
              value={formData.appName}
              onValueChange={(value) => handleInputChange("appName", value)}
              description="Nombre de tu app en el portal de desarrollador"
            />

            <Input
              label="Email de Desarrollador"
              placeholder="tu@email.com"
              type="email"
              value={formData.developerEmail}
              onValueChange={(value) =>
                handleInputChange("developerEmail", value)
              }
              description="Email asociado a tu cuenta de desarrollador"
            />
          </CardBody>
        </Card>

        {/* Instrucciones */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">
              ¿Cómo obtener las credenciales?
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">1. Cuenta de Desarrollador</h4>
                <p className="text-default-600 mb-2">
                  Necesitas una cuenta de desarrollador aprobada en X:
                </p>
                <Link
                  href="https://developer.twitter.com"
                  target="_blank"
                  size="sm"
                  showAnchorIcon
                >
                  Aplicar para cuenta de desarrollador
                </Link>
              </div>

              <Divider />

              <div>
                <h4 className="font-medium mb-2">2. Crear una App</h4>
                <p className="text-default-600 mb-2">
                  En el portal de desarrollador, crea una nueva app:
                </p>
                <Link
                  href="https://developer.twitter.com/en/portal/dashboard"
                  target="_blank"
                  size="sm"
                  showAnchorIcon
                >
                  Portal de Desarrollador de X
                </Link>
              </div>

              <Divider />

              <div>
                <h4 className="font-medium mb-2">3. Configurar Permisos</h4>
                <p className="text-default-600">
                  Asegúrate de que tu app tenga permisos de lectura y escritura
                  para poder publicar tweets.
                </p>
              </div>

              <Divider />

              <div>
                <h4 className="font-medium mb-2">4. Obtener Credenciales</h4>
                <ul className="text-default-600 space-y-1 list-disc list-inside">
                  <li>API Key y API Secret: En la sección "Keys and tokens"</li>
                  <li>Bearer Token: En la misma sección</li>
                  <li>Access Tokens: Generar en "Access Token and Secret"</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            variant="light"
            onPress={() => router.push("/accounts")}
            isDisabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            color="primary"
            isLoading={saving}
            disabled={
              !formData.username || !formData.apiKey || !formData.apiSecret
            }
          >
            {saving ? "Creando cuenta..." : "Crear Cuenta"}
          </Button>
        </div>
      </form>
    </div>
  );
}
