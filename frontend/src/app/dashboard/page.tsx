"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  RefreshCw,
  Activity,
  Users,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { API_CONFIG, buildApiUrl } from "@/config/api";

interface AccountLimits {
  _id: string;
  username: string;
  labels: string[];
  dailyLimits: {
    tweets: { used: number; limit: number; reset: string };
    follows: { used: number; limit: number; reset: string };
    likes: { used: number; limit: number; reset: string };
    retweets: { used: number; limit: number; reset: string };
  };
  status: "active" | "suspended" | "limited" | "error";
  lastActivity: string;
}

// Interfaz para el estado de la cola
interface QueueStatus {
  queue: QueueAction[];
  running: RunningAction[];
  history: HistoryAction[];
  scheduled: ScheduledAction[];
  stats: {
    queueLength: number;
    runningCount: number;
    completedToday: number;
    failedToday: number;
    scheduled: number;
  };
}

interface QueueAction {
  id: string;
  action: string;
  accountUsername: string;
  accountLabels?: string[];
  text: string;
  createdAt: string;
  estimatedStartTime: string;
}

interface RunningAction {
  id: string;
  action: string;
  accountUsername: string;
  accountLabels?: string[];
  text: string;
  startedAt: string;
  progress: number;
}

interface HistoryAction {
  id: string;
  action: string;
  accountUsername: string;
  accountLabels?: string[];
  text: string;
  status: "completed" | "failed" | "cancelled";
  completedAt: string;
  error?: string;
}

interface ScheduledAction {
  id: string;
  action: string;
  accountUsername: string;
  accountLabels?: string[];
  text: string;
  scheduledTime: string;
  createdAt: string;
  baseDelay: number;
  randomDelay: number;
}

export default function Dashboard() {
  // Agregar estilos CSS personalizados
  const customStyles = `
    .stat-number {
      transition: all 0.3s ease;
    }
    .stat-number:hover {
      transform: scale(1.05);
    }
    .account-card.active {
      border-left: 4px solid #10b981;
    }
    .account-card.limited {
      border-left: 4px solid #f59e0b;
    }
    .account-card.suspended {
      border-left: 4px solid #ef4444;
    }
    .account-card.error {
      border-left: 4px solid #ef4444;
    }
    .progress-bar-container {
      transition: all 0.3s ease;
    }
    .progress-bar-container:hover {
      transform: scaleY(1.2);
    }
    .search-input {
      transition: all 0.3s ease;
    }
    .search-input:focus {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .table-row {
      transition: all 0.2s ease;
    }
    .table-row:hover {
      background-color: rgba(59, 130, 246, 0.05);
      transform: translateX(2px);
    }
  `;

  // Inyectar estilos
  if (typeof document !== "undefined") {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = customStyles;
    if (!document.head.querySelector("style[data-dashboard-styles]")) {
      styleSheet.setAttribute("data-dashboard-styles", "true");
      document.head.appendChild(styleSheet);
    }
  }
  const [accountLimits, setAccountLimits] = useState<AccountLimits[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    queue: [],
    running: [],
    history: [],
    scheduled: [],
    stats: {
      queueLength: 0,
      runningCount: 0,
      completedToday: 0,
      failedToday: 0,
      scheduled: 0,
    },
  });
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string>("all");

  // Estados para paginación del historial
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPerPage] = useState(10);
  const [totalHistoryItems, setTotalHistoryItems] = useState(0);

  // Agregar variables calculadas que faltaban
  const totalActiveAccounts = accountLimits.filter(
    (account) => account.status === "active"
  ).length;

  const totalLimitedAccounts = accountLimits.filter(
    (account) => account.status === "limited"
  ).length;

  const totalSuspendedAccounts = accountLimits.filter(
    (account) => account.status === "suspended"
  ).length;

  const fetchAccountLimits = async () => {
    try {
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.ACCOUNT_LIMITS)
      );
      if (!response.ok) throw new Error("Error al cargar límites");
      const data = await response.json();
      setAccountLimits(data);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.STATUS, {
          historyPage,
          historyLimit: historyPerPage,
        })
      );
      if (!response.ok) throw new Error("Error al cargar estado de cola");
      const data = await response.json();
      setQueueStatus(data);
      setTotalHistoryItems(data.totalHistoryItems || 0);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const fetchRealtimeMetrics = async () => {
    try {
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.METRICS.REALTIME)
      );
      if (!response.ok) throw new Error("Error al cargar métricas");
      const data = await response.json();
      setRealtimeMetrics(data);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    fetchAccountLimits();
    fetchQueueStatus();
    fetchRealtimeMetrics();
    setLoading(false);

    // Auto-refresh cada 5 segundos
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchRealtimeMetrics();
    }, 5000);

    return () => clearInterval(interval);
  }, [historyPage]);

  const filteredAccounts = accountLimits.filter(
    (account: AccountLimits) =>
      selectedLabel === "all" || account.labels?.includes(selectedLabel)
  );

  const availableLabels = Array.from(
    new Set(
      accountLimits.flatMap((account: AccountLimits) => account.labels || [])
    )
  );

  const getProgressColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Activa
          </Badge>
        );
      case "limited":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Limitada
          </Badge>
        );
      case "suspended":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Suspendida
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) {
        return "Ahora mismo";
      } else if (diffMinutes < 60) {
        return `Hace ${diffMinutes}min`;
      } else if (diffMinutes < 1440) {
        // 24 horas
        const hours = Math.floor(diffMinutes / 60);
        return `Hace ${hours}h`;
      } else {
        return date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      return "Hora inválida";
    }
  };

  const getTimeUntilReset = (resetTime: string) => {
    try {
      const reset = new Date(resetTime);
      const now = new Date();
      const diff = reset.getTime() - now.getTime();

      if (diff <= 0) return "Reseteado";

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}h ${minutes}m`;
    } catch {
      return "Tiempo inválido";
    }
  };

  // Formatear fecha relativa
  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return "Fecha no disponible";

    try {
      const date = new Date(dateString);

      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return "Fecha inválida";
      }

      const now = new Date();
      const diffMs = date.getTime() - now.getTime(); // Cambio: fecha - ahora para fechas futuras
      const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
      const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
      const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));

      // Para fechas futuras (acciones programadas)
      if (diffMs > 0) {
        if (diffMinutes < 1) {
          return "En unos momentos";
        } else if (diffMinutes < 60) {
          return `En ${diffMinutes}m`;
        } else if (diffHours < 24) {
          return `En ${diffHours}h`;
        } else if (diffDays < 7) {
          return `En ${diffDays}d`;
        } else {
          return date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      }

      // Para fechas pasadas (historial)
      if (diffMinutes < 1) {
        return "Ahora";
      } else if (diffMinutes < 60) {
        return `Hace ${diffMinutes}m`;
      } else if (diffHours < 24) {
        return `Hace ${diffHours}h`;
      } else if (diffDays < 7) {
        return `Hace ${diffDays}d`;
      } else {
        // Para fechas más antiguas, mostrar fecha completa
        return date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch (error) {
      console.error("Error formateando fecha:", error);
      return "Fecha inválida";
    }
  };

  // Función para cancelar una acción
  const cancelAction = async (actionId: string) => {
    try {
      // Intentar cancelar como acción programada primero
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.CANCEL(actionId)),
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Actualizar estado local
        fetchQueueStatus();
        // Mostrar mensaje de éxito (opcional)
      } else {
        // Si no funciona como programada, intentar como acción normal
        const fallbackResponse = await fetch(
          buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.DELETE(actionId)),
          {
            method: "DELETE",
          }
        );

        if (fallbackResponse.ok) {
          fetchQueueStatus();
        } else {
          throw new Error("Error al cancelar acción");
        }
      }
    } catch (error) {
      console.error("Error cancelando acción:", error);
    }
  };

  const getActionDescription = (action: any) => {
    switch (action.action) {
      case "tweet":
        return action.text
          ? action.text.length > 60
            ? `${action.text.substring(0, 60)}...`
            : action.text
          : "Publicar nuevo tweet";
      case "retweet":
        return action.tweetId
          ? `Retweet del tweet ID: ${action.tweetId.substring(0, 12)}...`
          : "Hacer retweet";
      case "like":
        return action.tweetId
          ? `Like al tweet ID: ${action.tweetId.substring(0, 12)}...`
          : "Dar like a tweet";
      case "reply":
        return action.text
          ? `Responder: "${
              action.text.length > 50
                ? action.text.substring(0, 50) + "..."
                : action.text
            }"`
          : "Responder a tweet";
      case "follow":
        return action.targetUserId
          ? `Seguir a @${action.targetUserId}`
          : "Seguir usuario";
      case "unfollow":
        return action.targetUserId
          ? `Dejar de seguir a @${action.targetUserId}`
          : "Dejar de seguir";
      case "dm":
        return action.text
          ? `Mensaje directo: "${action.text.substring(0, 40)}..."`
          : "Enviar mensaje directo";
      default:
        return action.text || "Acción personalizada";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "tweet":
        return "📝";
      case "retweet":
        return "🔄";
      case "like":
        return "❤️";
      case "reply":
        return "💬";
      case "follow":
        return "👥";
      case "unfollow":
        return "👤";
      case "dm":
        return "✉️";
      case "mention":
        return "📢";
      case "quote":
        return "🔗";
      default:
        return "⚡";
    }
  };

  // Función para renderizar los labels de las cuentas
  const renderAccountLabels = (labels?: string[]) => {
    if (!labels || labels.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {labels.map((label) => (
          <Badge key={label} variant="outline" className="text-xs">
            {label}
          </Badge>
        ))}
      </div>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAccountLimits(),
        fetchQueueStatus(),
        fetchRealtimeMetrics(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin h-8 w-8" />
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard de Límites
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitorea el uso y límites de todas las cuentas de X en tiempo real
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Actualizar
        </Button>
      </div>

      {/* Métricas en tiempo real */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Cola</CardTitle>
            <div className="bg-cyan-100 dark:bg-cyan-900 p-2 rounded-lg">
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600 stat-number">
              {queueStatus.queue?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Acciones pendientes</p>
            <div className="h-1 w-full mt-2 rounded-full bg-cyan-200 dark:bg-cyan-800">
              <div
                className="h-full bg-cyan-600 rounded-full animate-pulse"
                style={{
                  width: (queueStatus.queue?.length || 0) > 0 ? "100%" : "0%",
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programadas</CardTitle>
            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 stat-number">
              {queueStatus.scheduled?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Para ejecutar más tarde
            </p>
            <div className="h-1 w-full mt-2 rounded-full bg-purple-200 dark:bg-purple-800">
              <div
                className="h-full bg-purple-600 rounded-full animate-pulse"
                style={{
                  width:
                    (queueStatus.scheduled?.length || 0) > 0 ? "100%" : "0%",
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ejecutándose</CardTitle>
            <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
              <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 stat-number">
              {queueStatus.running?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Acciones activas</p>
            <div className="h-1 w-full mt-2 rounded-full bg-orange-200 dark:bg-orange-800">
              <div
                className="h-full bg-orange-600 rounded-full animate-pulse"
                style={{
                  width: (queueStatus.running?.length || 0) > 0 ? "100%" : "0%",
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completadas Hoy
            </CardTitle>
            <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 stat-number">
              {realtimeMetrics?.totalActionsToday || 0}
            </div>
            <p className="text-xs text-muted-foreground">Acciones exitosas</p>
            <div className="h-1 w-full mt-2 rounded-full bg-emerald-200 dark:bg-emerald-800">
              <div
                className="h-full bg-emerald-600 rounded-full animate-pulse"
                style={{
                  width:
                    (realtimeMetrics?.totalActionsToday || 0) > 0
                      ? "100%"
                      : "0%",
                }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Actividad */}
      {(queueStatus.queue?.length > 0 ||
        queueStatus.running?.length > 0 ||
        queueStatus.scheduled?.length > 0 ||
        queueStatus.history?.length > 0) && (
        <Card className="shadow-xl border-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader>
            <CardTitle>Estado de Actividad en Tiempo Real</CardTitle>
            <CardDescription>
              Monitoreo de acciones en cola, programadas, ejecutándose y
              completadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="running" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger
                  value="running"
                  className="flex items-center space-x-2"
                >
                  <Activity className="h-4 w-4" />
                  <span>Ejecutándose</span>
                  {queueStatus.running?.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {queueStatus.running.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="scheduled"
                  className="flex items-center space-x-2"
                >
                  <Clock className="h-4 w-4" />
                  <span>Programadas</span>
                  {queueStatus.scheduled?.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {queueStatus.scheduled.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="queue"
                  className="flex items-center space-x-2"
                >
                  <Activity className="h-4 w-4" />
                  <span>En Cola</span>
                  {queueStatus.queue?.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {queueStatus.queue.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="flex items-center space-x-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Historial</span>
                  {totalHistoryItems > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {totalHistoryItems}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scheduled" className="mt-6">
                {queueStatus.scheduled?.length > 0 ? (
                  <div className="space-y-4">
                    {queueStatus.scheduled.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-full">
                            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-medium">
                              @{action.accountUsername}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getActionDescription(action)}
                            </p>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-700"
                          >
                            {getActionIcon(action.action)} {action.action}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Programada para:{" "}
                            {new Date(action.scheduledTime).toLocaleString(
                              "es-ES",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(action.scheduledTime)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => cancelAction(action.id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No hay acciones programadas
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Las acciones programadas aparecerán aquí
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="running" className="mt-6">
                {queueStatus.running?.length > 0 ? (
                  <div className="space-y-4">
                    {queueStatus.running.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20"
                      >
                        <div className="flex items-center space-x-3">
                          <Activity className="h-5 w-5 text-orange-600 animate-pulse" />
                          <div>
                            <p className="font-medium">
                              @{action.accountUsername}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getActionDescription(action)}
                            </p>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Badge variant="secondary">{action.action}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Iniciado: {formatTime(action.startedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No hay acciones ejecutándose actualmente
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="queue" className="mt-6">
                {queueStatus.queue?.length > 0 ? (
                  <div className="space-y-4">
                    {queueStatus.queue.slice(0, 10).map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                          <div>
                            <p className="font-medium">
                              @{action.accountUsername}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getActionDescription(action)}
                            </p>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Badge variant="outline">{action.action}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Estimado: {formatTime(action.estimatedStartTime)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {queueStatus.queue.length > 10 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          Y {queueStatus.queue.length - 10} acciones más en
                          cola...
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No hay acciones en cola
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">Historial Reciente</h3>
                    <Badge variant="outline" className="text-xs">
                      Últimas {queueStatus.history?.length || 0} acciones
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/historial", "_blank")}
                    className="flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Ver Historial Completo
                  </Button>
                </div>

                {queueStatus.history?.length > 0 ? (
                  <div className="space-y-3">
                    {queueStatus.history.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/50 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {action.status === "completed" ? (
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {action.accountUsername[0].toUpperCase()}
                              </div>
                              <p className="font-medium text-sm">
                                @{action.accountUsername}
                              </p>
                              <Badge
                                variant={
                                  action.status === "completed"
                                    ? "default"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                {getActionIcon(action.action)} {action.action}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {getActionDescription(action)}
                            </p>
                            {action.accountLabels &&
                              action.accountLabels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {action.accountLabels
                                    .slice(0, 2)
                                    .map((label, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {label.length > 12
                                          ? label.substring(0, 12) + "..."
                                          : label}
                                      </Badge>
                                    ))}
                                  {action.accountLabels.length > 2 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{action.accountLabels.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            {action.error && (
                              <p className="text-xs text-red-500 mt-1 truncate">
                                Error: {action.error}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(action.completedAt)}
                          </p>
                          <p className="text-xs text-muted-foreground opacity-75">
                            {new Date(action.completedAt).toLocaleTimeString(
                              "es-ES",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      No hay historial disponible
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Las acciones completadas aparecerán aquí
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open("/historial", "_blank")}
                      className="mt-3"
                    >
                      Ver Historial Completo
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 transition-all duration-500 hover:shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <span>Información sobre Límites</span>
          </CardTitle>
          <CardDescription>
            Detalles importantes sobre los límites y estados de las cuentas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">
                Límites API Twitter v2 (Por 15 min)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    📝 Crear Tweets:
                  </span>
                  <Badge variant="outline">300/día • 50/15min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    ➕ Seguir Usuarios:
                  </span>
                  <Badge variant="outline">400/día • 50/15min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    ❤️ Dar Like:
                  </span>
                  <Badge variant="outline">1000/día • 75/15min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    🔄 Retweet:
                  </span>
                  <Badge variant="outline">300/día • 75/15min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    💬 Menciones:
                  </span>
                  <Badge variant="outline">300/día • 180/15min</Badge>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Estados de Cuenta</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    <strong>Activa:</strong> Funcionando normalmente, dentro de
                    límites
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">
                    <strong>Limitada:</strong> &gt;75% del límite de 15min
                    alcanzado
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">
                    <strong>Suspendida:</strong> Cuenta suspendida por X/Rate
                    limit
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">
                    <strong>Error:</strong> Falló autenticación o conectividad
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Análisis de Rendimiento y Rate Limits */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <span>Análisis de Rendimiento en Tiempo Real</span>
          </CardTitle>
          <CardDescription>
            Monitoreo de límites de API de Twitter v2 y eficiencia de las
            cuentas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resumen de límites por tipo de acción */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span>Uso Promedio por Tipo de Acción</span>
              </h4>
              <div className="space-y-3">
                {accountLimits.length > 0 && (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">📝</span>
                        <span className="text-sm font-medium">Tweets</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-600">
                          {Math.round(
                            accountLimits.reduce(
                              (acc, account) =>
                                acc + account.dailyLimits.tweets.used,
                              0
                            ) / accountLimits.length
                          )}{" "}
                          promedio
                        </div>
                        <div className="text-xs text-muted-foreground">
                          de {accountLimits[0]?.dailyLimits.tweets.limit || 300}{" "}
                          límite diario
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">👥</span>
                        <span className="text-sm font-medium">Follows</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-600">
                          {Math.round(
                            accountLimits.reduce(
                              (acc, account) =>
                                acc + account.dailyLimits.follows.used,
                              0
                            ) / accountLimits.length
                          )}{" "}
                          promedio
                        </div>
                        <div className="text-xs text-muted-foreground">
                          de{" "}
                          {accountLimits[0]?.dailyLimits.follows.limit || 400}{" "}
                          límite diario
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">❤️</span>
                        <span className="text-sm font-medium">Likes</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-600">
                          {Math.round(
                            accountLimits.reduce(
                              (acc, account) =>
                                acc + account.dailyLimits.likes.used,
                              0
                            ) / accountLimits.length
                          )}{" "}
                          promedio
                        </div>
                        <div className="text-xs text-muted-foreground">
                          de {accountLimits[0]?.dailyLimits.likes.limit || 1000}{" "}
                          límite diario
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🔄</span>
                        <span className="text-sm font-medium">Retweets</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-600">
                          {Math.round(
                            accountLimits.reduce(
                              (acc, account) =>
                                acc + account.dailyLimits.retweets.used,
                              0
                            ) / accountLimits.length
                          )}{" "}
                          promedio
                        </div>
                        <div className="text-xs text-muted-foreground">
                          de{" "}
                          {accountLimits[0]?.dailyLimits.retweets.limit || 300}{" "}
                          límite diario
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Estado de salud del sistema */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Estado de Salud del Sistema</span>
              </h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Cuentas Operativas
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-green-600">
                        {totalActiveAccounts}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        de {accountLimits.length}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={(totalActiveAccounts / accountLimits.length) * 100}
                    className="mt-2 h-2"
                  />
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Eficiencia Global
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-blue-600">
                        {accountLimits.length > 0
                          ? Math.round(
                              (accountLimits.filter(
                                (acc) => acc.status === "active"
                              ).length /
                                accountLimits.length) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Basado en cuentas activas vs total
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Acciones por Hora
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-orange-600">
                        {realtimeMetrics?.actionsPerHour ||
                          Math.round(
                            (realtimeMetrics?.totalActionsToday || 0) / 24
                          )}
                      </span>
                      <span className="text-xs text-muted-foreground">/hr</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Promedio calculado del total diario
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cuentas Activas
            </CardTitle>
            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 stat-number">
              {totalActiveAccounts}
            </div>
            <p className="text-xs text-muted-foreground">
              {((totalActiveAccounts / accountLimits.length) * 100).toFixed(1)}%
              del total
            </p>
            <div className="h-1 w-full mt-2 rounded-full bg-green-200 dark:bg-green-800">
              <div
                className="h-full bg-green-600 rounded-full animate-pulse"
                style={{
                  width: `${
                    (totalActiveAccounts / accountLimits.length) * 100
                  }%`,
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cuentas Limitadas
            </CardTitle>
            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 stat-number">
              {totalLimitedAccounts}
            </div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
            <div className="h-1 w-full mt-2 rounded-full bg-yellow-200 dark:bg-yellow-800">
              <div
                className="h-full bg-yellow-600 rounded-full animate-pulse"
                style={{ width: totalLimitedAccounts > 0 ? "100%" : "0%" }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cuentas Suspendidas
            </CardTitle>
            <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 stat-number">
              {totalSuspendedAccounts}
            </div>
            <p className="text-xs text-muted-foreground">Necesitan revisión</p>
            <div className="h-1 w-full mt-2 rounded-full bg-red-200 dark:bg-red-800">
              <div
                className="h-full bg-red-600 rounded-full animate-pulse"
                style={{ width: totalSuspendedAccounts > 0 ? "100%" : "0%" }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 stat-number">
              {accountLimits.length}
            </div>
            <p className="text-xs text-muted-foreground">Cuentas gestionadas</p>
            <div className="h-1 w-full mt-2 rounded-full bg-blue-200 dark:bg-blue-800">
              <div
                className="h-full bg-blue-600 rounded-full animate-pulse"
                style={{ width: "100%" }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
        <CardContent>
          <div className="relative max-w-md">
            <Input
              placeholder="Buscar cuentas por username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 search-input"
            />
            <svg
              className="w-4 h-4 text-muted-foreground absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
      {/* Tabla de cuentas */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
        <CardHeader>
          <CardTitle>Detalle de Cuentas</CardTitle>
          <CardDescription>
            Estado actual de límites y uso para cada cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tweets</TableHead>
                  <TableHead>Follows</TableHead>
                  <TableHead>Likes</TableHead>
                  <TableHead>Retweets</TableHead>
                  <TableHead>Última Actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <TableRow
                      key={account._id}
                      className={`table-row account-card ${account.status}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">@{account.username}</p>
                          {renderAccountLabels(account.labels)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="progress-bar-container flex-1">
                              <Progress
                                value={
                                  (account.dailyLimits.tweets.used /
                                    account.dailyLimits.tweets.limit) *
                                  100
                                }
                                className={`flex-1 ${getProgressColor(
                                  account.dailyLimits.tweets.used,
                                  account.dailyLimits.tweets.limit
                                )}`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground min-w-[60px] font-mono">
                              {account.dailyLimits.tweets.used}/
                              {account.dailyLimits.tweets.limit}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              Reset:{" "}
                              {getTimeUntilReset(
                                account.dailyLimits.tweets.reset
                              )}
                            </p>
                            <span className="text-xs font-semibold text-blue-600">
                              {Math.round(
                                (account.dailyLimits.tweets.used /
                                  account.dailyLimits.tweets.limit) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                (account.dailyLimits.follows.used /
                                  account.dailyLimits.follows.limit) *
                                100
                              }
                              className={`flex-1 ${getProgressColor(
                                account.dailyLimits.follows.used,
                                account.dailyLimits.follows.limit
                              )}`}
                            />
                            <span className="text-xs text-muted-foreground min-w-[60px] font-mono">
                              {account.dailyLimits.follows.used}/
                              {account.dailyLimits.follows.limit}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              Reset:{" "}
                              {getTimeUntilReset(
                                account.dailyLimits.follows.reset
                              )}
                            </p>
                            <span className="text-xs font-semibold text-purple-600">
                              {Math.round(
                                (account.dailyLimits.follows.used /
                                  account.dailyLimits.follows.limit) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                (account.dailyLimits.likes.used /
                                  account.dailyLimits.likes.limit) *
                                100
                              }
                              className={`flex-1 ${getProgressColor(
                                account.dailyLimits.likes.used,
                                account.dailyLimits.likes.limit
                              )}`}
                            />
                            <span className="text-xs text-muted-foreground min-w-[60px] font-mono">
                              {account.dailyLimits.likes.used}/
                              {account.dailyLimits.likes.limit}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              Reset:{" "}
                              {getTimeUntilReset(
                                account.dailyLimits.likes.reset
                              )}
                            </p>
                            <span className="text-xs font-semibold text-red-600">
                              {Math.round(
                                (account.dailyLimits.likes.used /
                                  account.dailyLimits.likes.limit) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                (account.dailyLimits.retweets.used /
                                  account.dailyLimits.retweets.limit) *
                                100
                              }
                              className={`flex-1 ${getProgressColor(
                                account.dailyLimits.retweets.used,
                                account.dailyLimits.retweets.limit
                              )}`}
                            />
                            <span className="text-xs text-muted-foreground min-w-[60px] font-mono">
                              {account.dailyLimits.retweets.used}/
                              {account.dailyLimits.retweets.limit}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              Reset:{" "}
                              {getTimeUntilReset(
                                account.dailyLimits.retweets.reset
                              )}
                            </p>
                            <span className="text-xs font-semibold text-green-600">
                              {Math.round(
                                (account.dailyLimits.retweets.used /
                                  account.dailyLimits.retweets.limit) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(account.lastActivity)}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          No se encontraron cuentas
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
