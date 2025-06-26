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
  Search,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const [searchQuery, setSearchQuery] = useState("");

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

    setIsUpdating(true);
    try {
      console.log("🔍 Datos a enviar:", {
        name: profileName,
        description: profileDescription,
        accountId: selectedAccount._id,
      });

      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileName,
            description: profileDescription,
          }),
        }
      );

      const data = await response.json();
      console.log("🔍 Respuesta del servidor:", data);

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar perfil");
      }

      toast.success("Perfil actualizado correctamente");
    } catch (error: any) {
      console.error("❌ Error:", error);
      toast.error(error.message || "Error al actualizar perfil");
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

    setIsDeletingTweets(true);
    try {
      console.log("🗑️ Eliminando tweet:", tweetId);

      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/tweet/${tweetId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el tweet");
      }

      toast.success("Tweet eliminado correctamente");
      setTweetIdToDelete("");

      // Actualizar estadísticas
      await fetchAccountStats(selectedAccount._id);
    } catch (error: any) {
      console.error("❌ Error eliminando tweet:", error);
      toast.error(error.message || "Error al eliminar el tweet");
    } finally {
      setIsDeletingTweets(false);
    }
  };

  const deleteRetweet = async (originalTweetId: string) => {
    if (!selectedAccount || !originalTweetId) return;

    setIsDeletingTweets(true);
    try {
      console.log("🔄 Eliminando retweet del tweet:", originalTweetId);

      const response = await fetch(
        `/api/accounts/${selectedAccount._id}/retweet/${originalTweetId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el retweet");
      }

      toast.success("Retweet eliminado correctamente");
      setTweetIdToDelete("");

      // Actualizar estadísticas
      await fetchAccountStats(selectedAccount._id);
    } catch (error: any) {
      console.error("❌ Error eliminando retweet:", error);
      toast.error(error.message || "Error al eliminar el retweet");
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

  // ✅ Función para filtrar cuentas por búsqueda
  const filteredAccounts = accounts.filter(
    (account) =>
      account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.developerTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.labels.some((label) =>
        label.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Header más compacto */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <User className="h-5 w-5 text-gray-700" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Personalizar Cuentas
                </h1>
              </div>
              <p className="text-gray-600 text-sm">
                Gestiona perfiles, elimina contenido y administra seguimientos
                de las cuentas
              </p>
            </div>
            {userRole === "SUPERADMIN" && (
              <Badge variant="destructive" className="text-xs">
                SUPERADMIN ONLY
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel izquierdo - Lista de cuentas más compacta */}
          <div className="lg:col-span-1">
            <Card className="bg-white border border-gray-200 shadow-sm h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-gray-700" />
                  <CardTitle className="text-lg">Seleccionar Cuenta</CardTitle>
                </div>
                <p className="text-sm text-gray-600">
                  Elige la cuenta que deseas personalizar
                </p>

                {/* ✅ Buscador de cuentas */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar cuenta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 border-gray-300 focus:border-gray-400 focus:ring-gray-400 text-sm"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* ✅ Contador de resultados */}
                {searchQuery && (
                  <div className="text-xs text-gray-500 mt-1">
                    {filteredAccounts.length} de {accounts.length} cuentas
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 p-3">
                    {filteredAccounts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {searchQuery
                            ? "No se encontraron cuentas"
                            : "No hay cuentas disponibles"}
                        </p>
                      </div>
                    ) : (
                      filteredAccounts.map((account) => (
                        <div
                          key={account._id}
                          className={`
                            flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200
                            ${
                              selectedAccount?._id === account._id
                                ? "bg-gray-100 border-2 border-gray-300"
                                : "hover:bg-gray-50 border-2 border-transparent"
                            }
                          `}
                          onClick={() => {
                            setSelectedAccount(account);
                            fetchAccountStats(account._id);
                          }}
                        >
                          <Avatar className="w-8 h-8 border border-gray-200">
                            <AvatarFallback className="bg-gray-100 text-gray-700 font-semibold text-sm">
                              {account.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              @{account.username}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {account.developerTag}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                account.status === "active"
                                  ? "bg-green-500"
                                  : account.status === "suspended"
                                  ? "bg-red-500"
                                  : account.status === "limited"
                                  ? "bg-yellow-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            {selectedAccount?._id === account._id && (
                              <div className="w-1 h-4 bg-gray-400 rounded-full ml-1" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Panel derecho - Información de la cuenta */}
          <div className="lg:col-span-2">
            {selectedAccount ? (
              <div className="space-y-4">
                {/* Información básica más compacta */}
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border border-gray-200">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                          {selectedAccount.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          Información de la Cuenta: @{selectedAccount.username}
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                          {selectedAccount.developerTag}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Estadísticas más compactas */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        {
                          label: "Tweets",
                          value: actionStats.tweets,
                          icon: MessageSquare,
                        },
                        {
                          label: "Retweets",
                          value: actionStats.retweets,
                          icon: Repeat,
                        },
                        {
                          label: "Follows",
                          value: actionStats.follows,
                          icon: Users,
                        },
                        {
                          label: "Followers",
                          value:
                            selectedAccount.profileInfo?.followers_count || 0,
                          icon: Heart,
                        },
                      ].map((stat, index) => (
                        <div
                          key={index}
                          className="text-center p-3 bg-gray-50 rounded-lg"
                        >
                          <stat.icon className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                          <div className="text-lg font-bold text-gray-900">
                            {stat.value}
                          </div>
                          <div className="text-xs text-gray-600">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Resto de los componentes con spacing reducido */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Editar Perfil */}
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Edit className="h-5 w-5 text-blue-600" />
                        Editar Perfil
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Actualiza la información del perfil de Twitter
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <Label
                            htmlFor="profile-name"
                            className="text-sm font-medium"
                          >
                            Nombre del Perfil
                          </Label>
                          <Input
                            id="profile-name"
                            placeholder="Nombre a mostrar"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            className="mt-1 border-gray-300 focus:border-gray-400 text-sm"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="profile-bio"
                            className="text-sm font-medium"
                          >
                            Descripción
                          </Label>
                          <Textarea
                            id="profile-bio"
                            placeholder="Biografía del perfil"
                            value={profileDescription}
                            onChange={(e) =>
                              setProfileDescription(e.target.value)
                            }
                            rows={3}
                            className="mt-1 border-gray-300 focus:border-gray-400 text-sm resize-none"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={updateProfile}
                        disabled={isUpdating}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Actualizando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Actualizar Perfil
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Imágenes del Perfil */}
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-green-600" />
                        Imágenes del Perfil
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Actualiza la foto de perfil y la portada
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium">
                            Foto de Perfil
                          </Label>
                          <div className="mt-2 flex flex-col items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setProfileImage(file);
                                }
                              }}
                            />
                            <Button
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    ?.files?.[0];
                                  if (file) {
                                    setProfileImage(file);
                                  }
                                };
                                input.click();
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-gray-300 text-sm"
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Elegir Imagen
                            </Button>
                            {profileImage && (
                              <div className="text-xs text-gray-600 truncate w-full text-center">
                                {profileImage.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Portada</Label>
                          <div className="mt-2 flex flex-col items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setBannerImage(file);
                                }
                              }}
                            />
                            <Button
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    ?.files?.[0];
                                  if (file) {
                                    setBannerImage(file);
                                  }
                                };
                                input.click();
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-gray-300 text-sm"
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Elegir Portada
                            </Button>
                            {bannerImage && (
                              <div className="text-xs text-gray-600 truncate w-full text-center">
                                {bannerImage.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => uploadMedia("profile")}
                          disabled={!profileImage || isUploadingMedia}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-sm"
                        >
                          {isUploadingMedia ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Subir Foto
                        </Button>
                        <Button
                          onClick={() => uploadMedia("banner")}
                          disabled={!bannerImage || isUploadingMedia}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-sm"
                        >
                          {isUploadingMedia ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Subir Portada
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gestión de Tweets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Eliminar Contenido Específico
                    </CardTitle>
                    <CardDescription>
                      Elimina tweets o retweets específicos por ID o URL
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Tabs defaultValue="tweet" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                        <TabsTrigger
                          value="tweet"
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Eliminar Tweet
                        </TabsTrigger>
                        <TabsTrigger
                          value="retweet"
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                        >
                          <Repeat className="h-4 w-4 mr-2" />
                          Eliminar Retweet
                        </TabsTrigger>
                      </TabsList>

                      {/* Tab para eliminar Tweet */}
                      <TabsContent value="tweet" className="space-y-4 mt-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-red-600" />
                            <h4 className="font-medium text-red-900">
                              Eliminar Tweet Propio
                            </h4>
                          </div>
                          <p className="text-sm text-red-700">
                            Solo puedes eliminar tweets que hayas publicado con
                            esta cuenta.
                          </p>
                        </div>

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
                                  Esta acción eliminará permanentemente el tweet
                                  con ID:{" "}
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
                      </TabsContent>

                      {/* Tab para eliminar Retweet */}
                      <TabsContent value="retweet" className="space-y-4 mt-6">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Repeat className="h-4 w-4 text-orange-600" />
                            <h4 className="font-medium text-orange-900">
                              Eliminar Retweet
                            </h4>
                          </div>
                          <p className="text-sm text-orange-700">
                            Elimina un retweet que hayas hecho. Ingresa el ID
                            del tweet original que retweeteaste.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="retweetId">
                            ID del Tweet Original o URL
                          </Label>
                          <Input
                            id="retweetId"
                            value={tweetIdToDelete}
                            onChange={(e) => setTweetIdToDelete(e.target.value)}
                            placeholder="Ej: 1234567890123456789 o https://x.com/usuario/status/1234567890123456789"
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            Ingresa el ID del tweet original que retweeteaste,
                            no el ID de tu retweet
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
                                className="w-full bg-orange-600 hover:bg-orange-700"
                              >
                                <Repeat className="h-4 w-4 mr-2" />
                                Eliminar Retweet
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  ¿Eliminar este retweet?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará tu retweet del tweet con
                                  ID:{" "}
                                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                                    {extractTweetId(tweetIdToDelete)}
                                  </code>
                                  <br />
                                  El tweet original no será afectado.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteRetweet(
                                      extractTweetId(tweetIdToDelete)
                                    )
                                  }
                                  className="bg-orange-600 text-white hover:bg-orange-700"
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
                      </TabsContent>
                    </Tabs>

                    {/* Ejemplo de uso - común para ambos */}
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
                        <li>
                          • Para retweets: usa el ID del tweet original, no del
                          retweet
                        </li>
                      </ul>
                    </div>

                    {isDeletingTweets && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Procesando eliminación...</span>
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
                            onClick={() =>
                              manageFollow("follow", followUsername)
                            }
                            disabled={!followUsername || isManagingFollows}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Dejar de Seguir */}
                      <div className="space-y-2">
                        <Label htmlFor="unfollowUsername">
                          Dejar de Seguir
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="unfollowUsername"
                            value={unfollowUsername}
                            onChange={(e) =>
                              setUnfollowUsername(e.target.value)
                            }
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
              </div>
            ) : (
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="text-center py-12">
                  <div className="bg-gray-50 p-6 rounded-full mx-auto mb-4 w-fit">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Selecciona una Cuenta
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Elige una cuenta de la lista para comenzar a personalizarla
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
