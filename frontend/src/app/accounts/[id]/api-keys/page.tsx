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
  Checkbox,
} from "@heroui/react";

interface Account {
  _id: string;
  username: string;
  userId: string;
  useOwnCredentials: boolean;
  credentialsVerified: boolean;
  preferOAuth2?: boolean;
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

  // Form data OAuth 1.0a
  const [oauth1FormData, setOAuth1FormData] = useState({
    apiKey: "",
    apiSecret: "",
    bearerToken: "",
    accessToken: "",
    accessTokenSecret: "",
  });

  // Form data OAuth 2.0
  const [oauth2FormData, setOAuth2FormData] = useState({
    clientId: "",
    clientSecret: "",
    oauth2AccessToken: "",
    oauth2RefreshToken: "",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  });

  // General form data
  const [generalData, setGeneralData] = useState({
    appName: "",
    developerEmail: "",
    preferOAuth2: true,
  });

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

  useEffect(() => {
    if (accountId) {
      fetchAccountData();
    }
  }, [accountId]);

  // Effect separado para cargar credenciales cuando el account esté listo
  useEffect(() => {
    if (account && account.useOwnCredentials && params?.id) {
      console.log("🔄 Account state actualizado, cargando credenciales...");
      fetchExistingCredentials(account);
    }
  }, [account?.useOwnCredentials, params?.id]);

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      console.log("📋 Cargando datos de cuenta:", accountId);

      const response = await fetch(`/api/accounts/${accountId}`);
      if (!response.ok) {
        throw new Error("Error al cargar la cuenta");
      }
      const data = await response.json();
      console.log("✅ Datos de cuenta cargados:", {
        username: data.account.username,
        useOwnCredentials: data.account.useOwnCredentials,
        credentialsVerified: data.account.credentialsVerified,
      });

      setAccount(data.account);

      // Pre-llenar datos generales si ya existen
      if (data.account.userAppName) {
        setGeneralData((prev) => ({
          ...prev,
          appName: data.account.userAppName,
          preferOAuth2: data.account.preferOAuth2 ?? true,
        }));
      }

      // Cargar credenciales existentes DESPUÉS de setear account
      if (data.account.useOwnCredentials) {
        console.log("🔑 Account usa credenciales propias, cargando...");
        // Pequeño delay para asegurar que el estado se actualice
        setTimeout(() => {
          fetchExistingCredentials(data.account);
        }, 100);
      } else {
        console.log("ℹ️ Account usa credenciales compartidas");
      }
    } catch (err: any) {
      console.error("❌ Error cargando cuenta:", err);
      setError("Error al cargar la cuenta: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingCredentials = async (accountData?: Account) => {
    const currentAccount = accountData || account;

    if (!currentAccount?.useOwnCredentials || !params?.id) {
      console.log("⏸️ fetchExistingCredentials: condiciones no cumplidas", {
        hasAccount: !!currentAccount,
        useOwnCredentials: currentAccount?.useOwnCredentials,
        hasParamsId: !!params?.id,
      });
      return;
    }

    try {
      console.log("🔄 Obteniendo credenciales existentes...");
      const response = await fetch(`/api/accounts/${params.id}/credentials`);

      if (!response.ok) {
        console.error(
          "❌ Error obteniendo credenciales:",
          response.status,
          response.statusText
        );
        return;
      }

      const data = await response.json();
      console.log("📥 Datos recibidos del API:", {
        success: data.success,
        hasCredentials: !!data.credentials,
        appName: data.appName,
        developerEmail: data.developerEmail,
      });

      if (data.success && data.credentials) {
        console.log("🔑 Procesando credenciales recibidas:", {
          hasApiKey: !!data.credentials.apiKey,
          hasApiSecret: !!data.credentials.apiSecret,
          hasBearerToken: !!data.credentials.bearerToken,
          hasClientId: !!data.credentials.clientId,
          hasClientSecret: !!data.credentials.clientSecret,
          hasOAuth2AccessToken: !!data.credentials.oauth2AccessToken,
        });

        // OAuth 1.0a
        const oauth1Data = {
          apiKey: data.credentials.apiKey || "",
          apiSecret: data.credentials.apiSecret || "",
          bearerToken: data.credentials.bearerToken || "",
          accessToken: data.credentials.accessToken || "",
          accessTokenSecret: data.credentials.accessTokenSecret || "",
        };

        console.log("📝 Seteando OAuth 1.0a data:", oauth1Data);
        setOAuth1FormData(oauth1Data);

        // OAuth 2.0
        const oauth2Data = {
          clientId: data.credentials.clientId || "",
          clientSecret: data.credentials.clientSecret || "",
          oauth2AccessToken: data.credentials.oauth2AccessToken || "",
          oauth2RefreshToken: data.credentials.oauth2RefreshToken || "",
          scopes: [],
        };

        console.log("📝 Seteando OAuth 2.0 data:", oauth2Data);
        setOAuth2FormData(oauth2Data);

        // Información general
        const generalUpdate = {
          appName: data.appName || "",
          developerEmail: data.developerEmail || "",
          preferOAuth2: true,
        };

        console.log("📝 Actualizando datos generales:", generalUpdate);
        setGeneralData((prev) => ({
          ...prev,
          ...generalUpdate,
        }));

        console.log("✅ Credenciales cargadas exitosamente");
      } else {
        console.log("⚠️ No se recibieron credenciales válidas");
      }
    } catch (error) {
      console.error("❌ Error fetching credentials:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación: al menos OAuth 1.0a básico o OAuth 2.0 básico
    const hasOAuth1 = oauth1FormData.apiKey && oauth1FormData.apiSecret;
    const hasOAuth2 = oauth2FormData.clientId && oauth2FormData.clientSecret;

    if (!hasOAuth1 && !hasOAuth2) {
      setError(
        "Debes configurar al menos OAuth 1.0a (API Key + Secret) o OAuth 2.0 (Client ID + Secret)"
      );
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
        body: JSON.stringify({
          // OAuth 1.0a
          ...oauth1FormData,
          // OAuth 2.0
          ...oauth2FormData,
          // General
          ...generalData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar credenciales");
      }

      const result = await response.json();
      setSuccess(`✅ Credenciales guardadas exitosamente.`);
      setAccount((prev) => (prev ? { ...prev, ...result.account } : null));

      // No limpiar formulario para mantener visibles las credenciales
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

  const handleOAuth1Change = (field: string, value: string) => {
    setOAuth1FormData((prev) => ({ ...prev, [field]: value }));
    setError(""); // Limpiar errores cuando el usuario edita
  };

  const handleOAuth2Change = (field: string, value: string | string[]) => {
    setOAuth2FormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleGeneralChange = (field: string, value: string | boolean) => {
    setGeneralData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleScopeChange = (scope: string, checked: boolean) => {
    setOAuth2FormData((prev) => ({
      ...prev,
      scopes: checked
        ? [...prev.scopes, scope]
        : prev.scopes.filter((s) => s !== scope),
    }));
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
    <div className="max-w-6xl mx-auto px-4 py-8">
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
            <h1 className="text-4xl font-bold">🔑 Configurar API Keys</h1>
            <p className="text-default-500 text-lg">
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

        {account.useOwnCredentials && (
          <Alert color="warning" className="mt-4">
            <div className="font-medium">🔒 Credenciales protegidas</div>
            <div className="text-sm mt-1">
              Tus credenciales están encriptadas y seguras. Para actualizar,
              ingresa nuevos valores en los campos correspondientes.
            </div>
          </Alert>
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

      <form onSubmit={handleSubmit} className="space-y-8">
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

        {/* DEBUG INFO - TEMPORAL */}

        {/* Información General */}
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-bold">📝 Información General</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="App Name"
                placeholder="Nombre de tu app"
                value={generalData.appName}
                onValueChange={(value) => handleGeneralChange("appName", value)}
                description="Nombre de tu aplicación en el portal de desarrollador"
              />

              <Input
                label="Developer Email"
                placeholder="tu@email.com"
                type="email"
                value={generalData.developerEmail}
                onValueChange={(value) =>
                  handleGeneralChange("developerEmail", value)
                }
                description="Email asociado a tu cuenta de desarrollador"
              />
            </div>
          </CardBody>
        </Card>

        {/* OAuth 1.0a Section */}
        <Card>
          <CardHeader className="bg-orange-50">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-orange-600">
                OAuth 1.0a
              </div>
              <Chip color="warning" variant="flat">
                Legacy
              </Chip>
            </div>
            <p className="text-orange-700 text-sm mt-2">
              Método tradicional de autenticación. Requiere API Key y API
              Secret.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="API Key (Consumer Key) *"
                placeholder="Tu API Key"
                value={oauth1FormData.apiKey}
                onValueChange={(value) => handleOAuth1Change("apiKey", value)}
                description="Consumer Key de tu app de X"
              />

              <Input
                label="API Secret (Consumer Secret) *"
                placeholder="Tu API Secret"
                type="password"
                value={oauth1FormData.apiSecret}
                onValueChange={(value) =>
                  handleOAuth1Change("apiSecret", value)
                }
                description="Consumer Secret de tu app de X"
              />

              <Input
                label="Bearer Token (Opcional)"
                placeholder="Tu Bearer Token"
                value={oauth1FormData.bearerToken}
                onValueChange={(value) =>
                  handleOAuth1Change("bearerToken", value)
                }
                description="Para operaciones que no requieren autenticación de usuario"
              />

              <Input
                label="Access Token (Opcional)"
                placeholder="Tu Access Token"
                value={oauth1FormData.accessToken}
                onValueChange={(value) =>
                  handleOAuth1Change("accessToken", value)
                }
                description="Token de acceso OAuth 1.0a"
              />

              <Input
                label="Access Token Secret (Opcional)"
                placeholder="Tu Access Token Secret"
                type="password"
                value={oauth1FormData.accessTokenSecret}
                onValueChange={(value) =>
                  handleOAuth1Change("accessTokenSecret", value)
                }
                description="Secret del token de acceso"
                className="md:col-span-2"
              />
            </div>
          </CardBody>
        </Card>

        {/* OAuth 2.0 Section */}
        <Card>
          <CardHeader className="bg-green-50">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-green-600">OAuth 2.0</div>
              <Chip color="success" variant="flat">
                Recomendado
              </Chip>
            </div>
            <p className="text-green-700 text-sm mt-2">
              Método moderno y seguro. Soporta scopes granulares y renovación
              automática.
            </p>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Client ID *"
                placeholder="Tu Client ID de OAuth 2.0"
                value={oauth2FormData.clientId}
                onValueChange={(value) => handleOAuth2Change("clientId", value)}
                description="Client ID de tu aplicación OAuth 2.0"
              />

              <Input
                label="Client Secret *"
                placeholder="Tu Client Secret de OAuth 2.0"
                type="password"
                value={oauth2FormData.clientSecret}
                onValueChange={(value) =>
                  handleOAuth2Change("clientSecret", value)
                }
                description="Client Secret de tu aplicación OAuth 2.0"
              />

              <Input
                label="Access Token (Opcional)"
                placeholder="Token de acceso OAuth 2.0"
                value={oauth2FormData.oauth2AccessToken}
                onValueChange={(value) =>
                  handleOAuth2Change("oauth2AccessToken", value)
                }
                description="Si ya tienes un token de acceso, puedes incluirlo aquí"
              />

              <Input
                label="Refresh Token (Opcional)"
                placeholder="Token de renovación OAuth 2.0"
                value={oauth2FormData.oauth2RefreshToken}
                onValueChange={(value) =>
                  handleOAuth2Change("oauth2RefreshToken", value)
                }
                description="Token para renovar automáticamente el access token"
              />
            </div>

            <Divider />

            {/* Scopes */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  🔐 Scopes Requeridos
                </h3>
                <p className="text-sm text-default-500 mb-4">
                  Selecciona los permisos que necesita tu aplicación OAuth 2.0
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableScopes.map((scope) => (
                  <div key={scope.value} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        isSelected={oauth2FormData.scopes.includes(scope.value)}
                        onValueChange={(checked) =>
                          handleScopeChange(scope.value, checked)
                        }
                        color="primary"
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{scope.label}</div>
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
          </CardBody>
        </Card>

        {/* Botones */}
        <div className="flex gap-4 pt-6">
          <Button
            type="submit"
            color="primary"
            size="lg"
            isLoading={saving}
            className="px-8"
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
    </div>
  );
}
