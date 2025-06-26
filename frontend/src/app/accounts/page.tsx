"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildApiUrl } from "@/config/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Search,
  Filter,
  Settings,
  Activity,
  Shield,
  Clock,
  Eye,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  Users,
  BarChart3,
  RefreshCw,
  Download,
  Upload,
  Palette,
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
  tokenInfo?: {
    isValid: boolean;
    expiresAt: string;
    lastRefresh: string;
    hoursToExpiry: number | null;
    status: "VALID" | "NEEDS_REFRESH" | "EXPIRED" | "INVALID";
  };
}

interface DebugData {
  stats: {
    total: number;
    valid: number;
    needsRefresh: number;
    expired: number;
    invalid: number;
    needsReauth: number;
  };
  accounts: XAccount[];
}

interface RateLimitData {
  // Add appropriate properties for RateLimitData
}

interface TestResult {
  accountId: string;
  username: string;
  status: "success" | "error" | "warning";
  message: string;
  details: {
    hasTokens: boolean;
    tokenValid: boolean;
    apiAccess: boolean;
    rateLimitStatus?: string;
    lastError?: string;
  };
}

interface TestResponse {
  success: boolean;
  summary: {
    total: number;
    success: number;
    warnings: number;
    errors: number;
  };
  results: TestResult[];
  testedAt: string;
}

export default function AccountsPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<XAccount | null>(null);
  const [rateLimitData, setRateLimitData] = useState<RateLimitData | null>(
    null
  );
  const [loadingRateLimits, setLoadingRateLimits] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [labelsToDelete, setLabelsToDelete] = useState<string[]>([]);
  const [deletingLabels, setDeletingLabels] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [testingAccounts, setTestingAccounts] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isVisible, setIsVisible] = useState(false);
  const [mutualFollowCampaign, setMutualFollowCampaign] = useState<any>(null);
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [isMutualFollowDialogOpen, setIsMutualFollowDialogOpen] =
    useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchAccountsData();
    fetchUserRole();
    fetchMutualFollowCampaignStatus();
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  // Fetch periódico del estado de la campaña
  useEffect(() => {
    if (mutualFollowCampaign?.isRunning) {
      const interval = setInterval(fetchMutualFollowCampaignStatus, 30000); // Cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [mutualFollowCampaign?.isRunning]);

  useEffect(() => {
    if (debugData) {
      // Extraer todas las etiquetas únicas
      const allLabels = new Set<string>();
      debugData.accounts.forEach((account) => {
        account.labels.forEach((label) => allLabels.add(label));
      });
      setAvailableLabels(Array.from(allLabels).sort());
    }
  }, [debugData]);

  const fetchAccountsData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/accounts");
      if (!response.ok) {
        throw new Error("Error al cargar las cuentas");
      }
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError("Error al cargar las cuentas. Intente nuevamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        const role = data.user?.role || null;
        console.log(
          "🔍 Debug - Rol obtenido:",
          role,
          "Tipo:",
          typeof role,
          "Data completa:",
          data
        );
        setUserRole(role);
      }
    } catch (err) {
      console.error("Error al obtener rol del usuario:", err);
    }
  };

  const fetchMutualFollowCampaignStatus = async () => {
    try {
      const response = await fetch("/api/mutual-follow-campaign");
      if (response.ok) {
        const data = await response.json();
        setMutualFollowCampaign(data);
      }
    } catch (err) {
      console.error("Error al obtener estado de campaña:", err);
    }
  };

  const startMutualFollowCampaign = async () => {
    try {
      setIsStartingCampaign(true);
      const response = await fetch("/api/mutual-follow-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setMutualFollowCampaign(data.campaign);
        setIsMutualFollowDialogOpen(false);
        // Mostrar notificación de éxito
        alert(
          `Campaña iniciada exitosamente! Se ejecutarán ${data.campaign.progress.total} acciones de follow distribuidas en 5 días.`
        );
      } else {
        throw new Error(data.error || "Error al iniciar campaña");
      }
    } catch (err) {
      console.error("Error al iniciar campaña:", err);
      alert("Error al iniciar la campaña. Intente nuevamente.");
    } finally {
      setIsStartingCampaign(false);
    }
  };

  const cancelMutualFollowCampaign = async () => {
    if (
      confirm("¿Estás seguro que deseas cancelar la campaña de follow mutuo?")
    ) {
      try {
        const response = await fetch("/api/mutual-follow-campaign", {
          method: "DELETE",
        });

        if (response.ok) {
          const data = await response.json();
          setMutualFollowCampaign(null);
          alert(
            `Campaña cancelada. ${
              data.canceledActions || 0
            } acciones pendientes fueron removidas.`
          );
        }
      } catch (err) {
        console.error("Error al cancelar campaña:", err);
        alert("Error al cancelar la campaña.");
      }
    }
  };

  const testAllAccounts = async () => {
    try {
      setTestingAccounts(true);
      setTestProgress(0);
      setTestResults(null);

      console.log("🧪 Iniciando test de todas las cuentas...");

      // Usar el endpoint proxy local que se conecta al backend
      const response = await fetch("/api/accounts/test-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Esto incluye las cookies automáticamente
      });

      if (!response.ok) {
        throw new Error("Error al testear las cuentas");
      }

      const data = await response.json();
      setTestResults(data);
      setTestProgress(100);

      console.log("✅ Test completado:", data);
    } catch (err) {
      console.error("❌ Error al testear cuentas:", err);
      alert("Error al testear las cuentas. Intente nuevamente.");
    } finally {
      setTestingAccounts(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm("¿Estás seguro que deseas eliminar esta cuenta?")) {
      try {
        const response = await fetch(`/api/accounts/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Error al eliminar la cuenta");
        }

        await fetchAccountsData();
      } catch (err) {
        setError("Error al eliminar la cuenta. Intente nuevamente.");
        console.error(err);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VALID":
        return "default";
      case "NEEDS_REFRESH":
        return "secondary";
      case "EXPIRED":
        return "destructive";
      case "INVALID":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "VALID":
        return "Válido";
      case "NEEDS_REFRESH":
        return "Necesita Refresh";
      case "EXPIRED":
        return "Expirado";
      case "INVALID":
        return "Inválido";
      default:
        return "Desconocido";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALID":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "NEEDS_REFRESH":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "EXPIRED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "INVALID":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Filtros
  const filteredAccounts =
    debugData?.accounts.filter((account) => {
      const matchesSearch =
        account.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.developerTag.toLowerCase().includes(searchTerm.toLowerCase());

      if (filterStatus === "all") return matchesSearch;

      const status = account.tokenInfo?.status || "unknown";
      return (
        matchesSearch && status.toLowerCase() === filterStatus.toLowerCase()
      );
    }) || [];

  // Verificar si el usuario es ADMIN (no SUPERADMIN) y ocultar la página
  if (userRole === "ADMIN") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="max-w-md shadow-2xl border-0 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
          <CardContent className="text-center py-12">
            <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-full mx-auto mb-6 w-fit">
              <Shield className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground mb-6">
              Esta página solo está disponible para usuarios SUPERADMIN.
            </p>
            <Button
              onClick={() => router.push("/dashboard")}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 hover:scale-105"
            >
              Ir al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm mb-4">
            <Users className="h-8 w-8 text-gray-400 mx-auto" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
            <span className="text-gray-700 font-medium">
              Cargando cuentas...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header limpio y moderno */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-gray-700" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Cuentas Conectadas
                </h1>
              </div>
              <p className="text-gray-600">
                Gestiona tus cuentas de X y su estado de autenticación
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAccountsData}
                className="border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button
                onClick={() => setIsTestDialogOpen(true)}
                variant="outline"
                size="sm"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Activity className="h-4 w-4 mr-2" />
                Testear
              </Button>
              <Button
                onClick={() => router.push("/accounts/customize")}
                variant="outline"
                size="sm"
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Palette className="h-4 w-4 mr-2" />
                Personalizar
              </Button>
              {debugData && debugData.accounts.length >= 2 && (
                <Button
                  onClick={() => setIsMutualFollowDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Follow Mutuo (Debug)
                </Button>
              )}
              {mutualFollowCampaign?.isRunning && (
                <Button
                  onClick={cancelMutualFollowCampaign}
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar Campaña
                </Button>
              )}
              <Button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Conectar Cuenta
              </Button>
            </div>
          </div>

          {/* Controles de búsqueda */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 focus:border-gray-400 focus:ring-gray-400"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:border-gray-400 focus:outline-none bg-white text-gray-700"
            >
              <option value="all">Todos los estados</option>
              <option value="valid">Válidos</option>
              <option value="needs_refresh">Necesita Refresh</option>
              <option value="expired">Expirados</option>
              <option value="invalid">Inválidos</option>
            </select>
          </div>
        </div>

        {/* Estadísticas limpias */}
        {debugData && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: "Total", value: debugData.stats.total, color: "gray" },
              {
                label: "Válidas",
                value: debugData.stats.valid,
                color: "green",
              },
              {
                label: "Refresh",
                value: debugData.stats.needsRefresh,
                color: "yellow",
              },
              {
                label: "Expiradas",
                value: debugData.stats.expired,
                color: "red",
              },
              {
                label: "Inválidas",
                value: debugData.stats.invalid,
                color: "red",
              },
              {
                label: "Re-auth",
                value: debugData.stats.needsReauth,
                color: "purple",
              },
            ].map((stat, index) => (
              <Card
                key={index}
                className="bg-white border border-gray-200 shadow-sm"
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estado de campaña limpio */}
        {mutualFollowCampaign?.isRunning && (
          <Card className="bg-green-50 border border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-green-600 animate-pulse" />
                  <span className="font-semibold text-green-900">
                    Campaña Follow Mutuo en Curso
                  </span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    {mutualFollowCampaign.currentPhase}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-green-800">
                  {mutualFollowCampaign.progress.completed}/
                  {mutualFollowCampaign.progress.total}
                </div>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (mutualFollowCampaign.progress.completed /
                        mutualFollowCampaign.progress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla principal limpia */}
        {debugData && debugData.accounts.length === 0 ? (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="text-center py-16">
              <div className="bg-gray-50 p-6 rounded-full mx-auto mb-6 w-fit">
                <Users className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No hay cuentas conectadas
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Conecta tu primera cuenta de X para comenzar a gestionar tus
                acciones.
              </p>
              <Button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Conectar Primera Cuenta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-200 py-4">
              <CardTitle className="text-lg font-semibold text-gray-900">
                {filteredAccounts.length} de {debugData?.accounts.length || 0}{" "}
                cuentas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200 bg-gray-50">
                      <TableHead className="font-semibold text-gray-700 py-3">
                        Cuenta
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Desarrollador
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Estado
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Expiración
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Etiquetas
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 text-center">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account, index) => (
                      <TableRow
                        key={account._id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border border-gray-200">
                              <AvatarImage
                                src={`https://unavatar.io/twitter/${account.username}`}
                                alt={`@${account.username}`}
                              />
                              <AvatarFallback className="bg-gray-100 text-gray-700 font-semibold">
                                {account.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-gray-900">
                                @{account.username}
                              </div>
                              <div className="text-sm text-gray-500 font-mono">
                                {account.userId?.substring(0, 12)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-sm text-gray-700 max-w-32 truncate">
                            {account.developerTag}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {account.tokenInfo ? (
                            <Badge
                              variant={
                                account.tokenInfo.status === "VALID"
                                  ? "default"
                                  : account.tokenInfo.status === "NEEDS_REFRESH"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="font-medium"
                            >
                              {account.tokenInfo.status === "VALID"
                                ? "Válido"
                                : account.tokenInfo.status === "NEEDS_REFRESH"
                                ? "Refresh"
                                : account.tokenInfo.status === "EXPIRED"
                                ? "Expirado"
                                : "Inválido"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Sin info
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {(() => {
                            const tokenInfo = account.tokenInfo;
                            return tokenInfo?.hoursToExpiry !== null &&
                              tokenInfo?.hoursToExpiry !== undefined ? (
                              <div className="text-sm">
                                <div
                                  className={`font-medium ${
                                    tokenInfo.hoursToExpiry < 1
                                      ? "text-red-600"
                                      : tokenInfo.hoursToExpiry < 24
                                      ? "text-yellow-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {tokenInfo.hoursToExpiry > 0
                                    ? `${tokenInfo.hoursToExpiry}h`
                                    : "Expirado"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {tokenInfo.expiresAt &&
                                    new Date(
                                      tokenInfo.expiresAt
                                    ).toLocaleDateString("es-ES")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="max-w-40">
                            {(account.labels || []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {account.labels
                                  .slice(0, 2)
                                  .map((label, labelIndex) => (
                                    <Badge
                                      key={labelIndex}
                                      variant="outline"
                                      className="text-xs border-gray-300 text-gray-600"
                                    >
                                      {label}
                                    </Badge>
                                  ))}
                                {account.labels.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{account.labels.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Sin etiquetas
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAccount(account);
                                setIsDetailModalOpen(true);
                              }}
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/accounts/${account._id}`)
                              }
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAccount(account._id)}
                              className="h-8 w-8 p-0 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de detalles mejorado */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                    {selectedAccount?.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    Detalles de @{selectedAccount?.username}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Información completa de la cuenta
                  </p>
                </div>
              </div>
            </DialogHeader>
            {selectedAccount && (
              <div className="space-y-6">
                {/* Información básica */}
                <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Información Básica
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Usuario:
                          </span>
                          <span className="font-medium">
                            @{selectedAccount.username}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID:</span>
                          <span className="font-mono text-xs">
                            {selectedAccount.userId}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Desarrollador:
                          </span>
                          <span className="font-medium">
                            {selectedAccount.developerTag}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Conectado:
                          </span>
                          <span className="font-medium">
                            {new Date(
                              selectedAccount.createdAt
                            ).toLocaleDateString("es-ES")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Estado de tokens */}
                <Card className="border-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      Estado de Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              selectedAccount.hasAccessToken
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span className="font-medium">Access Token</span>
                        </div>
                        <Badge
                          variant={
                            selectedAccount.hasAccessToken
                              ? "default"
                              : "destructive"
                          }
                        >
                          {selectedAccount.hasAccessToken
                            ? "Presente"
                            : "Ausente"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              selectedAccount.hasRefreshToken
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span className="font-medium">Refresh Token</span>
                        </div>
                        <Badge
                          variant={
                            selectedAccount.hasRefreshToken
                              ? "default"
                              : "destructive"
                          }
                        >
                          {selectedAccount.hasRefreshToken
                            ? "Presente"
                            : "Ausente"}
                        </Badge>
                      </div>
                      {selectedAccount.tokenInfo && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(selectedAccount.tokenInfo.status)}
                              <span className="font-medium">Estado</span>
                            </div>
                            <Badge
                              variant={getStatusColor(
                                selectedAccount.tokenInfo.status
                              )}
                            >
                              {getStatusText(selectedAccount.tokenInfo.status)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                              <div className="text-muted-foreground mb-1">
                                Último refresh
                              </div>
                              <div className="font-medium">
                                {new Date(
                                  selectedAccount.tokenInfo.lastRefresh
                                ).toLocaleString("es-ES")}
                              </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                              <div className="text-muted-foreground mb-1">
                                Expira
                              </div>
                              <div className="font-medium">
                                {new Date(
                                  selectedAccount.tokenInfo.expiresAt
                                ).toLocaleString("es-ES")}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Etiquetas */}
                {selectedAccount.labels &&
                  selectedAccount.labels.length > 0 && (
                    <Card className="border-0 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Settings className="h-5 w-5 text-purple-600" />
                          Etiquetas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedAccount.labels.map((label, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="transition-all duration-200 hover:scale-105"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDetailModalOpen(false)}
                className="hover:scale-105 transition-transform duration-200"
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de campaña de follow mutuo */}
        <Dialog
          open={isMutualFollowDialogOpen}
          onOpenChange={setIsMutualFollowDialogOpen}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-full">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    🤝 Campaña de Follow Mutuo
                  </DialogTitle>
                  <p className="text-sm text-gray-600">
                    Hacer que todas las cuentas verificadas se sigan entre ellas
                    automáticamente
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Información de la campaña */}
              <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardContent className="p-6">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-blue-900">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    📊 Resumen de la Campaña
                  </h4>

                  {debugData && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="text-gray-600 text-sm mb-1">
                          🏢 Cuentas Participantes
                        </div>
                        <div className="font-bold text-2xl text-blue-600">
                          {
                            debugData.accounts.filter(
                              (acc) => acc.useOwnCredentials
                            ).length
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          cuentas verificadas
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-gray-600 text-sm mb-1">
                          👥 Total de Follows
                        </div>
                        <div className="font-bold text-2xl text-green-600">
                          {debugData.accounts.filter(
                            (acc) => acc.useOwnCredentials
                          ).length *
                            (debugData.accounts.filter(
                              (acc) => acc.useOwnCredentials
                            ).length -
                              1)}
                        </div>
                        <div className="text-xs text-gray-500">
                          acciones programadas
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <div className="text-gray-600 text-sm mb-1">
                          ⏱️ Duración
                        </div>
                        <div className="font-bold text-2xl text-purple-600">
                          4 días
                        </div>
                        <div className="text-xs text-gray-500">
                          distribución inteligente
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <div className="text-gray-600 text-sm mb-1">
                          🔒 Límites API
                        </div>
                        <div className="font-bold text-lg text-orange-600">
                          50/día
                        </div>
                        <div className="text-xs text-gray-500">
                          respeta límites de Twitter
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Advertencias y consideraciones */}
              <Card className="border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
                <CardContent className="p-6">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    ⚠️ Consideraciones Importantes
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-yellow-200">
                      <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">1</span>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-900 mb-1">
                          🔒 Límites de Twitter API
                        </div>
                        <div className="text-sm text-gray-700">
                          Se respetan límites de 50 follows por día según
                          Twitter API v2. Las acciones se distribuyen para
                          evitar suspensiones.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-blue-200">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">2</span>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-900 mb-1">
                          ⏰ Distribución Natural
                        </div>
                        <div className="text-sm text-gray-700">
                          Las acciones se ejecutan durante 4 días entre 9 AM - 9
                          PM con delays aleatorios para simular comportamiento
                          humano.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-green-200">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">3</span>
                      </div>
                      <div>
                        <div className="font-semibold text-green-900 mb-1">
                          ✅ Solo Cuentas Verificadas
                        </div>
                        <div className="text-sm text-gray-700">
                          Solo participan cuentas con credenciales propias
                          verificadas y funcionando correctamente.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-red-200">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">4</span>
                      </div>
                      <div>
                        <div className="font-semibold text-red-900 mb-1">
                          🚫 Control de Errores
                        </div>
                        <div className="text-sm text-gray-700">
                          Si las cuentas ya se siguen o hay errores menores, la
                          campaña continúa sin interrupciones.
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de cuentas que participarán */}
              {debugData && (
                <Card className="border-0 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50">
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Cuentas Participantes
                    </h4>

                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {debugData.accounts
                          .filter((acc) => acc.useOwnCredentials)
                          .map((account, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg"
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                                  {account.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                @{account.username}
                              </span>
                              <Badge
                                variant="secondary"
                                className="ml-auto text-xs"
                              >
                                Verificada
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter className="flex gap-4 pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setIsMutualFollowDialogOpen(false)}
                className="flex-1 border-gray-300 hover:bg-gray-50 transition-all duration-200"
                disabled={isStartingCampaign}
              >
                ❌ Cancelar
              </Button>
              <Button
                onClick={startMutualFollowCampaign}
                disabled={
                  isStartingCampaign ||
                  !debugData ||
                  debugData.accounts.filter((acc) => acc.useOwnCredentials)
                    .length < 2
                }
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStartingCampaign ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    🚀 Iniciando Campaña...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    🚀 ¡Iniciar Campaña de Follow Mutuo!
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de agregar cuenta mejorado */}
        <Dialog
          open={isAddAccountModalOpen}
          onOpenChange={setIsAddAccountModalOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    Conectar Nueva Cuenta
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Elige el método de conexión preferido
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4">
                <Card
                  className="cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                  onClick={() => {
                    setIsAddAccountModalOpen(false);
                    router.push("/api/auth/x/login");
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                        <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
                          OAuth 2.0 (Recomendado)
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          Conecta tu cuenta de forma segura usando el flujo
                          oficial de X.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600">
                            Más seguro y confiable
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer border-2 border-transparent hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
                  onClick={() => {
                    setIsAddAccountModalOpen(false);
                    router.push("/accounts/new/api-keys");
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                        <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2 text-purple-900 dark:text-purple-100">
                          Claves de Desarrollador
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          Usa tus propias credenciales de la app de
                          desarrollador de X.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span className="text-xs text-yellow-600">
                            Requiere configuración manual
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddAccountModalOpen(false)}
                className="hover:scale-105 transition-transform duration-200"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de testing de cuentas */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    Test de Conexión de Cuentas
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Verificar el estado de las credenciales y conexión API
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Información del test */}
              <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Información del Test
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Verificaciones:
                      </span>
                      <div className="font-semibold text-blue-600">
                        • Credenciales OAuth
                        <br />
                        • Validez de tokens
                        <br />• Acceso a API de X
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Duración estimada:
                      </span>
                      <div className="font-semibold text-green-600">
                        {debugData?.accounts.length
                          ? `~${Math.ceil(
                              debugData.accounts.length * 0.5
                            )} segundos`
                          : "Calculando..."}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progreso del test */}
              {testingAccounts && (
                <Card className="border-0 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                      <h4 className="font-semibold">Testing en Progreso...</h4>
                    </div>
                    <Progress value={testProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Verificando credenciales y conectividad...
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Resultados del test */}
              {testResults && (
                <div className="space-y-4">
                  {/* Resumen */}
                  <Card className="border-0 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50">
                    <CardContent className="p-6">
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Resumen del Test
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {testResults.summary.total}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {testResults.summary.success}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Exitosos
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {testResults.summary.warnings}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Advertencias
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {testResults.summary.errors}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Errores
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detalles por cuenta */}
                  <Card className="border-0 bg-gradient-to-r from-white to-gray-50 dark:from-slate-900 dark:to-slate-800">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Resultados por Cuenta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-64">
                        <div className="space-y-2 p-6">
                          {testResults.results.map((result, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-3 p-3 rounded-lg ${
                                result.status === "success"
                                  ? "bg-green-50 dark:bg-green-900/20"
                                  : result.status === "warning"
                                  ? "bg-yellow-50 dark:bg-yellow-900/20"
                                  : "bg-red-50 dark:bg-red-900/20"
                              }`}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarFallback
                                  className={`text-white text-sm ${
                                    result.status === "success"
                                      ? "bg-green-500"
                                      : result.status === "warning"
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                >
                                  {result.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">
                                  @{result.username}
                                </div>
                                <div
                                  className={`text-sm ${
                                    result.status === "success"
                                      ? "text-green-700 dark:text-green-300"
                                      : result.status === "warning"
                                      ? "text-yellow-700 dark:text-yellow-300"
                                      : "text-red-700 dark:text-red-300"
                                  }`}
                                >
                                  {result.message}
                                </div>
                                {result.details.lastError && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {result.details.lastError}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {result.details.hasTokens && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Tokens
                                  </Badge>
                                )}
                                {result.details.apiAccess && (
                                  <Badge variant="default" className="text-xs">
                                    API
                                  </Badge>
                                )}
                                <Badge
                                  variant={
                                    result.status === "success"
                                      ? "default"
                                      : result.status === "warning"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-xs"
                                >
                                  {result.status === "success"
                                    ? "OK"
                                    : result.status === "warning"
                                    ? "WARN"
                                    : "ERROR"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsTestDialogOpen(false)}
                className="hover:scale-105 transition-transform duration-200"
              >
                Cerrar
              </Button>
              <Button
                onClick={testAllAccounts}
                disabled={testingAccounts}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200 hover:scale-105"
              >
                {testingAccounts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Iniciar Test
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
