"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

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
    clientId: "",
    clientSecret: "",
    oauth2AccessToken: "",
    oauth2RefreshToken: "",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    appName: "",
    developerEmail: "",
    username: "",
    preferOAuth2: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación básica
    if (!formData.username.trim()) {
      setError("El username es requerido");
      return;
    }

    if (formData.preferOAuth2) {
      if (!formData.clientId || !formData.clientSecret) {
        setError("Client ID y Client Secret son requeridos para OAuth 2.0");
        return;
      }
    } else {
      if (!formData.apiKey || !formData.apiSecret) {
        setError("API Key y API Secret son requeridos para OAuth 1.0a");
        return;
      }
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Crear la cuenta básica
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

      // Agregar las credenciales
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
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
            oauth2AccessToken: formData.oauth2AccessToken,
            oauth2RefreshToken: formData.oauth2RefreshToken,
            scopes: formData.scopes,
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
      toast.success("Cuenta creada exitosamente");

      setTimeout(() => {
        router.push("/accounts");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
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
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agregar Cuenta con API Keys</h1>
        <p className="text-muted-foreground mt-2">
          Conecta una cuenta de X/Twitter usando tus propias credenciales de API
        </p>
      </div>

      <div className="space-y-6">
        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
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
          </CardContent>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información de la Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username de X</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    placeholder="ejemplo_usuario"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    className="pl-8"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  El username de la cuenta que quieres conectar (sin @)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appName">Nombre de la App</Label>
                <Input
                  id="appName"
                  placeholder="Mi App de Twitter"
                  value={formData.appName}
                  onChange={(e) => handleInputChange("appName", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Nombre descriptivo de tu aplicación
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="developerEmail">Email de Desarrollador</Label>
                <Input
                  id="developerEmail"
                  type="email"
                  placeholder="dev@example.com"
                  value={formData.developerEmail}
                  onChange={(e) =>
                    handleInputChange("developerEmail", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Email asociado a tu cuenta de desarrollador
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tipo de autenticación */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Autenticación</CardTitle>
              <p className="text-sm text-muted-foreground">
                Elige el método de autenticación que prefieres usar
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">OAuth 1.0a</span>
                  <Switch
                    checked={formData.preferOAuth2}
                    onCheckedChange={(checked) =>
                      handleInputChange("preferOAuth2", checked)
                    }
                  />
                  <span className="text-sm font-medium">OAuth 2.0</span>
                </div>
                <Badge
                  variant={formData.preferOAuth2 ? "default" : "secondary"}
                >
                  {formData.preferOAuth2 ? "Recomendado" : "Legacy"}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {formData.preferOAuth2
                  ? "OAuth 2.0 es más moderno, seguro y fácil de implementar. Soporta scopes granulares y refresh tokens."
                  : "OAuth 1.0a es el método tradicional. Requiere más configuración pero es compatible con todas las funciones."}
              </div>
            </CardContent>
          </Card>

          {/* Credenciales */}
          <Card>
            <CardHeader>
              <CardTitle>
                Credenciales{" "}
                {formData.preferOAuth2 ? "OAuth 2.0" : "OAuth 1.0a"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Obtén estas credenciales desde tu app de desarrollador de X
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.preferOAuth2 ? (
                // OAuth 2.0 Fields
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="Tu Client ID de OAuth 2.0"
                      value={formData.clientId}
                      onChange={(e) =>
                        handleInputChange("clientId", e.target.value)
                      }
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Client ID de tu aplicación OAuth 2.0
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Tu Client Secret de OAuth 2.0"
                      value={formData.clientSecret}
                      onChange={(e) =>
                        handleInputChange("clientSecret", e.target.value)
                      }
                      required
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
                      value={formData.oauth2AccessToken}
                      onChange={(e) =>
                        handleInputChange("oauth2AccessToken", e.target.value)
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
                      value={formData.oauth2RefreshToken}
                      onChange={(e) =>
                        handleInputChange("oauth2RefreshToken", e.target.value)
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Token para renovar automáticamente el access token
                    </p>
                  </div>

                  {/* Scopes */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">
                        Scopes Requeridos
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Selecciona los permisos que necesita tu aplicación
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableScopes.map((scope) => (
                        <div
                          key={scope.value}
                          className="border rounded-lg p-3"
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={scope.value}
                              checked={formData.scopes.includes(scope.value)}
                              onCheckedChange={(checked) =>
                                handleScopeChange(
                                  scope.value,
                                  checked as boolean
                                )
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={scope.value}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {scope.label}
                              </label>
                              <p className="text-xs text-muted-foreground mt-1">
                                {scope.description}
                              </p>
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
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      placeholder="Tu API Key"
                      value={formData.apiKey}
                      onChange={(e) =>
                        handleInputChange("apiKey", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiSecret">API Secret</Label>
                    <Input
                      id="apiSecret"
                      type="password"
                      placeholder="Tu API Secret"
                      value={formData.apiSecret}
                      onChange={(e) =>
                        handleInputChange("apiSecret", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bearerToken">Bearer Token (Opcional)</Label>
                    <Input
                      id="bearerToken"
                      placeholder="Tu Bearer Token"
                      value={formData.bearerToken}
                      onChange={(e) =>
                        handleInputChange("bearerToken", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token (Opcional)</Label>
                    <Input
                      id="accessToken"
                      placeholder="Tu Access Token"
                      value={formData.accessToken}
                      onChange={(e) =>
                        handleInputChange("accessToken", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessTokenSecret">
                      Access Token Secret (Opcional)
                    </Label>
                    <Input
                      id="accessTokenSecret"
                      type="password"
                      placeholder="Tu Access Token Secret"
                      value={formData.accessTokenSecret}
                      onChange={(e) =>
                        handleInputChange("accessTokenSecret", e.target.value)
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/accounts")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Guardando..." : "Crear Cuenta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
