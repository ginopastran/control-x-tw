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
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { API_CONFIG, buildApiUrl } from "@/config/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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
  accountId: string;
  accountUsername: string;
  accountLabels?: string[];
  action: string;
  text: string;
  tweetId?: string;
  targetUserId?: string;
  targetUsername?: string;
  status: string;
  error?: string;
  createdAt: string;
  estimatedStartTime: string;
}

interface RunningAction {
  id: string;
  accountId: string;
  accountUsername: string;
  accountLabels?: string[];
  action: string;
  text: string;
  tweetId?: string;
  targetUserId?: string;
  status: string;
  startedAt: string;
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
  targetUsername?: string;
}

interface ScheduledAction {
  id: string;
  accountId: string;
  accountUsername: string;
  accountLabels?: string[];
  action: string;
  text: string;
  tweetId?: string;
  targetUserId?: string;
  targetUsername?: string;
  scheduledTime: string;
  status: string;
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

  // 📑 Estados para historial (paginación y filtros)
  const [historySearch, setHistorySearch] = useState("");
  const [historyAccountFilter, setHistoryAccountFilter] = useState("all");
  const [historyActionFilter, setHistoryActionFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 20;
  const [historyData, setHistoryData] = useState<HistoryAction[]>([]);
  const [totalHistoryItems, setTotalHistoryItems] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Estados para paginación de colas
  const [queuedPage, setQueuedPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalQueuedItems, setTotalQueuedItems] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);

  // 🎛️  Filtros para la pestaña "En Cola"
  const [queueSearch, setQueueSearch] = useState("");
  const [queueActionFilter, setQueueActionFilter] = useState<string>("all");

  // Opciones estáticas conocidas (se usan como fallback y para la cola)
  const QUEUE_ACTION_OPTIONS = [
    "tweet",
    "reply",
    "like",
    "retweet",
    "follow",
    "unfollow",
    "dm",
  ];

  // Opciones dinámicas de acciones detectadas en el historial (todas las que existan en BD)
  const [allHistoryActions, setAllHistoryActions] =
    useState<string[]>(QUEUE_ACTION_OPTIONS);

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

  // Paginación para acciones programadas
  const [scheduledPage, setScheduledPage] = useState(1);

  // Lista de cuentas (todas las cuentas del sistema para selector de historial)
  const uniqueAccounts = accountLimits.map((acc) => acc.username);

  // Lista de tipos de acción únicos en historial para selector
  const uniqueHistoryActions = Array.from(
    new Set(queueStatus.history?.map((h) => h.action) || [])
  );

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(totalHistoryItems / historyItemsPerPage)
  );
  const paginatedHistory = historyData;

  const goToHistoryPage = (p: number) => {
    setHistoryLoading(true);
    setHistoryPage(Math.max(1, Math.min(totalHistoryPages, p)));
  };

  // 🔍 Cargar historial con filtros desde backend
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: historyItemsPerPage.toString(),
        search: historySearch,
        action: historyActionFilter,
        account: historyAccountFilter,
        status: "executed", // solo ejecutadas por defecto
      });
      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar historial");
      const data = await res.json();
      setHistoryData(data.actions || []);
      setTotalHistoryItems(data.total || 0);
    } catch (err) {
      console.error("Error cargando historial:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

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
      const queryParams: Record<string, string | number> = {
        historyPage,
        historyLimit: historyItemsPerPage,
        queuePage: queuedPage,
        queueLimit: itemsPerPage,
      };

      // Incluir el filtro de tipo de acción si el usuario seleccionó algo distinto a "all"
      if (queueActionFilter !== "all") {
        queryParams.actionTypes = queueActionFilter;
      }

      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.STATUS, queryParams)
      );
      if (!response.ok) throw new Error("Error al cargar estado de cola");
      const data = await response.json();
      setQueueStatus(data);
      setTotalQueuedItems(data.totalQueueItems || 0);
      setTotalHistoryItems(data.totalHistoryItems || 0);
      setQueueLoading(false);
      setHistoryLoading(false);
    } catch (err) {
      console.error("Error:", err);
      setQueueLoading(false);
      setHistoryLoading(false);
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

  // 🔄 Obtener lista completa de tipos de acción desde el backend (historial/stats)
  const fetchHistoryActionsList = async () => {
    try {
      const res = await fetch("/api/history/stats?days=365");
      if (!res.ok) throw new Error("Error al obtener stats de historial");
      const data = await res.json();
      if (Array.isArray(data.actionsByType)) {
        const detected = data.actionsByType.map((item: any) => item.action);
        // Unir con lista default y quitar duplicados
        setAllHistoryActions(
          Array.from(new Set([...detected, ...QUEUE_ACTION_OPTIONS]))
        );
      }
    } catch (err) {
      console.error("Error cargando lista de acciones:", err);
    }
  };

  useEffect(() => {
    fetchAccountLimits();
    fetchQueueStatus();
    fetchRealtimeMetrics();
    fetchHistory();
    fetchHistoryActionsList();
    setLoading(false);

    // Auto-refresh cada 10 segundos (reduce carga de conexiones)
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchRealtimeMetrics();
      fetchHistory();
    }, 10000);

    return () => clearInterval(interval);
  }, [queuedPage, queueActionFilter]);

  // Ejecutar fetchHistory cada vez que filtros/página cambien
  useEffect(() => {
    fetchHistory();
  }, [historyPage, historySearch, historyAccountFilter, historyActionFilter]);

  const paginatedScheduled = queueStatus.scheduled?.slice(
    (scheduledPage - 1) * itemsPerPage,
    scheduledPage * itemsPerPage
  );

  const totalScheduledPages = queueStatus.scheduled
    ? Math.ceil(queueStatus.scheduled.length / itemsPerPage)
    : 1;

  // Aplicar filtros a la cola
  const filteredQueuedAll = queueStatus.queue?.filter((a) => {
    const searchMatch =
      queueSearch.trim() === "" ||
      a.accountUsername.toLowerCase().includes(queueSearch.toLowerCase()) ||
      (a.targetUsername &&
        a.targetUsername.toLowerCase().includes(queueSearch.toLowerCase()));

    const actionMatch =
      queueActionFilter === "all" || a.action === queueActionFilter;

    return searchMatch && actionMatch;
  });

  const totalQueuedPages = Math.ceil(totalQueuedItems / itemsPerPage);

  const paginatedQueued = filteredQueuedAll;

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

  // 🆕 Componente que muestra una cuenta regresiva en vivo hasta la hora objetivo
  const RelativeTime = ({ target }: { target: string }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, []);

    if (!target) return "Fecha no disponible";
    const diffMs = new Date(target).getTime() - now;

    // Si ya pasó, usar formato relativo existente (pasado)
    if (diffMs <= 0) return formatRelativeTime(target);

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `En ${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `En ${minutes}m ${seconds}s`;
    }
    return `En ${seconds}s`;
  };

  // Función para cancelar una acción
  const cancelAction = async (actionId: string) => {
    const confirmMsg = `¿Seguro que deseas cancelar la acción ${actionId}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // Endpoint principal basado en nueva API: /api/queue/cancel/:id
      let response = await fetch(
        buildApiUrl(`/api/queue/cancel/${actionId}`),
        {
          method: "DELETE",
        }
      );

      // Si no existe (por compatibilidad) intentar ruta /api/queue/action/:id
      if (response.status === 404) {
        response = await fetch(
          buildApiUrl(`/api/queue/action/${actionId}`),
          {
            method: "DELETE",
          }
        );
      }

      if (response.ok) {
        await fetchQueueStatus();
        alert("Acción cancelada exitosamente");
      } else {
        const err = await response.json();
        throw new Error(err.error || "No se pudo cancelar la acción");
      }
    } catch (error) {
      console.error("Error cancelando acción:", error);
      alert("Error cancelando acción");
    }
  };

  const getActionDescription = (action: any) => {
    switch (action.action) {
      case "tweet":
        return action.text
          ? action.text.length > 60
            ? `${action.text.substring(0, 1000)}...`
            : action.text
          : "Publicar nuevo tweet";
      case "retweet":
        return action.tweetId
          ? `Retweet del tweet ID: ${action.tweetId.substring(0, 100)}...`
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
        // Priorizar targetUsername sobre targetUserId
        if (action.targetUsername) {
          return `Seguir a @${action.targetUsername}`;
        } else if (action.targetUserId) {
          return `Seguir a ID: ${action.targetUserId}`;
        } else {
          return "Seguir usuario";
        }
      case "unfollow":
        // Priorizar targetUsername sobre targetUserId
        if (action.targetUsername) {
          return `Dejar de seguir a @${action.targetUsername}`;
        } else if (action.targetUserId) {
          return `Dejar de seguir ID: ${action.targetUserId}`;
        } else {
          return "Dejar de seguir";
        }
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

  const goToPage = (page: number) => {
    if (page < 1 || page > totalQueuedPages || page === queuedPage) return;
    setQueueLoading(true);
    setQueuedPage(page);
  };

  const generatePageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalQueuedPages <= 5) {
      for (let i = 1; i <= totalQueuedPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (queuedPage > 3) pages.push("ellipsis");
      const start = Math.max(2, queuedPage - 1);
      const end = Math.min(totalQueuedPages - 1, queuedPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (queuedPage < totalQueuedPages - 2) pages.push("ellipsis");
      pages.push(totalQueuedPages);
    }
    return pages;
  };

  // 📑 Generar paginación para HISTORIAL (independiente de la cola)
  const generateHistoryPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalHistoryPages <= 5) {
      for (let i = 1; i <= totalHistoryPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (historyPage > 3) pages.push("ellipsis");
      const start = Math.max(2, historyPage - 1);
      const end = Math.min(totalHistoryPages - 1, historyPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (historyPage < totalHistoryPages - 2) pages.push("ellipsis");
      pages.push(totalHistoryPages);
    }
    return pages;
  };

  const clearQueue = async () => {
    if (
      !window.confirm(
        "¿Seguro que deseas cancelar TODAS las acciones en cola y programadas?"
      )
    )
      return;
    const typed = prompt('Para confirmar escribe "LIMPIAR" (en mayúsculas):');
    if (typed !== "LIMPIAR") {
      alert("Operación cancelada. No se escribió LIMPIAR correctamente.");
      return;
    }
    try {
      const response = await fetch("/api/queue/all", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error al cancelar acciones");
      await response.json();
      await fetchQueueStatus();
      alert("Cola limpiada exitosamente");
    } catch (err) {
      console.error(err);
      alert("No se pudo limpiar la cola");
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
                    {totalQueuedItems}
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
                  En Cola ({totalQueuedItems})
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
                              <a
                                href={`https://twitter.com/${action.accountUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                @{action.accountUsername}
                              </a>
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
                              <a
                                href={`https://twitter.com/${action.accountUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                @{action.accountUsername}
                              </a>
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                            <p className="text-xs text-purple-600">
                              Programada para:{" "}
                              <RelativeTime target={action.scheduledTime} />
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
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Input
                    placeholder="Buscar usuario…"
                    value={queueSearch}
                    onChange={(e) => {
                      setQueueSearch(e.target.value);
                      setQueuedPage(1);
                    }}
                    className="w-48"
                  />

                  <Select
                    value={queueActionFilter}
                    onValueChange={(val: any) => {
                      setQueueActionFilter(val);
                      setQueuedPage(1);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Tipo de acción" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {QUEUE_ACTION_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="capitalize"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(queueSearch || queueActionFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setQueueSearch("");
                        setQueueActionFilter("all");
                        setQueuedPage(1);
                      }}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Limpiar filtros
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearQueue}
                    className="ml-auto"
                  >
                    Limpiar cola
                  </Button>
                </div>

                {queueLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: itemsPerPage }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-md" />
                    ))}
                  </div>
                ) : paginatedQueued?.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedQueued.map((action, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 border border-blue-200 rounded-md bg-blue-50`}
                      >
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              <a
                                href={`https://twitter.com/${action.accountUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                @{action.accountUsername}
                              </a>
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                            {action.status !== "COMPLETED" && action.error && (
                              <p className="text-xs text-red-600 break-all">
                                Error: {action.error}
                              </p>
                            )}
                            <p className="text-xs text-blue-600">
                              Ejecutará en:{" "}
                              <RelativeTime
                                target={action.estimatedStartTime}
                              />
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
                      <Pagination className="pt-4">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                goToPage(queuedPage - 1);
                              }}
                              className="cursor-pointer"
                              aria-disabled={queuedPage <= 1 || queueLoading}
                            />
                          </PaginationItem>
                          {generatePageNumbers().map((p, idx) =>
                            p === "ellipsis" ? (
                              <PaginationItem key={`el-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={p as number}>
                                <PaginationLink
                                  href="#"
                                  isActive={p === queuedPage}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    goToPage(p as number);
                                  }}
                                  className="cursor-pointer"
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                goToPage(queuedPage + 1);
                              }}
                              className="cursor-pointer"
                              aria-disabled={
                                queuedPage >= totalQueuedPages || queueLoading
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
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
                {/* Filtros de historial */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Input
                    placeholder="Buscar en historial…"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-48"
                  />

                  {/* Filtro por cuenta */}
                  <Select
                    value={historyAccountFilter}
                    onValueChange={(val: any) => {
                      setHistoryAccountFilter(val);
                      setHistoryPage(1);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las cuentas</SelectItem>
                      {uniqueAccounts.map((acc) => (
                        <SelectItem key={acc} value={acc}>
                          @{acc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro por tipo de acción */}
                  <Select
                    value={historyActionFilter}
                    onValueChange={(val: any) => {
                      setHistoryActionFilter(val);
                      setHistoryPage(1);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Acción" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {allHistoryActions.map((act) => (
                        <SelectItem
                          key={act}
                          value={act}
                          className="capitalize"
                        >
                          {act}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(historySearch ||
                    historyAccountFilter !== "all" ||
                    historyActionFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHistorySearch("");
                        setHistoryAccountFilter("all");
                        setHistoryActionFilter("all");
                        setHistoryPage(1);
                      }}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>

                {historyLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: historyItemsPerPage }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-md" />
                    ))}
                  </div>
                ) : paginatedHistory.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedHistory.map((action, index) => (
                      <div
                        key={action.id || index}
                        className={`flex items-center justify-between p-3 border rounded-md w-full ${
                          action.status === "COMPLETED"
                            ? "border-green-200 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {getActionIcon(action.action)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              <a
                                href={`https://twitter.com/${action.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                @{action.username}
                              </a>
                            </p>
                            <p className="text-xs text-gray-600">
                              {getActionDescription(action)}
                            </p>
                            {action.status !== "COMPLETED" && action.error && (
                              <p className="text-xs text-red-600 break-all">
                                Error: {action.error}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Completada:{" "}
                              {formatRelativeTime(action.completedAt)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              action.status === "COMPLETED"
                                ? "secondary"
                                : "destructive"
                            }
                            className="text-xs"
                          >
                            {action.status === "COMPLETED" ? "OK" : "FALLÓ"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {totalHistoryPages > 1 && (
                      <Pagination className="pt-4">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                goToHistoryPage(historyPage - 1);
                              }}
                              className="cursor-pointer"
                              aria-disabled={historyPage <= 1}
                            />
                          </PaginationItem>
                          {generateHistoryPageNumbers().map((p, idx) =>
                            p === "ellipsis" ? (
                              <PaginationItem key={`hist-el-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={`hist-${p as number}`}>
                                <PaginationLink
                                  href="#"
                                  isActive={p === historyPage}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    goToHistoryPage(p as number);
                                  }}
                                  className="cursor-pointer"
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                goToHistoryPage(historyPage + 1);
                              }}
                              className="cursor-pointer"
                              aria-disabled={historyPage >= totalHistoryPages}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Sin resultados</p>
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
                          <a
                            href={`https://twitter.com/${account.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            @{account.username}
                          </a>
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
