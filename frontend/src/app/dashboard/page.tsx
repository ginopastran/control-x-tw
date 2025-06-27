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
  dailyLimits?: {
    tweets?: { used: number; limit: number; reset: string };
    follows?: { used: number; limit: number; reset: string };
    likes?: { used: number; limit: number; reset: string };
    retweets?: { used: number; limit: number; reset: string };
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
  username: string;
  accountLabels?: string[];
  text: string;
  status: string;
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

  // Estados para paginación de colas
  const [scheduledPage, setScheduledPage] = useState(1);
  const [queuedPage, setQueuedPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

  const paginatedScheduled = queueStatus.scheduled?.slice(
    (scheduledPage - 1) * itemsPerPage,
    scheduledPage * itemsPerPage
  );

  const totalScheduledPages = queueStatus.scheduled
    ? Math.ceil(queueStatus.scheduled.length / itemsPerPage)
    : 1;

  const paginatedQueued = queueStatus.queue?.slice(
    (queuedPage - 1) * itemsPerPage,
    queuedPage * itemsPerPage
  );

  const totalQueuedPages = queueStatus.queue
    ? Math.ceil(queueStatus.queue.length / itemsPerPage)
    : 1;

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
    if (!used || !limit || limit === 0) return "bg-gray-300";
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
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
          </div>
          <p className="text-sm text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Header compacto */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Dashboard de Límites
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitorea el uso y límites de todas las cuentas en tiempo real
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
              className="border-gray-300 hover:bg-gray-50"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Actualizar
            </Button>
          </div>
        </div>

        {/* Métricas compactas en tiempo real */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    En Cola
                  </p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {queueStatus.queue?.length || 0}
                  </p>
                </div>
                <div className="bg-blue-50 p-2 rounded-md">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Programadas
                  </p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {queueStatus.scheduled?.length || 0}
                  </p>
                </div>
                <div className="bg-purple-50 p-2 rounded-md">
                  <Clock className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Ejecutándose
                  </p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {queueStatus.running?.length || 0}
                  </p>
                </div>
                <div className="bg-orange-50 p-2 rounded-md">
                  <Activity className="h-4 w-4 text-orange-600 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Completadas Hoy
                  </p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {queueStatus.stats?.completedToday || 0}
                  </p>
                </div>
                <div className="bg-green-50 p-2 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estado de actividad compacto - SIEMPRE VISIBLE */}
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-100 py-3">
            <CardTitle className="text-base font-medium text-gray-900">
              Estado de Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs defaultValue="running" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100">
                <TabsTrigger value="running" className="text-xs">
                  Ejecutándose ({queueStatus.running?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="scheduled" className="text-xs">
                  Programadas ({queueStatus.scheduled?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="queue" className="text-xs">
                  En Cola ({queueStatus.queue?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  Historial
                </TabsTrigger>
              </TabsList>

              {/* Tab contents with compact styling */}
              <TabsContent value="running" className="mt-4">
                {queueStatus.running?.length > 0 ? (
                  <div className="space-y-2">
                    {queueStatus.running.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-orange-200 rounded-md bg-orange-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Activity className="h-3 w-3 text-orange-600 animate-pulse" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              @{action.accountUsername}
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {action.action}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(action.startedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay acciones ejecutándose
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scheduled" className="mt-4">
                {paginatedScheduled?.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedScheduled.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-purple-200 rounded-md bg-purple-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              @{action.accountUsername}
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                            <p className="text-xs text-purple-600">
                              Programada para:{" "}
                              {formatRelativeTime(action.scheduledTime)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {action.action}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelAction(action.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ))}
                    {totalScheduledPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <span className="text-sm text-gray-600">
                          Página {scheduledPage} de {totalScheduledPages}
                        </span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setScheduledPage((p) => Math.max(1, p - 1))
                            }
                            disabled={scheduledPage <= 1}
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setScheduledPage((p) =>
                                Math.min(totalScheduledPages, p + 1)
                              )
                            }
                            disabled={scheduledPage >= totalScheduledPages}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay acciones programadas
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="queue" className="mt-4">
                {paginatedQueued?.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedQueued.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-blue-200 rounded-md bg-blue-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              @{action.accountUsername}
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                            <p className="text-xs text-blue-600">
                              Ejecutará en:{" "}
                              {formatRelativeTime(action.estimatedStartTime)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {action.action}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelAction(action.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ))}
                    {totalQueuedPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <span className="text-sm text-gray-600">
                          Página {queuedPage} de {totalQueuedPages}
                        </span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setQueuedPage((p) => Math.max(1, p - 1))
                            }
                            disabled={queuedPage <= 1}
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setQueuedPage((p) =>
                                Math.min(totalQueuedPages, p + 1)
                              )
                            }
                            disabled={queuedPage >= totalQueuedPages}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay acciones en cola
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {queueStatus.history?.length > 0 ? (
                  <div className="space-y-2">
                    {queueStatus.history
                      .filter(
                        (action) =>
                          // Solo mostrar acciones realmente ejecutadas (no programadas)
                          action.status === "COMPLETED" ||
                          action.status === "FAILED"
                      )
                      .map((action, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 border rounded-md ${
                            action.status === "COMPLETED"
                              ? "border-green-200 bg-green-50"
                              : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {action.status === "COMPLETED" ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                @{action.username}
                              </p>
                              <p className="text-xs text-gray-600">
                                {getActionDescription(action)}
                              </p>
                              {action.error && (
                                <p className="text-xs text-red-600">
                                  Error: {action.error}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                action.status === "COMPLETED"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {action.action}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatRelativeTime(action.completedAt)}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay historial de acciones ejecutadas
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Estadísticas generales compactas */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-green-600">
                {totalActiveAccounts}
              </div>
              <div className="text-xs text-gray-600">Activas</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-yellow-600">
                {totalLimitedAccounts}
              </div>
              <div className="text-xs text-gray-600">Limitadas</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-red-600">
                {totalSuspendedAccounts}
              </div>
              <div className="text-xs text-gray-600">Suspendidas</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-gray-900">
                {accountLimits.length}
              </div>
              <div className="text-xs text-gray-600">Total</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de cuentas compacta */}
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-100 py-3">
            <CardTitle className="text-base font-medium text-gray-900">
              Detalle de Cuentas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 bg-gray-50">
                    <TableHead className="font-medium text-gray-700 py-2">
                      Cuenta
                    </TableHead>
                    <TableHead className="font-medium text-gray-700 py-2">
                      Estado
                    </TableHead>
                    <TableHead className="font-medium text-gray-700 py-2">
                      Tweets
                    </TableHead>
                    <TableHead className="font-medium text-gray-700 py-2">
                      Follows
                    </TableHead>
                    <TableHead className="font-medium text-gray-700 py-2">
                      Likes
                    </TableHead>
                    <TableHead className="font-medium text-gray-700 py-2">
                      Retweets
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow
                      key={account._id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <TableCell className="py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            @{account.username}
                          </p>
                          {renderAccountLabels(account.labels)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {getStatusBadge(account.status)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                account.dailyLimits?.tweets
                                  ? (account.dailyLimits.tweets.used /
                                      account.dailyLimits.tweets.limit) *
                                    100
                                  : 0
                              }
                              className="flex-1 h-1"
                            />
                            <span className="text-xs text-gray-600 font-mono min-w-[50px]">
                              {account.dailyLimits?.tweets
                                ? `${account.dailyLimits.tweets.used}/${account.dailyLimits.tweets.limit}`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                account.dailyLimits?.follows
                                  ? (account.dailyLimits.follows.used /
                                      account.dailyLimits.follows.limit) *
                                    100
                                  : 0
                              }
                              className="flex-1 h-1"
                            />
                            <span className="text-xs text-gray-600 font-mono min-w-[50px]">
                              {account.dailyLimits?.follows
                                ? `${account.dailyLimits.follows.used}/${account.dailyLimits.follows.limit}`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                account.dailyLimits?.likes
                                  ? (account.dailyLimits.likes.used /
                                      account.dailyLimits.likes.limit) *
                                    100
                                  : 0
                              }
                              className="flex-1 h-1"
                            />
                            <span className="text-xs text-gray-600 font-mono min-w-[50px]">
                              {account.dailyLimits?.likes
                                ? `${account.dailyLimits.likes.used}/${account.dailyLimits.likes.limit}`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Progress
                              value={
                                account.dailyLimits?.retweets
                                  ? (account.dailyLimits.retweets.used /
                                      account.dailyLimits.retweets.limit) *
                                    100
                                  : 0
                              }
                              className="flex-1 h-1"
                            />
                            <span className="text-xs text-gray-600 font-mono min-w-[50px]">
                              {account.dailyLimits?.retweets
                                ? `${account.dailyLimits.retweets.used}/${account.dailyLimits.retweets.limit}`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
