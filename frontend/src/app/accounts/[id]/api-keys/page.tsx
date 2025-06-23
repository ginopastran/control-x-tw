"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { Loader2, AlertTriangle, Check, X, ArrowLeft } from "lucide-react";

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
  const [isClient, setIsClient] = useState(false);

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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (accountId && isClient) {
      fetchAccountData();
    }
  }, [accountId, isClient]);

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

  // Evitar problemas de hidratación esperando a que el cliente se monte
  if (!isClient) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-lg font-medium">Cargando cuenta...</span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center p-6">
            <h1 className="text-xl font-bold mb-4">Cuenta no encontrada</h1>
            <Button onClick={() => router.push("/accounts")}>
              Volver a cuentas
            </Button>
          </CardContent>
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
            variant="ghost"
            size="sm"
            onClick={() => router.push("/accounts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">🔑 Configurar API Keys</h1>
            <p className="text-muted-foreground text-lg">
              Cuenta: @{account.username} •{" "}
              {account.useOwnCredentials
                ? "Usando credenciales propias"
                : "Usando credenciales compartidas"}
            </p>
          </div>
        </div>

        {account.useOwnCredentials && account.credentialsVerified && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-800">
                  ✓ Configurado
                </Badge>
                <div>
                  <div className="font-medium text-green-800">
                    Esta cuenta usa sus propias API keys
                  </div>
                  <div className="text-sm text-green-600">
                    App: {account.userAppName || "Sin nombre"} • Rate limits
                    independientes
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {account.useOwnCredentials && (
          <Alert className="mt-4 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">🔒 Credenciales protegidas</div>
              <div className="text-sm mt-1">
                Tus credenciales están encriptadas y seguras. Para actualizar,
                ingresa nuevos valores en los campos correspondientes.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Instrucciones */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl font-bold">📋 Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">
              1. Crea tu aplicación en Twitter
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Ve a{" "}
              <Link
                href="https://developer.twitter.com/en/portal/dashboard"
                target="_blank"
                className="text-primary underline"
              >
                developer.twitter.com
              </Link>{" "}
              y:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
              <li>Aplica para una cuenta de desarrollador</li>
              <li>Crea una nueva aplicación</li>
              <li>Obtén tus API Key, API Secret y Bearer Token</li>
              <li>Configura permisos de lectura y escritura</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">
              2. Beneficios de usar tus propias keys
            </h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
              <li>
                🔒 Rate limits independientes (17 tweets/día solo para ti)
              </li>
              <li>⚡ Sin necesidad de refresh tokens</li>
              <li>📊 Control total sobre tu aplicación</li>
              <li>🎯 No dependes de límites compartidos</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              📝 Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  placeholder="Nombre de tu app"
                  value={generalData.appName}
                  onChange={(e) =>
                    handleGeneralChange("appName", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Nombre de tu aplicación en el portal de desarrollador
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="developerEmail">Developer Email</Label>
                <Input
                  id="developerEmail"
                  placeholder="tu@email.com"
                  type="email"
                  value={generalData.developerEmail}
                  onChange={(e) =>
                    handleGeneralChange("developerEmail", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Email asociado a tu cuenta de desarrollador
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OAuth 1.0a Section */}
        <Card>
          <CardHeader className="bg-orange-50">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-orange-600">
                OAuth 1.0a
              </div>
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800"
              >
                Legacy
              </Badge>
            </div>
            <p className="text-orange-700 text-sm mt-2">
              Método tradicional de autenticación. Requiere API Key y API
              Secret.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key (Consumer Key) *</Label>
                <Input
                  id="apiKey"
                  placeholder="Tu API Key"
                  value={oauth1FormData.apiKey}
                  onChange={(e) => handleOAuth1Change("apiKey", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Consumer Key de tu app de X
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiSecret">
                  API Secret (Consumer Secret) *
                </Label>
                <Input
                  id="apiSecret"
                  placeholder="Tu API Secret"
                  type="password"
                  value={oauth1FormData.apiSecret}
                  onChange={(e) =>
                    handleOAuth1Change("apiSecret", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Consumer Secret de tu app de X
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bearerToken">Bearer Token (Opcional)</Label>
                <Input
                  id="bearerToken"
                  placeholder="Tu Bearer Token"
                  value={oauth1FormData.bearerToken}
                  onChange={(e) =>
                    handleOAuth1Change("bearerToken", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Para operaciones que no requieren autenticación de usuario
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token (Opcional)</Label>
                <Input
                  id="accessToken"
                  placeholder="Tu Access Token"
                  value={oauth1FormData.accessToken}
                  onChange={(e) =>
                    handleOAuth1Change("accessToken", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Token de acceso OAuth 1.0a
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="accessTokenSecret">
                  Access Token Secret (Opcional)
                </Label>
                <Input
                  id="accessTokenSecret"
                  placeholder="Tu Access Token Secret"
                  type="password"
                  value={oauth1FormData.accessTokenSecret}
                  onChange={(e) =>
                    handleOAuth1Change("accessTokenSecret", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Secret del token de acceso
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OAuth 2.0 Section */}
        <Card>
          <CardHeader className="bg-green-50">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-green-600">OAuth 2.0</div>
              <Badge className="bg-green-100 text-green-800">Recomendado</Badge>
            </div>
            <p className="text-green-700 text-sm mt-2">
              Método moderno y seguro. Soporta scopes granulares y renovación
              automática.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID *</Label>
                <Input
                  id="clientId"
                  placeholder="Tu Client ID de OAuth 2.0"
                  value={oauth2FormData.clientId}
                  onChange={(e) =>
                    handleOAuth2Change("clientId", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Client ID de tu aplicación OAuth 2.0
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret *</Label>
                <Input
                  id="clientSecret"
                  placeholder="Tu Client Secret de OAuth 2.0"
                  type="password"
                  value={oauth2FormData.clientSecret}
                  onChange={(e) =>
                    handleOAuth2Change("clientSecret", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Client Secret de tu aplicación OAuth 2.0
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="oauth2AccessToken">
                  Access Token (Opcional)
                </Label>
                <Input
                  id="oauth2AccessToken"
                  placeholder="Token de acceso OAuth 2.0"
                  value={oauth2FormData.oauth2AccessToken}
                  onChange={(e) =>
                    handleOAuth2Change("oauth2AccessToken", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Si ya tienes un token de acceso, puedes incluirlo aquí
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="oauth2RefreshToken">
                  Refresh Token (Opcional)
                </Label>
                <Input
                  id="oauth2RefreshToken"
                  placeholder="Token de renovación OAuth 2.0"
                  value={oauth2FormData.oauth2RefreshToken}
                  onChange={(e) =>
                    handleOAuth2Change("oauth2RefreshToken", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Token para renovar automáticamente el access token
                </p>
              </div>
            </div>

            <Separator />

            {/* Scopes */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  🔐 Scopes Requeridos
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecciona los permisos que necesita tu aplicación OAuth 2.0
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableScopes.map((scope) => (
                  <div key={scope.value} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={oauth2FormData.scopes.includes(scope.value)}
                        onCheckedChange={(checked) =>
                          handleScopeChange(scope.value, checked as boolean)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{scope.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {scope.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                          {scope.value}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-4 pt-6">
          <Button type="submit" className="px-8" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {account.useOwnCredentials
              ? "Actualizar Credenciales"
              : "Guardar y Activar"}
          </Button>

          {account.useOwnCredentials && (
            <Button
              variant="destructive"
              onClick={handleRemoveCredentials}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar Credenciales Propias
            </Button>
          )}

          <Button variant="ghost" onClick={() => router.push("/accounts")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
