"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  User,
  Upload,
  Save,
  Trash2,
  UserPlus,
  UserMinus,
  Edit,
  Image,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Loader2,
  Camera,
  ImageIcon,
  MessageSquare,
  Repeat,
  Heart,
  Users,
  RefreshCw,
} from "lucide-react";

interface XAccount {
  _id: string;
  username: string;
  userId: string;
  developerTag: string;
  labels: string[];
  createdAt: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  needsReauth: boolean;
  useOwnCredentials?: boolean;
  credentialsVerified?: boolean;
  userAppName?: string;
  appCreatedAt?: string;
  status: "active" | "suspended" | "limited" | "error";
  profileInfo?: {
    name?: string;
    description?: string;
    profile_image_url?: string;
    profile_banner_url?: string;
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
}

interface ActionStats {
  tweets: number;
  retweets: number;
  likes: number;
  follows: number;
  unfollows: number;
}

export default function AccountCustomize() {
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<XAccount | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDeletingTweets, setIsDeletingTweets] = useState(false);
  const [isManagingFollows, setIsManagingFollows] = useState(false);

  // Form states
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [followUsername, setFollowUsername] = useState("");
  const [unfollowUsername, setUnfollowUsername] = useState("");
  const [tweetIdToDelete, setTweetIdToDelete] = useState("");

  // Stats
  const [actionStats, setActionStats] = useState<ActionStats>({
    tweets: 0,
    retweets: 0,
    likes: 0,
    follows: 0,
    unfollows: 0,
  });

  const router = useRouter();

  // Función para obtener opciones de fetch con autenticación
  const getAuthenticatedFetchOptions = (
    options: RequestInit = {}
  ): RequestInit => {
    const { headers = {}, ...otherOptions } = options;

    // Intentar obtener token de localStorage para deploy
    let authToken = null;
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("auth_token");
    }

    return {
      ...otherOptions,
      credentials: "include", // Incluir cookies para localhost
      headers: {
        ...headers,
        // Agregar Authorization header para deploy cross-domain
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    };
  };

  // Verificar rol de usuario
  useEffect(() => {
    fetchUserRole();
  }, []);

  // Cargar cuentas cuando el usuario esté verificado
  useEffect(() => {
    if (userRole === "SUPERADMIN") {
      fetchAccounts();
    } else if (userRole && userRole !== "SUPERADMIN") {
      // Mostrar mensaje de acceso denegado en lugar de redirigir automáticamente
      console.log("Usuario no es SUPERADMIN, rol actual:", userRole);
    }
  }, [userRole, router]);

  // Actualizar formulario cuando se selecciona una cuenta
  useEffect(() => {
    if (selectedAccount) {
      setProfileName(selectedAccount.profileInfo?.name || "");
      setProfileDescription(selectedAccount.profileInfo?.description || "");
      fetchAccountStats(selectedAccount._id);
    }
  }, [selectedAccount]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch(
        "/api/auth/me",
        getAuthenticatedFetchOptions()
      );
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.user?.role || null);
      } else {
        router.push("/login");
      }
    } catch (error) {
      console.error("Error al verificar rol:", error);
      router.push("/login");
    }
  };

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        "/api/debug/accounts",
        getAuthenticatedFetchOptions()
      );
      if (response.ok) {
        const data = await response.json();
        console.log("🔍 Cuentas obtenidas:", data);
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error al cargar cuentas:", error);
      toast.error("Error al cargar las cuentas");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccountStats = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/stats`,
        getAuthenticatedFetchOptions()
      );
      if (response.ok) {
        const data = await response.json();
        setActionStats(
          data.stats || {
            tweets: 0,
            retweets: 0,
            likes: 0,
            follows: 0,
            unfollows: 0,
          }
        );
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  };

  const updateProfile = async () => {
    if (!selectedAccount) return;

    try {
      setIsUpdating(true);

      console.log(
        "🔍 Actualizando perfil para cuenta:",
        selectedAccount.username
      );
      console.log("🔍 Datos a enviar:", {
        name: profileName,
        description: profileDescription,
      });

      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/profile`,
        getAuthenticatedFetchOptions({
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: profileName,
            description: profileDescription,
          }),
        })
      );

      console.log(
        "🔍 Respuesta del servidor:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        toast.success("Perfil actualizado exitosamente");
        fetchAccounts(); // Refrescar datos
      } else {
        const error = await response.json();
        console.error("❌ Error del servidor:", error);
        toast.error(
          error.error || error.message || "Error al actualizar perfil"
        );

        // Si el error es por credenciales faltantes, mostrar información específica
        if (error.missing && error.missing.length > 0) {
          console.error(
            "🔑 Credenciales faltantes para @" + selectedAccount.username + ":",
            error.missing
          );
          toast.error(`Credenciales faltantes: ${error.missing.join(", ")}`);
        }
      }
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      toast.error("Error al actualizar perfil");
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadMedia = async (type: "profile" | "banner") => {
    if (!selectedAccount) return;

    const file = type === "profile" ? profileImage : bannerImage;
    if (!file) return;

    try {
      setIsUploadingMedia(true);
      const formData = new FormData();
      formData.append("media", file);
      formData.append("type", type);

      console.log("🔍 Subiendo media para cuenta:", selectedAccount.username);
      console.log("🔍 Tipo de media:", type);
      console.log("🔍 Archivo:", file.name, file.size, "bytes");

      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/media`,
        getAuthenticatedFetchOptions({
          method: "POST",
          body: formData,
        })
      );

      console.log(
        "🔍 Respuesta del servidor:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        toast.success(
          `${
            type === "profile" ? "Foto de perfil" : "Portada"
          } actualizada exitosamente`
        );
        fetchAccounts(); // Refrescar datos
        if (type === "profile") setProfileImage(null);
        if (type === "banner") setBannerImage(null);
      } else {
        const error = await response.json();
        console.error("❌ Error del servidor:", error);
        toast.error(error.error || error.message || "Error al subir imagen");

        // Manejo específico de errores
        if (error.missing && error.missing.length > 0) {
          console.error(
            "🔑 Credenciales faltantes para @" + selectedAccount.username + ":",
            error.missing
          );
          toast.error(`Credenciales faltantes: ${error.missing.join(", ")}`);
        } else if (error.code === 403) {
          console.error(
            "🚫 Error 403 - Permisos insuficientes para subir " + type
          );
          toast.error(
            "Error de permisos: " +
              (error.details ||
                "La aplicación no tiene permisos para actualizar " +
                  (type === "banner" ? "portadas" : "fotos de perfil"))
          );
        } else if (error.code === 400) {
          console.error("⚠️ Error 400 - Imagen inválida");
          toast.error(
            "Imagen inválida: " +
              (error.details || "Verifica el formato y tamaño")
          );
        } else if (error.code === 429) {
          console.error("⏰ Error 429 - Rate limit");
          toast.error(
            "Límite excedido: " + (error.details || "Espera unos minutos")
          );
        }
      }
    } catch (error) {
      console.error("Error al subir imagen:", error);
      toast.error("Error al subir imagen");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Función para extraer ID del tweet desde URL o ID directo
  const extractTweetId = (input: string): string => {
    if (!input.trim()) return "";

    // Si es una URL, extraer el ID
    const urlMatch = input.match(/status\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Si es solo números, asumir que es el ID
    const numericMatch = input.match(/^\d+$/);
    if (numericMatch) {
      return input.trim();
    }

    return input.trim();
  };

  const deleteTweet = async (tweetId: string) => {
    if (!selectedAccount || !tweetId) return;

    try {
      setIsDeletingTweets(true);
      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/tweet/${tweetId}`,
        getAuthenticatedFetchOptions({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

      if (response.ok) {
        const data = await response.json();
        toast.success("Tweet eliminado exitosamente");
        setTweetIdToDelete(""); // Limpiar el campo
        fetchAccountStats(selectedAccount._id); // Refrescar stats
      } else {
        const error = await response.json();
        toast.error(error.message || "Error al eliminar tweet");
      }
    } catch (error) {
      console.error("Error al eliminar tweet:", error);
      toast.error("Error al eliminar tweet");
    } finally {
      setIsDeletingTweets(false);
    }
  };

  const manageFollow = async (
    action: "follow" | "unfollow",
    username: string
  ) => {
    if (!selectedAccount || !username) return;

    try {
      setIsManagingFollows(true);
      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/follow`,
        getAuthenticatedFetchOptions({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, username }),
        })
      );

      if (response.ok) {
        toast.success(
          `${
            action === "follow" ? "Siguiendo" : "Dejaste de seguir"
          } a @${username}`
        );
        setFollowUsername("");
        setUnfollowUsername("");
        fetchAccountStats(selectedAccount._id); // Refrescar stats
      } else {
        const error = await response.json();
        toast.error(
          error.message ||
            `Error al ${action === "follow" ? "seguir" : "dejar de seguir"}`
        );
      }
    } catch (error) {
      console.error(`Error al ${action}:`, error);
      toast.error(
        `Error al ${action === "follow" ? "seguir" : "dejar de seguir"}`
      );
    } finally {
      setIsManagingFollows(false);
    }
  };

  const getStatusBadge = (account: XAccount) => {
    // Determinar el estado basado en la información de la cuenta
    let status = "active";
    let text = "Activa";
    let icon = CheckCircle;

    if (account.needsReauth) {
      status = "error";
      text = "Necesita Re-auth";
      icon = AlertTriangle;
    } else if (!account.hasAccessToken) {
      status = "limited";
      text = "Sin Token";
      icon = Clock;
    } else if (account.status) {
      status = account.status;
      text =
        account.status === "active"
          ? "Activa"
          : account.status === "suspended"
          ? "Suspendida"
          : account.status === "limited"
          ? "Limitada"
          : "Error";
    }

    const Icon = icon;

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {text}
      </Badge>
    );
  };

  // Verificación de acceso para SUPERADMIN
  if (userRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Debug temporal - mostrar el rol actual
  console.log("Rol de usuario actual:", userRole);

  if (userRole !== "SUPERADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Acceso Denegado</CardTitle>
                <CardDescription>
                  Solo los SUPERADMIN pueden acceder a esta sección
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Tu rol actual:</strong> {userRole || "No definido"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>Requerido:</strong> SUPERADMIN
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                Volver al Dashboard
              </Button>
              <Button
                onClick={() => router.push("/accounts")}
                variant="outline"
                className="flex-1"
              >
                Ver Cuentas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Personalizar Cuentas
          </h1>
          <p className="text-muted-foreground">
            Gestiona perfiles, elimina contenido y administra seguimientos de
            las cuentas
          </p>
        </div>
        <Badge variant="destructive" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          SUPERADMIN ONLY
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selector de Cuenta */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Seleccionar Cuenta
            </CardTitle>
            <CardDescription>
              Elige la cuenta que deseas personalizar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted animate-pulse rounded-lg"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account._id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedAccount?._id === account._id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedAccount(account)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">@{account.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.developerTag}
                        </p>
                      </div>
                      {getStatusBadge(account)}
                    </div>

                    {account.profileInfo && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>
                          Followers:{" "}
                          {account.profileInfo.followers_count?.toLocaleString() ||
                            0}
                        </p>
                        <p>
                          Following:{" "}
                          {account.profileInfo.following_count?.toLocaleString() ||
                            0}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de Personalización */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAccount ? (
            <>
              {/* Información de la Cuenta */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información de la Cuenta: @{selectedAccount.username}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{actionStats.tweets}</p>
                      <p className="text-sm text-muted-foreground">Tweets</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {actionStats.retweets}
                      </p>
                      <p className="text-sm text-muted-foreground">Retweets</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {actionStats.follows}
                      </p>
                      <p className="text-sm text-muted-foreground">Follows</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {selectedAccount.profileInfo?.followers_count || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Followers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editar Perfil */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    Editar Perfil
                  </CardTitle>
                  <CardDescription>
                    Actualiza la información del perfil de Twitter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="profileName">Nombre del Perfil</Label>
                      <Input
                        id="profileName"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Nombre a mostrar"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="profileDescription">Descripción</Label>
                      <Textarea
                        id="profileDescription"
                        value={profileDescription}
                        onChange={(e) => setProfileDescription(e.target.value)}
                        placeholder="Biografía del perfil"
                        maxLength={160}
                        rows={3}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={updateProfile}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Actualizar Perfil
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Subir Imágenes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Imágenes del Perfil
                  </CardTitle>
                  <CardDescription>
                    Actualiza la foto de perfil y la portada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Foto de Perfil */}
                    <div className="space-y-2">
                      <Label htmlFor="profileImage">Foto de Perfil</Label>
                      <Input
                        id="profileImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setProfileImage(e.target.files?.[0] || null)
                        }
                      />
                      <Button
                        onClick={() => uploadMedia("profile")}
                        disabled={!profileImage || isUploadingMedia}
                        variant="outline"
                        className="w-full"
                      >
                        {isUploadingMedia ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Subir Foto de Perfil
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Portada */}
                    <div className="space-y-2">
                      <Label htmlFor="bannerImage">Portada</Label>
                      <Input
                        id="bannerImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setBannerImage(e.target.files?.[0] || null)
                        }
                      />
                      <Button
                        onClick={() => uploadMedia("banner")}
                        disabled={!bannerImage || isUploadingMedia}
                        variant="outline"
                        className="w-full"
                      >
                        {isUploadingMedia ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Image className="h-4 w-4 mr-2" />
                            Subir Portada
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gestión de Tweets */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Eliminar Tweets Específicos
                  </CardTitle>
                  <CardDescription>
                    Elimina un tweet o retweet específico por ID o URL
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tweet ID Input */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tweetId">ID del Tweet o URL</Label>
                      <Input
                        id="tweetId"
                        value={tweetIdToDelete}
                        onChange={(e) => setTweetIdToDelete(e.target.value)}
                        placeholder="Ej: 1234567890123456789 o https://x.com/usuario/status/1234567890123456789"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Puedes pegar la URL completa del tweet o solo el ID
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={
                              isDeletingTweets || !tweetIdToDelete.trim()
                            }
                            className="w-full"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar Tweet
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar este tweet?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará el tweet con ID:{" "}
                              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                                {extractTweetId(tweetIdToDelete)}
                              </code>
                              <br />
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                deleteTweet(extractTweetId(tweetIdToDelete))
                              }
                              className="bg-destructive text-destructive-foreground"
                            >
                              Confirmar Eliminación
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        variant="outline"
                        onClick={() => setTweetIdToDelete("")}
                        disabled={!tweetIdToDelete.trim()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Limpiar
                      </Button>
                    </div>
                  </div>

                  {/* Ejemplo de uso */}
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Cómo encontrar el ID del tweet:
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Copia la URL del tweet desde X.com</li>
                      <li>
                        • El ID está al final: x.com/usuario/status/[ID_AQUÍ]
                      </li>
                      <li>• También puedes pegar la URL completa</li>
                    </ul>
                  </div>

                  {isDeletingTweets && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Eliminando tweet...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gestión de Seguimientos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gestión de Seguimientos
                  </CardTitle>
                  <CardDescription>
                    Seguir y dejar de seguir usuarios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Seguir Usuario */}
                    <div className="space-y-2">
                      <Label htmlFor="followUsername">Seguir Usuario</Label>
                      <div className="flex gap-2">
                        <Input
                          id="followUsername"
                          value={followUsername}
                          onChange={(e) => setFollowUsername(e.target.value)}
                          placeholder="username (sin @)"
                        />
                        <Button
                          onClick={() => manageFollow("follow", followUsername)}
                          disabled={!followUsername || isManagingFollows}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Dejar de Seguir */}
                    <div className="space-y-2">
                      <Label htmlFor="unfollowUsername">Dejar de Seguir</Label>
                      <div className="flex gap-2">
                        <Input
                          id="unfollowUsername"
                          value={unfollowUsername}
                          onChange={(e) => setUnfollowUsername(e.target.value)}
                          placeholder="username (sin @)"
                        />
                        <Button
                          onClick={() =>
                            manageFollow("unfollow", unfollowUsername)
                          }
                          disabled={!unfollowUsername || isManagingFollows}
                          variant="destructive"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isManagingFollows && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Procesando...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Selecciona una Cuenta
                </h3>
                <p className="text-muted-foreground">
                  Elige una cuenta de la lista para comenzar a personalizarla
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
