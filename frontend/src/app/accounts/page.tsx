"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

  const router = useRouter();

  useEffect(() => {
    fetchAccountsData();
    fetchUserRole();
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100);
  }, []);

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
        setUserRole(data.user?.role || null);
      }
    } catch (err) {
      console.error("Error al obtener rol del usuario:", err);
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-full animate-pulse">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-lg font-medium">Cargando cuentas...</span>
          </div>
          <div className="w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={`max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Header mejorado */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full animate-pulse">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Cuentas de X Conectadas
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Gestiona tus cuentas conectadas y su estado de autenticación
            </p>
          </div>

          {/* Controles superiores */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-8">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cuentas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-80 border-2 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-md focus:border-blue-500 focus:outline-none transition-all duration-200 bg-white dark:bg-slate-800"
              >
                <option value="all">Todos los estados</option>
                <option value="valid">Válidos</option>
                <option value="needs_refresh">Necesita Refresh</option>
                <option value="expired">Expirados</option>
                <option value="invalid">Inválidos</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={fetchAccountsData}
                className="hover:scale-105 transition-transform duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Conectar Cuenta
              </Button>
            </div>
          </div>
        </div>

        {/* Estadísticas mejoradas */}
        {debugData && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              {
                label: "Total",
                value: debugData.stats.total,
                color: "blue",
                icon: Users,
              },
              {
                label: "Válidas",
                value: debugData.stats.valid,
                color: "green",
                icon: CheckCircle2,
              },
              {
                label: "Refresh",
                value: debugData.stats.needsRefresh,
                color: "yellow",
                icon: RefreshCw,
              },
              {
                label: "Expiradas",
                value: debugData.stats.expired,
                color: "red",
                icon: XCircle,
              },
              {
                label: "Inválidas",
                value: debugData.stats.invalid,
                color: "red",
                icon: AlertTriangle,
              },
              {
                label: "Re-auth",
                value: debugData.stats.needsReauth,
                color: "purple",
                icon: Shield,
              },
            ].map((stat, index) => (
              <Card
                key={index}
                className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 transition-all duration-500 hover:shadow-2xl hover:scale-105 stat-card"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <CardContent className="text-center py-6">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/20`}
                  >
                    <stat.icon
                      className={`h-6 w-6 text-${stat.color}-600 dark:text-${stat.color}-400`}
                    />
                  </div>
                  <div
                    className={`text-3xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400 mb-1`}
                  >
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="mb-6 border-0 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 animate-slide-up">
            <CardContent className="py-4">
              <div className="flex items-center text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5 mr-3" />
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla mejorada */}
        {debugData && debugData.accounts.length === 0 ? (
          <Card className="shadow-2xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
            <CardContent className="text-center py-20">
              <div className="bg-blue-100 dark:bg-blue-900 p-6 rounded-full mx-auto mb-6 w-fit">
                <Users className="h-16 w-16 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4">
                No hay cuentas conectadas
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Comienza conectando tu primera cuenta de X para gestionar tus
                acciones.
              </p>
              <Button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Conectar Primera Cuenta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-2xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Cuentas Conectadas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {filteredAccounts.length} de{" "}
                    {debugData?.accounts.length || 0} cuentas mostradas
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/30">
                      <TableHead className="font-semibold">CUENTA</TableHead>
                      <TableHead className="font-semibold">
                        DESARROLLADOR
                      </TableHead>
                      <TableHead className="font-semibold">
                        ESTADO TOKEN
                      </TableHead>
                      <TableHead className="font-semibold">
                        EXPIRACIÓN
                      </TableHead>
                      <TableHead className="font-semibold">ETIQUETAS</TableHead>
                      <TableHead className="font-semibold text-center">
                        ACCIONES
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account, index) => (
                      <TableRow
                        key={account._id}
                        className={`hover:bg-muted/50 transition-all duration-300 border-b account-row ${
                          account.tokenInfo?.status.toLowerCase() || "unknown"
                        }`}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-lg">
                                  {account.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white">
                                {getStatusIcon(
                                  account.tokenInfo?.status || "unknown"
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-lg truncate">
                                @{account.username}
                              </div>
                              <div className="text-sm text-muted-foreground truncate font-mono">
                                {account.userId}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium truncate max-w-32">
                              {account.developerTag}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            {account.tokenInfo ? (
                              <div className="flex items-center gap-2">
                                {getStatusIcon(account.tokenInfo.status)}
                                <Badge
                                  variant={getStatusColor(
                                    account.tokenInfo.status
                                  )}
                                  className="transition-all duration-200 hover:scale-105"
                                >
                                  {getStatusText(account.tokenInfo.status)}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="outline" className="w-fit">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Sin info
                              </Badge>
                            )}
                            {account.needsReauth && (
                              <Badge
                                variant="destructive"
                                className="w-fit animate-pulse"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                Re-auth
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.tokenInfo ? (
                            <div className="space-y-1">
                              {account.tokenInfo.hoursToExpiry !== null ? (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div
                                      className={`font-semibold text-sm ${
                                        account.tokenInfo.hoursToExpiry < 1
                                          ? "text-red-600"
                                          : account.tokenInfo.hoursToExpiry < 24
                                          ? "text-yellow-600"
                                          : "text-green-600"
                                      }`}
                                    >
                                      {account.tokenInfo.hoursToExpiry > 0
                                        ? `${account.tokenInfo.hoursToExpiry}h`
                                        : "Expirado"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(
                                        account.tokenInfo.expiresAt
                                      ).toLocaleDateString("es-ES")}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-sm">Sin fecha</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">N/A</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-64">
                            {(account.labels || []).length > 0 ? (
                              <ScrollArea className="max-h-20">
                                <div className="flex flex-wrap gap-1">
                                  {account.labels
                                    .slice(0, 3)
                                    .map((label, labelIndex) => (
                                      <Badge
                                        key={labelIndex}
                                        variant="secondary"
                                        className="text-xs transition-all duration-200 hover:scale-105"
                                      >
                                        {label}
                                      </Badge>
                                    ))}
                                  {account.labels.length > 3 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{account.labels.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </ScrollArea>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                Sin etiquetas
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAccount(account);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="hover:bg-blue-100 dark:hover:bg-blue-900 hover:scale-110 transition-all duration-200"
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalles</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    router.push(`/accounts/${account._id}`)
                                  }
                                  className="hover:bg-green-100 dark:hover:bg-green-900 hover:scale-110 transition-all duration-200"
                                >
                                  <Edit className="w-4 h-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar cuenta</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteAccount(account._id)
                                  }
                                  className="hover:bg-red-100 dark:hover:bg-red-900 hover:scale-110 transition-all duration-200"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar cuenta</TooltipContent>
                            </Tooltip>
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
      </div>
    </TooltipProvider>
  );
}
