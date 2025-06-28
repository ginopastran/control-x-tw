"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Calendar,
  Download,
  Filter,
  Search,
  RefreshCw,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Hash,
  Calendar as CalendarIcon,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface HistoryAction {
  _id: string;
  actionId: string;
  username: string;
  accountLabels: string[];
  action: string;
  text?: string;
  tweetId?: string;
  targetUserId?: string;
  targetUsername?: string;
  status: string;
  success: boolean;
  createdAt: string;
  completedAt?: string;
  error?: string;
  batchId?: string;
}

interface Stats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
}

export default function HistorialPage() {
  const [actions, setActions] = useState<HistoryAction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("executed"); // Por defecto mostrar solo ejecutadas
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7"); // días
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [currentPage, selectedAction, selectedStatus, selectedAccount, dateRange]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        action: selectedAction,
        status: selectedStatus,
        account: selectedAccount,
        days: dateRange,
      });

      const response = await fetch(`/api/history?${params}`);
      if (!response.ok) throw new Error("Error al cargar historial");

      const data = await response.json();

      // Filtrar acciones según el estado seleccionado
      let filteredActions = data.actions;

      if (selectedStatus === "executed") {
        // Solo mostrar acciones que realmente se ejecutaron (completadas o fallidas)
        filteredActions = data.actions.filter(
          (action: HistoryAction) =>
            action.status === "COMPLETED" || action.status === "FAILED"
        );
      } else if (selectedStatus === "scheduled") {
        // Solo mostrar acciones programadas (en cola)
        filteredActions = data.actions.filter(
          (action: HistoryAction) => action.status === "QUEUED"
        );
      }

      setActions(filteredActions);
      setTotalPages(
        Math.ceil((filteredActions.length || data.total) / itemsPerPage)
      );
    } catch (err) {
      toast.error("Error al cargar el historial");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/history/stats?days=${dateRange}`);
      if (!response.ok) throw new Error("Error al cargar estadísticas");

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
    }
  };

  const exportHistory = async () => {
    try {
      const params = new URLSearchParams({
        action: selectedAction,
        status: selectedStatus,
        account: selectedAccount,
        days: dateRange,
        format: "csv",
      });

      const response = await fetch(`/api/history/export?${params}`);
      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `historial-acciones-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Historial exportado exitosamente");
    } catch (err) {
      toast.error("Error al exportar el historial");
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
        return "➕";
      case "unfollow":
        return "➖";
      default:
        return "⚡";
    }
  };

  const getStatusBadge = (status: string, success: boolean) => {
    if (status === "COMPLETED") {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Exitosa
        </Badge>
      );
    }
    if (status === "FAILED") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Falló
        </Badge>
      );
    }
    if (status === "RUNNING") {
      return (
        <Badge variant="secondary" className="bg-blue-600 text-white">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          Ejecutando
        </Badge>
      );
    }
    if (status === "CANCELLED") {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Cancelada
        </Badge>
      );
    }
    if (status === "QUEUED") {
      return (
        <Badge variant="outline" className="border-purple-500 text-purple-600">
          <CalendarIcon className="w-3 h-3 mr-1" />
          En Cola
        </Badge>
      );
    }
    // Por defecto, se asume QUEUED
    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        En Cola
      </Badge>
    );
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Ahora";
    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-ES");
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchHistory();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header limpio y moderno */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <Activity className="h-6 w-6 text-gray-700" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Historial Completo de Acciones
                </h1>
              </div>
              <p className="text-gray-600">
                Registro detallado de todas las acciones ejecutadas en el
                sistema
              </p>
              <div className="mt-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                💡 <strong>Tip:</strong> Por defecto se muestran solo acciones
                ejecutadas. Usa el filtro "Estado" para ver acciones programadas
                o cambiar la vista.
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={exportHistory}
                variant="outline"
                className="border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button
                onClick={() => {
                  fetchHistory();
                  fetchStats();
                }}
                variant="outline"
                disabled={loading}
                className="border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Estadísticas limpias */}
        {stats && typeof stats.total === "number" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Total Acciones
                  </CardTitle>
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.total.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600">
                  Últimos {dateRange} días
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Exitosas
                  </CardTitle>
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-green-600">
                  {stats.successful.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600">
                  {stats.successRate.toFixed(1)}% tasa de éxito
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Fallidas
                  </CardTitle>
                  <div className="bg-red-100 p-2 rounded-lg">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-red-600">
                  {stats.failed.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600">
                  {((stats.failed / stats.total) * 100).toFixed(1)}% del total
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Rendimiento
                  </CardTitle>
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-600">Tasa de éxito general</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros con diseño limpio */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <Filter className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-lg text-gray-900">
                  Filtros de Búsqueda
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Filtra las acciones por diferentes criterios
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Usuario, texto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10 border-gray-300 focus:border-gray-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Tipo de Acción
                </label>
                <Select
                  value={selectedAction}
                  onValueChange={setSelectedAction}
                >
                  <SelectTrigger className="border-gray-300 focus:border-gray-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="all">Todas las acciones</SelectItem>
                    <SelectItem value="tweet">📝 Tweets</SelectItem>
                    <SelectItem value="reply">💬 Respuestas</SelectItem>
                    <SelectItem value="like">❤️ Likes</SelectItem>
                    <SelectItem value="retweet">🔄 Retweets</SelectItem>
                    <SelectItem value="follow">➕ Follows</SelectItem>
                    <SelectItem value="unfollow">➖ Unfollows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Estado
                </label>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="border-gray-300 focus:border-gray-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="completed">✅ Completadas</SelectItem>
                    <SelectItem value="failed">❌ Fallidas</SelectItem>
                    <SelectItem value="running">🔄 Ejecutando</SelectItem>
                    <SelectItem value="cancelled">⏹️ Canceladas</SelectItem>
                    <SelectItem value="scheduled">📅 En Cola</SelectItem>
                    <SelectItem value="executed">⚡ Solo Ejecutadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Cuenta
                </label>
                <Input
                  placeholder="@username"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="border-gray-300 focus:border-gray-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Período
                </label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="border-gray-300 focus:border-gray-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="1">Último día</SelectItem>
                    <SelectItem value="7">Última semana</SelectItem>
                    <SelectItem value="30">Último mes</SelectItem>
                    <SelectItem value="90">Últimos 3 meses</SelectItem>
                    <SelectItem value="365">Último año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla con diseño limpio */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 border-b border-gray-200 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-gray-700" />
              </div>
              <CardTitle className="text-lg text-gray-900">
                Historial de Acciones
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">
                      Fecha/Hora
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Cuenta
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Acción
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Contenido
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Estado
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Duración
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-gray-600" />
                          <span className="text-gray-700">
                            Cargando historial...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : actions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center space-y-2">
                          <Activity className="h-8 w-8 text-gray-400 opacity-50" />
                          <p className="text-gray-600">
                            No se encontraron acciones
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    actions.map((action) => (
                      <TableRow
                        key={action._id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">
                              {formatRelativeTime(action.createdAt)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(action.createdAt).toLocaleString(
                                "es-ES"
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border border-gray-200">
                                <AvatarImage
                                  src={`https://unavatar.io/twitter/${action.username}`}
                                  alt={`@${action.username}`}
                                />
                                <AvatarFallback className="bg-gray-100 text-gray-700 text-xs font-semibold">
                                  {action.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <a
                                href={`https://twitter.com/${action.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:underline"
                              >
                                @{action.username}
                              </a>
                            </div>
                            {action.accountLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {action.accountLabels
                                  .slice(0, 2)
                                  .map((label, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-xs border-gray-300 text-gray-600"
                                    >
                                      {label.length > 15
                                        ? label.substring(0, 15) + "..."
                                        : label}
                                    </Badge>
                                  ))}
                                {action.accountLabels.length > 2 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-gray-300 text-gray-600"
                                  >
                                    +{action.accountLabels.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {getActionIcon(action.action)}
                            </span>
                            <span className="font-medium capitalize text-gray-900">
                              {action.action}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="max-w-xs py-4">
                          {action.text && (
                            <div
                              className="text-sm truncate text-gray-700"
                              title={action.text}
                            >
                              {action.text}
                            </div>
                          )}
                          {action.tweetId && (
                            <div className="text-xs text-gray-500">
                              Tweet: {action.tweetId}
                            </div>
                          )}
                          {(action.action === "follow" ||
                            action.action === "unfollow") && (
                            <div className="text-xs text-gray-500">
                              {action.targetUsername ? (
                                <>
                                  Target:{" "}
                                  <a
                                    href={`https://twitter.com/${action.targetUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    @{action.targetUsername}
                                  </a>
                                </>
                              ) : action.targetUserId ? (
                                <>Target ID: {action.targetUserId}</>
                              ) : (
                                "Target: No especificado"
                              )}
                            </div>
                          )}
                          {action.batchId && (
                            <Badge
                              variant="outline"
                              className="text-xs mt-1 border-gray-300 text-gray-600"
                            >
                              Lote: {action.batchId}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="space-y-1">
                            {getStatusBadge(action.status, action.success)}
                            {action.error && (
                              <div
                                className="text-xs text-red-600 max-w-xs truncate"
                                title={action.error}
                              >
                                {action.error}
                              </div>
                            )}
                            {action.status === "QUEUED" && (
                              <div className="text-xs text-purple-600">
                                🔮 Acción en cola de ejecución
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-sm text-gray-500 py-4">
                          {action.completedAt
                            ? (() => {
                                const start = new Date(action.createdAt);
                                const end = new Date(action.completedAt);
                                const durationMs =
                                  end.getTime() - start.getTime();
                                const duration = Math.round(durationMs / 1000);
                                return `${duration}s`;
                              })()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación limpia */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={
                          currentPage <= 1
                            ? "pointer-events-none opacity-50"
                            : "hover:bg-gray-100"
                        }
                      />
                    </PaginationItem>

                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const page = i + 1;
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={currentPage === page}
                            className="hover:bg-gray-100"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages)
                            setCurrentPage(currentPage + 1);
                        }}
                        className={
                          currentPage >= totalPages
                            ? "pointer-events-none opacity-50"
                            : "hover:bg-gray-100"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
