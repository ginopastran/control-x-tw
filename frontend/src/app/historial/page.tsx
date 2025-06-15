"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
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
      setActions(data.actions);
      setTotalPages(Math.ceil(data.total / itemsPerPage));
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
    if (status === "completed" && success) {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Exitosa
        </Badge>
      );
    } else if (status === "completed" && !success) {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Falló
        </Badge>
      );
    } else if (status === "running") {
      return (
        <Badge variant="secondary" className="bg-blue-600 text-white">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          Ejecutando
        </Badge>
      );
    } else if (status === "cancelled") {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Cancelada
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          En Cola
        </Badge>
      );
    }
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
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Historial Completo de Acciones
          </h1>
          <p className="text-muted-foreground mt-2">
            Registro detallado de todas las acciones ejecutadas en el sistema
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={exportHistory}
            variant="outline"
            className="hover:scale-105 transition-transform"
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
            className="hover:scale-105 transition-transform"
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

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Total Acciones
                </CardTitle>
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.total.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Últimos {dateRange} días
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Exitosas</CardTitle>
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.successful.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate.toFixed(1)}% tasa de éxito
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Fallidas</CardTitle>
                <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {((stats.failed / stats.total) * 100).toFixed(1)}% del total
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Rendimiento
                </CardTitle>
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Tasa de éxito general
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Usuario, texto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Acción</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <label className="text-sm font-medium">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="completed">✅ Completadas</SelectItem>
                  <SelectItem value="failed">❌ Fallidas</SelectItem>
                  <SelectItem value="running">🔄 Ejecutando</SelectItem>
                  <SelectItem value="cancelled">⏹️ Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta</label>
              <Input
                placeholder="@username"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

      {/* Tabla de Historial */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Historial de Acciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Contenido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Cargando historial...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">
                          No se encontraron acciones
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((action) => (
                    <TableRow key={action._id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {formatRelativeTime(action.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(action.createdAt).toLocaleString("es-ES")}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {action.username[0].toUpperCase()}
                            </div>
                            <span className="font-medium">
                              @{action.username}
                            </span>
                          </div>
                          {action.accountLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {action.accountLabels
                                .slice(0, 2)
                                .map((label, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {label.length > 15
                                      ? label.substring(0, 15) + "..."
                                      : label}
                                  </Badge>
                                ))}
                              {action.accountLabels.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{action.accountLabels.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {getActionIcon(action.action)}
                          </span>
                          <span className="font-medium capitalize">
                            {action.action}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs">
                        {action.text && (
                          <div className="text-sm truncate" title={action.text}>
                            {action.text}
                          </div>
                        )}
                        {action.tweetId && (
                          <div className="text-xs text-muted-foreground">
                            Tweet: {action.tweetId}
                          </div>
                        )}
                        {action.targetUserId && (
                          <div className="text-xs text-muted-foreground">
                            Usuario: {action.targetUserId}
                          </div>
                        )}
                        {action.batchId && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Lote: {action.batchId}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
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
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
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

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
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
                        currentPage <= 1 ? "pointer-events-none opacity-50" : ""
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
                          : ""
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
  );
}
