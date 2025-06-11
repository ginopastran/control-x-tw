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
  Switch,
  Tabs,
  Tab,
  Checkbox,
} from "@heroui/react";

export default function NewAccountApiKeysPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("oauth2");

  // Form data
  const [formData, setFormData] = useState({
    // OAuth 1.0a credentials
    apiKey: "",
    apiSecret: "",
    bearerToken: "",
    accessToken: "",
    accessTokenSecret: "",
    // OAuth 2.0 credentials
    clientId: "",
    clientSecret: "",
    oauth2AccessToken: "",
    oauth2RefreshToken: "",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    // General info
    appName: "",
    developerEmail: "",
    username: "",
    preferOAuth2: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación basada en el tipo de credenciales
    if (formData.preferOAuth2) {
      if (!formData.clientId || !formData.clientSecret || !formData.username) {
        setError(
          "Client ID, Client Secret y Username son requeridos para OAuth 2.0"
        );
        return;
      }
    } else {
      if (!formData.apiKey || !formData.apiSecret || !formData.username) {
        setError(
          "API Key, API Secret y Username son requeridos para OAuth 1.0a"
        );
        return;
      }
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
          preferOAuth2: formData.preferOAuth2,
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
            // OAuth 1.0a
            apiKey: formData.apiKey,
            apiSecret: formData.apiSecret,
            bearerToken: formData.bearerToken,
            accessToken: formData.accessToken,
            accessTokenSecret: formData.accessTokenSecret,
            // OAuth 2.0
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
            oauth2AccessToken: formData.oauth2AccessToken,
            oauth2RefreshToken: formData.oauth2RefreshToken,
            scopes: formData.scopes,
            // General
            appName: formData.appName,
            developerEmail: formData.developerEmail,
            preferOAuth2: formData.preferOAuth2,
          }),
        }
      );

      if (!credentialsResponse.ok) {
        const errorData = await credentialsResponse.json();
        throw new Error(errorData.error || "Error al guardar credenciales");
      }

      const authType = formData.preferOAuth2 ? "OAuth 2.0" : "OAuth 1.0a";
      setSuccess(
        `✅ Cuenta @${formData.username} creada exitosamente con ${authType}.`
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

  const handleInputChange = (
    field: string,
    value: string | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(""); // Limpiar errores cuando el usuario edita
  };

  const handleScopeChange = (scope: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      scopes: checked
        ? [...prev.scopes, scope]
        : prev.scopes.filter((s) => s !== scope),
    }));
  };

  const availableScopes = [
    {
      value: "tweet.read",
      label: "Leer tweets",
      description: "Leer tweets y contenido público",
    },
    {
      value: "tweet.write",
      label: "Escribir tweets",
      description: "Crear, editar y eliminar tweets",
    },
    {
      value: "users.read",
      label: "Leer usuarios",
      description: "Leer información de perfiles de usuario",
    },
    {
      value: "follows.read",
      label: "Leer seguidores",
      description: "Ver quién sigue a quién",
    },
    {
      value: "follows.write",
      label: "Gestionar seguidores",
      description: "Seguir y dejar de seguir usuarios",
    },
    {
      value: "offline.access",
      label: "Acceso offline",
      description: "Renovar tokens automáticamente",
    },
    {
      value: "space.read",
      label: "Leer espacios",
      description: "Acceder a información de Spaces",
    },
    {
      value: "mute.read",
      label: "Leer silenciados",
      description: "Ver usuarios silenciados",
    },
    {
      value: "mute.write",
      label: "Gestionar silenciados",
      description: "Silenciar y dessilenciar usuarios",
    },
    {
      value: "like.read",
      label: "Leer likes",
      description: "Ver tweets con like",
    },
    {
      value: "like.write",
      label: "Gestionar likes",
      description: "Dar y quitar likes",
    },
  ];

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

        <Card className="bg-blue-50 border-blue-200">
          <CardBody>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="font-medium text-blue-800">
                  Ahora compatible con OAuth 2.0
                </div>
                <div className="text-blue-700 text-sm mt-1">
                  OAuth 2.0 es más moderno y seguro. Se recomienda usar OAuth
                  2.0 sobre OAuth 1.0a para nuevas implementaciones.
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
            <Input
              label="Nombre de la App"
              placeholder="Mi App de Twitter"
              value={formData.appName}
              onValueChange={(value) => handleInputChange("appName", value)}
              description="Nombre descriptivo de tu aplicación"
            />
            <Input
              label="Email de Desarrollador"
              placeholder="dev@example.com"
              type="email"
              value={formData.developerEmail}
              onValueChange={(value) =>
                handleInputChange("developerEmail", value)
              }
              description="Email asociado a tu cuenta de desarrollador"
            />
          </CardBody>
        </Card>

        {/* Selector de tipo de autenticación */}
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Tipo de Autenticación</h2>
              <p className="text-sm text-default-500 mt-1">
                Elige el método de autenticación que prefieres usar
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">OAuth 1.0a</span>
                <Switch
                  isSelected={formData.preferOAuth2}
                  onValueChange={(checked) =>
                    handleInputChange("preferOAuth2", checked)
                  }
                  color="primary"
                />
                <span className="text-sm font-medium">OAuth 2.0</span>
              </div>
              <Chip
                color={formData.preferOAuth2 ? "success" : "warning"}
                variant="flat"
                size="sm"
              >
                {formData.preferOAuth2 ? "Recomendado" : "Legacy"}
              </Chip>
            </div>
            <div className="mt-3 text-sm text-default-600">
              {formData.preferOAuth2
                ? "OAuth 2.0 es más moderno, seguro y fácil de implementar. Soporta scopes granulares y refresh tokens."
                : "OAuth 1.0a es el método tradicional. Requiere más configuración pero es compatible con todas las funciones."}
            </div>
          </CardBody>
        </Card>

        {/* Credenciales */}
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">
                Credenciales{" "}
                {formData.preferOAuth2 ? "OAuth 2.0" : "OAuth 1.0a"}
              </h2>
              <p className="text-sm text-default-500 mt-1">
                Obtén estas credenciales desde tu app de desarrollador de X
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {formData.preferOAuth2 ? (
              // OAuth 2.0 Fields
              <>
                <Input
                  label="Client ID"
                  placeholder="Tu Client ID de OAuth 2.0"
                  value={formData.clientId}
                  onValueChange={(value) =>
                    handleInputChange("clientId", value)
                  }
                  required
                  description="Client ID de tu aplicación OAuth 2.0"
                />
                <Input
                  label="Client Secret"
                  placeholder="Tu Client Secret de OAuth 2.0"
                  type="password"
                  value={formData.clientSecret}
                  onValueChange={(value) =>
                    handleInputChange("clientSecret", value)
                  }
                  required
                  description="Client Secret de tu aplicación OAuth 2.0"
                />
                <Input
                  label="Access Token (Opcional)"
                  placeholder="Token de acceso OAuth 2.0"
                  value={formData.oauth2AccessToken}
                  onValueChange={(value) =>
                    handleInputChange("oauth2AccessToken", value)
                  }
                  description="Si ya tienes un token de acceso, puedes incluirlo aquí"
                />
                <Input
                  label="Refresh Token (Opcional)"
                  placeholder="Token de renovación OAuth 2.0"
                  value={formData.oauth2RefreshToken}
                  onValueChange={(value) =>
                    handleInputChange("oauth2RefreshToken", value)
                  }
                  description="Token para renovar automáticamente el access token"
                />

                {/* Scopes */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Scopes Requeridos
                    </h3>
                    <p className="text-xs text-default-500 mb-3">
                      Selecciona los permisos que necesita tu aplicación
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableScopes.map((scope) => (
                      <div key={scope.value} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            isSelected={formData.scopes.includes(scope.value)}
                            onValueChange={(checked) =>
                              handleScopeChange(scope.value, checked)
                            }
                            color="primary"
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {scope.label}
                            </div>
                            <div className="text-xs text-default-500 mt-1">
                              {scope.description}
                            </div>
                            <div className="text-xs text-default-400 mt-1 font-mono">
                              {scope.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // OAuth 1.0a Fields
              <>
                <Input
                  label="API Key (Consumer Key)"
                  placeholder="Tu API Key"
                  value={formData.apiKey}
                  onValueChange={(value) => handleInputChange("apiKey", value)}
                  required
                  description="API Key de tu aplicación de Twitter"
                />
                <Input
                  label="API Secret (Consumer Secret)"
                  placeholder="Tu API Secret"
                  type="password"
                  value={formData.apiSecret}
                  onValueChange={(value) =>
                    handleInputChange("apiSecret", value)
                  }
                  required
                  description="API Secret de tu aplicación de Twitter"
                />
                <Input
                  label="Bearer Token (Opcional)"
                  placeholder="Tu Bearer Token"
                  value={formData.bearerToken}
                  onValueChange={(value) =>
                    handleInputChange("bearerToken", value)
                  }
                  description="Bearer Token para acceso de solo lectura (opcional)"
                />
                <Divider />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Tokens de Usuario (Opcional)
                    </h3>
                    <p className="text-xs text-default-500 mb-3">
                      Si ya tienes tokens de usuario específicos, puedes
                      incluirlos aquí
                    </p>
                  </div>
                  <Input
                    label="Access Token"
                    placeholder="Tu Access Token de usuario"
                    value={formData.accessToken}
                    onValueChange={(value) =>
                      handleInputChange("accessToken", value)
                    }
                    description="Access Token específico del usuario"
                  />
                  <Input
                    label="Access Token Secret"
                    placeholder="Tu Access Token Secret"
                    type="password"
                    value={formData.accessTokenSecret}
                    onValueChange={(value) =>
                      handleInputChange("accessTokenSecret", value)
                    }
                    description="Access Token Secret del usuario"
                  />
                </div>
              </>
            )}
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
