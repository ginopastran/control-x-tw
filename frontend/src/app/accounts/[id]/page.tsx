"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Check, X, AlertTriangle } from "lucide-react";

interface XAccount {
  _id: string;
  username: string;
  userId: string;
  developerTag: string;
  labels: string[];
  createdAt: string;
  useOwnCredentials: boolean;
  credentialsVerified: boolean;
  preferOAuth2: boolean;
  userAppName?: string;
  userDeveloperEmail?: string;
  appCreatedAt?: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;

  // Indicadores de credenciales OAuth 1.0a
  hasOwnApiKey: boolean;
  hasOwnApiSecret: boolean;
  hasOwnBearerToken: boolean;
  hasOwnAccessToken: boolean;
  hasOwnAccessTokenSecret: boolean;

  // Indicadores de credenciales OAuth 2.0
  hasOwnClientId: boolean;
  hasOwnClientSecret: boolean;
  hasOwnOAuth2AccessToken: boolean;
  hasOwnOAuth2RefreshToken: boolean;
  oauth2TokenExpiresAt?: string;
  oauth2Scopes: string[];
}

export default function EditAccountPage() {
  // Usar useParams() en lugar de use(params)
  const params = useParams();
  const id = params?.id as string;

  const [account, setAccount] = useState<XAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [developerTag, setDeveloperTag] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Estado para cache busting de imágenes
  const [imageUpdateTimestamp, setImageUpdateTimestamp] = useState(Date.now());

  const router = useRouter();

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await fetch(`/api/accounts/${id}`);
        if (!response.ok) {
          throw new Error("Error al cargar la cuenta");
        }
        const data = await response.json();
        setAccount(data.account);
        setLabels(data.account.labels || []);
        setDeveloperTag(data.account.developerTag || "");
        setUsername(data.account.username || "");
      } catch (err) {
        setError("Error al cargar la cuenta. Intente nuevamente.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAccount();
    }
  }, [id]);

  // Verificar disponibilidad del username
  useEffect(() => {
    const checkUsernameAvailability = async () => {
      if (!username || username === account?.username) {
        setUsernameAvailable(null);
        return;
      }

      // Validaciones básicas
      if (
        username.length > 15 ||
        !/^[a-zA-Z0-9_]+$/.test(username) ||
        username.startsWith("_") ||
        username.endsWith("_")
      ) {
        setUsernameAvailable(false);
        return;
      }

      setCheckingUsername(true);
      try {
        const response = await fetch(
          `/api/accounts/check-username?username=${encodeURIComponent(
            username
          )}&excludeId=${id}`
        );
        const data = await response.json();
        setUsernameAvailable(data.available);
      } catch (error) {
        console.error("Error checking username:", error);
        setUsernameAvailable(false);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsernameAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [username, account?.username, id]);

  const handleAddLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()]);
      setNewLabel("");
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setLabels(labels.filter((label) => label !== labelToRemove));
  };

  const handleSave = async () => {
    if (!account) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labels,
          developerTag,
          username,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar los cambios");
      }

      router.push("/accounts");
    } catch (err) {
      setError("Error al guardar los cambios. Intente nuevamente.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la cuenta");
      }

      router.push("/accounts");
    } catch (err) {
      setError("Error al eliminar la cuenta. Intente nuevamente.");
      console.error(err);
    }
  };

  const getCredentialStatus = () => {
    if (!account) return { hasCredentials: false, isComplete: false };

    const hasOAuth1Credentials =
      account.hasOwnApiKey &&
      account.hasOwnApiSecret &&
      account.hasOwnBearerToken &&
      account.hasOwnAccessToken &&
      account.hasOwnAccessTokenSecret;

    const hasOAuth2Credentials =
      account.hasOwnClientId &&
      account.hasOwnClientSecret &&
      account.hasOwnOAuth2AccessToken;

    const hasCredentials = hasOAuth1Credentials || hasOAuth2Credentials;
    const isComplete = account.credentialsVerified;

    return {
      hasCredentials,
      isComplete,
      hasOAuth1Credentials,
      hasOAuth2Credentials,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Cuenta no encontrada</h3>
            <p className="text-muted-foreground mb-6">
              La cuenta que busca no existe o ha sido eliminada.
            </p>
            <Button onClick={() => router.push("/accounts")}>
              Volver a Cuentas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const credentialStatus = getCredentialStatus();

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/accounts">Cuentas</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Editar Cuenta</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center text-red-700">
                <AlertTriangle className="h-5 w-5 mr-2" />
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={`https://unavatar.io/twitter/${account.username}?v=${imageUpdateTimestamp}`}
                    />
                    <AvatarFallback>
                      {account.username?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">
                      @{account.username}
                    </CardTitle>
                    <p className="text-muted-foreground">
                      ID: {account.userId}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/accounts/${id}/api-keys`)}
                  >
                    Configurar API Keys
                  </Button>
                  <Dialog
                    open={isDeleteModalOpen}
                    onOpenChange={setIsDeleteModalOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="destructive">Eliminar</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>¿Eliminar cuenta?</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <p>
                          ¿Estás seguro que deseas eliminar la cuenta{" "}
                          <strong>@{account.username}</strong>? Esta acción no
                          se puede deshacer.
                        </p>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsDeleteModalOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAccount}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Estado de credenciales */}
              <div>
                <h3 className="text-lg font-medium mb-3">
                  Estado de Credenciales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Usa credenciales propias</span>
                    {account.useOwnCredentials ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Credenciales verificadas</span>
                    {credentialStatus.isComplete ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Prefiere OAuth 2.0</span>
                    {account.preferOAuth2 ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Tiene tokens de acceso</span>
                    {account.hasAccessToken ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Campos editables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Nombre de usuario
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Ej: miusuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={
                        usernameAvailable === false
                          ? "border-red-500"
                          : usernameAvailable === true
                          ? "border-green-500"
                          : ""
                      }
                    />
                    {checkingUsername && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  {usernameAvailable === false && (
                    <p className="text-sm text-red-600">
                      Username no disponible o inválido
                    </p>
                  )}
                  {usernameAvailable === true && (
                    <p className="text-sm text-green-600">
                      Username disponible
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tag de desarrollador
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: dev, test, prod"
                    value={developerTag}
                    onChange={(e) => setDeveloperTag(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Etiquetas */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Etiquetas</h3>
                <div className="flex flex-wrap gap-2">
                  {labels.map((label, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => handleRemoveLabel(label)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva etiqueta"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddLabel();
                      }
                    }}
                  />
                  <Button onClick={handleAddLabel}>Agregar</Button>
                </div>
              </div>

              <Separator />

              {/* Información adicional */}
              {account.userAppName && (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    Información de la App
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Nombre de la App
                      </p>
                      <p>{account.userAppName}</p>
                    </div>
                    {account.userDeveloperEmail && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Email del Desarrollador
                        </p>
                        <p>{account.userDeveloperEmail}</p>
                      </div>
                    )}
                    {account.appCreatedAt && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          App creada el
                        </p>
                        <p>
                          {new Date(account.appCreatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push("/accounts")}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || usernameAvailable === false}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
