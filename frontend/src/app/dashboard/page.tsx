"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Progress,
  Button,
  Input,
  Divider,
  Spinner,
  Tooltip,
  Tabs,
  Tab,
  Pagination,
} from "@heroui/react";

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
  stats: {
    queueLength: number;
    runningCount: number;
    completedToday: number;
    failedToday: number;
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

export default function Dashboard() {
  const [accountLimits, setAccountLimits] = useState<AccountLimits[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    queue: [],
    running: [],
    history: [],
    stats: {
      queueLength: 0,
      runningCount: 0,
      completedToday: 0,
      failedToday: 0,
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

  const fetchAccountLimits = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/account-limits");
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
        `http://localhost:3001/api/queue/status?historyPage=${historyPage}&historyLimit=${historyPerPage}`
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
        "http://localhost:3001/api/metrics/realtime"
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
    if (percentage >= 90) return "danger";
    if (percentage >= 70) return "warning";
    return "success";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "limited":
        return "warning";
      case "suspended":
        return "danger";
      case "error":
        return "danger";
      default:
        return "default";
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
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

  // Estadísticas calculadas
  const totalLimitedAccounts = accountLimits.filter(
    (a: AccountLimits) => a.status === "limited"
  ).length;
  const totalSuspendedAccounts = accountLimits.filter(
    (a: AccountLimits) => a.status === "suspended"
  ).length;
  const totalActiveAccounts = accountLimits.filter(
    (a: AccountLimits) => a.status === "active"
  ).length;
  const totalErrorAccounts = accountLimits.filter(
    (a: AccountLimits) => a.status === "error"
  ).length;

  // Función para cancelar una acción
  const cancelAction = async (actionId: string) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/queue/${actionId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Actualizar estado local
        fetchQueueStatus();
        // Mostrar mensaje de éxito (opcional)
      } else {
        throw new Error("Error al cancelar acción");
      }
    } catch (error) {
      console.error("Error cancelando acción:", error);
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
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

  const getActionDescription = (action: any) => {
    switch (action.action) {
      case "tweet":
        return action.text
          ? action.text.length > 50
            ? `${action.text.substring(0, 50)}...`
            : action.text
          : "Nuevo tweet";
      case "retweet":
        return action.tweetId
          ? `Retweet del tweet: ${action.tweetId}`
          : "Retweet";
      case "like":
        return action.tweetId ? `Like al tweet: ${action.tweetId}` : "Like";
      case "reply":
        return action.text
          ? `Reply: ${
              action.text.length > 40
                ? action.text.substring(0, 40) + "..."
                : action.text
            }`
          : "Reply";
      case "follow":
        return action.targetUserId
          ? `Seguir a: ${action.targetUserId}`
          : "Seguir usuario";
      case "unfollow":
        return action.targetUserId
          ? `Dejar de seguir a: ${action.targetUserId}`
          : "Dejar de seguir";
      default:
        return action.text || "Sin contenido específico";
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

  const getActionColor = (action: string) => {
    switch (action) {
      case "tweet":
        return "primary";
      case "like":
        return "danger";
      case "retweet":
        return "success";
      case "reply":
        return "secondary";
      case "follow":
        return "warning";
      case "unfollow":
        return "default";
      default:
        return "warning";
    }
  };

  // Función para renderizar los labels de las cuentas
  const renderAccountLabels = (labels?: string[]) => {
    if (!labels || labels.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {labels.map((label) => (
          <Chip
            key={label}
            size="sm"
            variant="flat"
            color="secondary"
            className="text-xs"
          >
            {label}
          </Chip>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard de Límites</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitorea el uso y límites de todas las cuentas de X
            </p>
          </div>
          <Button
            color="primary"
            variant="flat"
            onClick={fetchAccountLimits}
            isLoading={refreshing}
          >
            Actualizar
          </Button>
        </CardHeader>
        <CardBody>
          <Input
            label="Buscar cuentas"
            placeholder="Username o etiqueta..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="max-w-md"
            startContent={
              <svg
                className="w-4 h-4 text-gray-400"
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
            }
          />
        </CardBody>
      </Card>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-green-600">
              {totalActiveAccounts}
            </h3>
            <p className="text-sm text-gray-600">Cuentas Activas</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-yellow-600">
              {totalLimitedAccounts}
            </h3>
            <p className="text-sm text-gray-600">Cuentas Limitadas</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-red-600">
              {totalSuspendedAccounts}
            </h3>
            <p className="text-sm text-gray-600">Cuentas Suspendidas</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-blue-600">
              {accountLimits.length}
            </h3>
            <p className="text-sm text-gray-600">Total Cuentas</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabla de cuentas */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Detalles por Cuenta</h2>
        </CardHeader>
        <CardBody>
          <Table aria-label="Límites de cuentas">
            <TableHeader>
              <TableColumn>CUENTA</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn>TWEETS</TableColumn>
              <TableColumn>FOLLOWS</TableColumn>
              <TableColumn>LIKES</TableColumn>
              <TableColumn>RETWEETS</TableColumn>
              <TableColumn>ÚLTIMA ACTIVIDAD</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account._id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">@{account.username}</p>
                      {renderAccountLabels(account.labels)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color={getStatusColor(account.status)} variant="flat">
                      {account.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress
                        value={
                          (account.dailyLimits.tweets.used /
                            account.dailyLimits.tweets.limit) *
                          100
                        }
                        color={getProgressColor(
                          account.dailyLimits.tweets.used,
                          account.dailyLimits.tweets.limit
                        )}
                        size="sm"
                      />
                      <p className="text-xs text-gray-600">
                        {account.dailyLimits.tweets.used}/
                        {account.dailyLimits.tweets.limit}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reset:{" "}
                        {getTimeUntilReset(account.dailyLimits.tweets.reset)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress
                        value={
                          (account.dailyLimits.follows.used /
                            account.dailyLimits.follows.limit) *
                          100
                        }
                        color={getProgressColor(
                          account.dailyLimits.follows.used,
                          account.dailyLimits.follows.limit
                        )}
                        size="sm"
                      />
                      <p className="text-xs text-gray-600">
                        {account.dailyLimits.follows.used}/
                        {account.dailyLimits.follows.limit}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reset:{" "}
                        {getTimeUntilReset(account.dailyLimits.follows.reset)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress
                        value={
                          (account.dailyLimits.likes.used /
                            account.dailyLimits.likes.limit) *
                          100
                        }
                        color={getProgressColor(
                          account.dailyLimits.likes.used,
                          account.dailyLimits.likes.limit
                        )}
                        size="sm"
                      />
                      <p className="text-xs text-gray-600">
                        {account.dailyLimits.likes.used}/
                        {account.dailyLimits.likes.limit}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reset:{" "}
                        {getTimeUntilReset(account.dailyLimits.likes.reset)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress
                        value={
                          (account.dailyLimits.retweets.used /
                            account.dailyLimits.retweets.limit) *
                          100
                        }
                        color={getProgressColor(
                          account.dailyLimits.retweets.used,
                          account.dailyLimits.retweets.limit
                        )}
                        size="sm"
                      />
                      <p className="text-xs text-gray-600">
                        {account.dailyLimits.retweets.used}/
                        {account.dailyLimits.retweets.limit}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reset:{" "}
                        {getTimeUntilReset(account.dailyLimits.retweets.reset)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-600">
                      {formatTime(account.lastActivity)}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">
            ℹ️ Información sobre Límites
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Límites Diarios por Acción</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>
                  • <strong>Tweets:</strong> Hasta 300 por día
                </li>
                <li>
                  • <strong>Follows:</strong> Hasta 400 por día
                </li>
                <li>
                  • <strong>Likes:</strong> Hasta 1,000 por día
                </li>
                <li>
                  • <strong>Retweets:</strong> Hasta 600 por día
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Estados de Cuenta</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>
                  • <strong>Active:</strong> Funcionando normalmente
                </li>
                <li>
                  • <strong>Limited:</strong> Cerca del límite diario
                </li>
                <li>
                  • <strong>Suspended:</strong> Cuenta suspendida
                </li>
                <li>
                  • <strong>Error:</strong> Error de conectividad
                </li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tabs para diferentes vistas */}
      <Card>
        <CardBody>
          <Tabs
            aria-label="Estado de acciones"
            color="primary"
            variant="underlined"
          >
            <Tab
              key="running"
              title={
                <div className="flex items-center space-x-2">
                  <span>🚀 Ejecutándose</span>
                  {queueStatus.running?.length > 0 && (
                    <Chip color="warning" variant="flat" size="sm">
                      {queueStatus.running.length} ejecutándose
                    </Chip>
                  )}
                </div>
              }
            >
              <div className="mt-4">
                {queueStatus?.running && queueStatus.running.length > 0 ? (
                  <div className="space-y-4">
                    {/* Acciones ejecutándose con mejor visualización */}
                    {queueStatus.running.map((action) => (
                      <Card
                        key={action.id}
                        className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950"
                      >
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl animate-pulse">
                                  {getActionIcon(action.action)}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      size="sm"
                                      color={
                                        getActionColor(action.action) as any
                                      }
                                      variant="solid"
                                      className="animate-pulse"
                                    >
                                      {action.action.toUpperCase()}
                                    </Chip>
                                    <span className="font-bold text-orange-700 dark:text-orange-300">
                                      {renderAccountLabels(
                                        action.accountLabels
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {getActionDescription(action)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                Iniciado: {formatRelativeTime(action.startedAt)}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Spinner size="sm" color="warning" />
                                <span className="text-xs text-orange-600 dark:text-orange-400">
                                  Ejecutando...
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Barra de progreso visual */}
                          <div className="mt-3">
                            <Progress
                              value={action.progress || 50}
                              className="max-w-full"
                              color="warning"
                              size="sm"
                              isIndeterminate
                              label={`Procesando ${action.action}...`}
                            />
                          </div>
                        </CardBody>
                      </Card>
                    ))}

                    {/* Tabla adicional para vista compacta */}
                    <Divider className="my-4" />
                    <Table aria-label="Acciones en ejecución" className="mt-4">
                      <TableHeader>
                        <TableColumn>ACCIÓN</TableColumn>
                        <TableColumn>CUENTA</TableColumn>
                        <TableColumn>CONTENIDO</TableColumn>
                        <TableColumn>ESTADO</TableColumn>
                        <TableColumn>INICIADO</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {queueStatus.running.map((action) => (
                          <TableRow key={`table-${action.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="animate-pulse">
                                  {getActionIcon(action.action)}
                                </span>
                                <Chip
                                  size="sm"
                                  color={getActionColor(action.action) as any}
                                  variant="flat"
                                  className="animate-pulse"
                                >
                                  {action.action}
                                </Chip>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-semibold text-orange-600">
                                  @{action.accountUsername}
                                </span>
                                {renderAccountLabels(action.accountLabels)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Tooltip content={getActionDescription(action)}>
                                <span className="text-sm truncate max-w-xs block">
                                  {getActionDescription(action).length > 30
                                    ? `${getActionDescription(action).substring(
                                        0,
                                        30
                                      )}...`
                                    : getActionDescription(action)}
                                </span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Spinner size="sm" color="warning" />
                                <span className="text-xs text-orange-600">
                                  Ejecutando
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">
                                {formatRelativeTime(action.startedAt)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">😴</div>
                    <p className="text-gray-500 text-lg">
                      No hay acciones ejecutándose
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Las acciones aparecerán aquí cuando se estén procesando
                    </p>
                  </div>
                )}
              </div>
            </Tab>

            <Tab
              key="queue"
              title={
                <div className="flex items-center space-x-2">
                  <span>⏳ En Cola</span>
                  {queueStatus.queue?.length > 0 && (
                    <Chip color="primary" variant="flat" size="sm">
                      {queueStatus.queue.length} en cola
                    </Chip>
                  )}
                </div>
              }
            >
              <div className="mt-4">
                {queueStatus?.queue && queueStatus.queue.length > 0 ? (
                  <Table aria-label="Acciones en cola">
                    <TableHeader>
                      <TableColumn>POSICIÓN</TableColumn>
                      <TableColumn>ACCIÓN</TableColumn>
                      <TableColumn>CUENTA</TableColumn>
                      <TableColumn>CONTENIDO</TableColumn>
                      <TableColumn>ESTIMADO</TableColumn>
                      <TableColumn>ACCIONES</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {queueStatus.queue.map((action, index) => (
                        <TableRow key={action.id}>
                          <TableCell>
                            <Chip size="sm" color="default" variant="flat">
                              #{index + 1}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" color="warning" variant="flat">
                              {action.action}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-semibold">
                                @{action.accountUsername}
                              </span>
                              {renderAccountLabels(action.accountLabels)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip content={action.text}>
                              <span className="text-sm truncate max-w-xs block">
                                {action.text}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">
                              {formatRelativeTime(action.estimatedStartTime)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              color="danger"
                              variant="light"
                              onPress={() => cancelAction(action.id)}
                            >
                              Cancelar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No hay acciones en cola</p>
                  </div>
                )}
              </div>
            </Tab>

            <Tab
              key="history"
              title={
                <div className="flex items-center space-x-2">
                  <span>📝 Historial</span>
                  {totalHistoryItems > 0 && (
                    <Chip size="sm" color="default">
                      {totalHistoryItems}
                    </Chip>
                  )}
                </div>
              }
            >
              <div className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Historial de Acciones ({totalHistoryItems} total)
                  </h3>
                </div>

                {queueStatus?.history && queueStatus.history.length > 0 ? (
                  <div className="space-y-4">
                    <Table aria-label="Historial de acciones">
                      <TableHeader>
                        <TableColumn>ACCIÓN</TableColumn>
                        <TableColumn>CUENTA</TableColumn>
                        <TableColumn>CONTENIDO</TableColumn>
                        <TableColumn>ESTADO</TableColumn>
                        <TableColumn>COMPLETADO</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {queueStatus.history.map((action, index) => (
                          <TableRow key={`${action.id}-${index}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{getActionIcon(action.action)}</span>
                                <Chip
                                  size="sm"
                                  color={getActionColor(action.action) as any}
                                  variant="flat"
                                >
                                  {action.action}
                                </Chip>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-semibold">
                                  @{action.accountUsername}
                                </span>
                                {renderAccountLabels(action.accountLabels)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Tooltip
                                content={
                                  action.status === "failed" && action.error
                                    ? `Error: ${action.error}`
                                    : getActionDescription(action)
                                }
                                className="max-w-xs"
                              >
                                <span className="text-sm truncate max-w-xs block cursor-help">
                                  {action.status === "failed" && action.error
                                    ? `❌ ${
                                        action.error.length > 30
                                          ? action.error.substring(0, 30) +
                                            "..."
                                          : action.error
                                      }`
                                    : getActionDescription(action).length > 30
                                    ? `${getActionDescription(action).substring(
                                        0,
                                        30
                                      )}...`
                                    : getActionDescription(action)}
                                </span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip
                                content={
                                  action.status === "failed" && action.error
                                    ? `Error completo: ${action.error}`
                                    : action.status === "completed"
                                    ? "Acción completada exitosamente"
                                    : action.status === "cancelled"
                                    ? "Acción cancelada por el usuario"
                                    : "Estado desconocido"
                                }
                              >
                                <Chip
                                  size="sm"
                                  color={
                                    action.status === "completed"
                                      ? "success"
                                      : action.status === "failed"
                                      ? "danger"
                                      : "warning"
                                  }
                                  variant="flat"
                                  className="cursor-help"
                                >
                                  {action.status === "completed" &&
                                    "✅ Completado"}
                                  {action.status === "failed" && "❌ Fallido"}
                                  {action.status === "cancelled" &&
                                    "⚠️ Cancelado"}
                                </Chip>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">
                                {formatRelativeTime(action.completedAt)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Paginación */}
                    {totalHistoryItems > historyPerPage && (
                      <div className="flex justify-center mt-4">
                        <Pagination
                          total={Math.ceil(totalHistoryItems / historyPerPage)}
                          page={historyPage}
                          onChange={setHistoryPage}
                          showControls
                          showShadow
                          color="primary"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-gray-500 text-lg">
                      No hay historial de acciones
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Las acciones completadas aparecerán aquí
                    </p>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Estadísticas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-lg font-semibold text-blue-600">🔄 En Cola</h4>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-bold">
              {queueStatus.queue?.length || 0}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-lg font-semibold text-orange-600">
              ⚡ Ejecutándose
            </h4>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-bold">
              {queueStatus.running?.length || 0}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-lg font-semibold text-green-600">
              ✅ Completadas Hoy
            </h4>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-bold">
              {realtimeMetrics?.totalActionsToday || 0}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Cola y Estado de Acciones */}
      {(queueStatus.queue?.length > 0 ||
        queueStatus.running?.length > 0 ||
        queueStatus.history?.length > 0) && (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold">
              📊 Estado de Acciones en Tiempo Real
            </h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {/* Acciones en ejecución */}
              {queueStatus.running?.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-orange-600 mb-3">
                    ⚡ Ejecutándose Ahora
                  </h4>
                  <div className="space-y-2">
                    {queueStatus.running.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-orange-600">⚡</span>
                          <div>
                            <span className="font-medium">
                              @{action.accountUsername}
                            </span>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Chip size="sm" color="warning" variant="flat">
                            {action.action}
                          </Chip>
                        </div>
                        <span className="text-sm text-gray-500">
                          Iniciado:{" "}
                          {new Date(action.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cola de acciones */}
              {queueStatus.queue?.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-blue-600 mb-3">
                    🔄 En Cola
                  </h4>
                  <div className="space-y-2">
                    {queueStatus.queue.slice(0, 5).map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-blue-600">🔄</span>
                          <div>
                            <span className="font-medium">
                              @{action.accountUsername}
                            </span>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Chip size="sm" color="primary" variant="flat">
                            {action.action}
                          </Chip>
                        </div>
                        <span className="text-sm text-gray-500">
                          Estimado:{" "}
                          {new Date(
                            action.estimatedStartTime
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    {queueStatus.queue.length > 5 && (
                      <div className="text-center text-sm text-gray-500">
                        Y {queueStatus.queue.length - 5} más en cola...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Historial reciente */}
              {queueStatus.history?.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-green-600 mb-3">
                    📝 Historial Reciente
                  </h4>
                  <div className="space-y-2">
                    {queueStatus.history.slice(0, 5).map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              action.status === "completed"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {action.status === "completed" ? "✅" : "❌"}
                          </span>
                          <div>
                            <span className="font-medium">
                              @{action.accountUsername}
                            </span>
                            {renderAccountLabels(action.accountLabels)}
                          </div>
                          <Chip
                            size="sm"
                            color={
                              action.status === "completed"
                                ? "success"
                                : "danger"
                            }
                            variant="flat"
                          >
                            {action.action}
                          </Chip>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>
                            {new Date(action.completedAt).toLocaleTimeString()}
                          </div>
                          {action.error && (
                            <div className="text-red-500 text-xs">
                              {action.error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Métricas adicionales */}
              {realtimeMetrics && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    📈 Métricas del Sistema
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Cuentas Activas:</span>
                      <span className="font-bold ml-2">
                        {realtimeMetrics.activeAccounts}/
                        {realtimeMetrics.totalAccounts}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Acciones Hoy:</span>
                      <span className="font-bold ml-2">
                        {realtimeMetrics.totalActionsToday}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tasa de Éxito:</span>
                      <span className="font-bold ml-2">
                        {realtimeMetrics.successRate}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Última Acción:</span>
                      <span className="font-bold ml-2">
                        {realtimeMetrics.lastActionTime
                          ? new Date(
                              realtimeMetrics.lastActionTime
                            ).toLocaleTimeString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
