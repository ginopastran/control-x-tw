"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  DatePicker,
  TimeInput,
  addToast,
} from "@heroui/react";
import { CalendarDate, Time } from "@internationalized/date";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import AccountSelector from "@/components/AccountSelector";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface ScheduledAction {
  id: string;
  action: "tweet" | "reply" | "like" | "retweet" | "follow" | "unfollow";
  accountIds: string[];
  text?: string;
  tweetId?: string;
  targetUserId?: string;
  scheduledTime: string;
  baseDelay: number;
  randomDelay: number;
  status: "scheduled" | "executing" | "completed" | "error";
  createdAt: string;
}

export default function SchedulePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Estados del formulario
  const [actionType, setActionType] = useState<
    "tweet" | "reply" | "like" | "retweet" | "follow" | "unfollow" | ""
  >("");
  const [text, setText] = useState("");
  const [tweetId, setTweetId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [scheduledDate, setScheduledDate] = useState<CalendarDate | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Time | null>(null);
  const [baseDelay, setBaseDelay] = useState(30);
  const [randomDelay, setRandomDelay] = useState(60);

  const {
    isOpen: isScheduleOpen,
    onOpen: onScheduleOpen,
    onOpenChange: onScheduleOpenChange,
  } = useDisclosure();

  useEffect(() => {
    fetchAccounts();
    fetchScheduledActions();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/accounts");
      if (!response.ok) throw new Error("Error al cargar cuentas");
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      addToast({
        title: "Error",
        description: "Error al cargar las cuentas",
        color: "danger",
      });
    }
  };

  const fetchScheduledActions = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/queue/status");
      if (!response.ok) throw new Error("Error al cargar acciones programadas");
      const data = await response.json();
      setScheduledActions(data.scheduled || []);
    } catch (err) {
      console.error("Error al cargar acciones programadas:", err);
    }
  };

  const extractTweetId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const statusIndex = pathParts.indexOf("status");
      return statusIndex !== -1 && pathParts[statusIndex + 1]
        ? pathParts[statusIndex + 1]
        : null;
    } catch {
      return null;
    }
  };

  const extractAndValidateUserId = (input: string): string | null => {
    if (!input?.trim()) return null;

    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }

    try {
      const url = new URL(input);
      if (
        url.hostname.includes("twitter.com") ||
        url.hostname.includes("x.com")
      ) {
        const pathParts = url.pathname.split("/").filter((part) => part);
        if (pathParts.length > 0) {
          const username = pathParts[0];
          if (/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
            return username;
          }
        }
      }
    } catch {}

    const cleanUsername = input.trim().replace(/^@/, "");
    if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername)) {
      return cleanUsername;
    }

    return null;
  };

  const scheduleAction = async () => {
    if (!actionType) {
      addToast({
        title: "Error",
        description: "Selecciona un tipo de acción",
        color: "danger",
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      addToast({
        title: "Error",
        description: "Selecciona al menos una cuenta",
        color: "danger",
      });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      addToast({
        title: "Error",
        description: "Selecciona fecha y hora",
        color: "danger",
      });
      return;
    }

    // Validaciones específicas por tipo de acción
    if (["tweet", "reply"].includes(actionType) && !text.trim()) {
      addToast({
        title: "Error",
        description: "El texto es requerido para tweets y respuestas",
        color: "danger",
      });
      return;
    }

    if (["like", "retweet", "reply"].includes(actionType)) {
      const validatedTweetId = extractTweetId(tweetId);
      if (!validatedTweetId) {
        addToast({
          title: "Error",
          description: "URL o ID de tweet inválido",
          color: "danger",
        });
        return;
      }
    }

    if (["follow", "unfollow"].includes(actionType)) {
      const validatedUserId = extractAndValidateUserId(targetUserId);
      if (!validatedUserId) {
        addToast({
          title: "Error",
          description: "Usuario inválido",
          color: "danger",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Crear fecha y hora programada en zona horaria argentina
      const argentineTimeZone = "America/Argentina/Buenos_Aires";

      // Crear fecha local en zona horaria argentina
      const localDateTime = new Date(
        scheduledDate.year,
        scheduledDate.month - 1,
        scheduledDate.day,
        scheduledTime.hour,
        scheduledTime.minute
      );

      // Convertir la fecha local argentina a UTC para el backend
      const scheduledDateTime = fromZonedTime(localDateTime, argentineTimeZone);

      // Verificar que la fecha sea futura (comparar en hora argentina)
      const nowInArgentina = toZonedTime(new Date(), argentineTimeZone);
      if (localDateTime <= nowInArgentina) {
        addToast({
          title: "Error",
          description: "La fecha y hora debe ser futura (hora argentina)",
          color: "danger",
        });
        return;
      }

      console.log(
        "🇦🇷 Fecha programada (Argentina):",
        formatInTimeZone(
          scheduledDateTime,
          argentineTimeZone,
          "yyyy-MM-dd HH:mm:ss zzz"
        )
      );
      console.log(
        "🌍 Fecha programada (UTC):",
        scheduledDateTime.toISOString()
      );

      const response = await fetch("http://localhost:3001/api/queue/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: actionType,
          accountIds: selectedAccounts,
          text: text.trim() || undefined,
          tweetId: extractTweetId(tweetId) || undefined,
          targetUserId: extractAndValidateUserId(targetUserId) || undefined,
          baseDelay: baseDelay * 1000,
          randomDelay: randomDelay * 1000,
          scheduledTime: scheduledDateTime.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al programar acción");
      }

      const result = await response.json();

      addToast({
        title: "Acción Programada",
        description: `${
          result.actions.length
        } acciones programadas para ${formatInTimeZone(
          scheduledDateTime,
          argentineTimeZone,
          "dd/MM/yyyy 'a las' HH:mm 'hs (Argentina)'"
        )}`,
        color: "success",
      });

      // Limpiar formulario
      setActionType("");
      setSelectedAccounts([]);
      setText("");
      setTweetId("");
      setTargetUserId("");
      setScheduledDate(null);
      setScheduledTime(null);
      setBaseDelay(30);
      setRandomDelay(60);

      // Cerrar modal y refrescar datos
      onScheduleOpenChange();
      fetchScheduledActions();
    } catch (error: any) {
      console.error("Error programando acción:", error);
      addToast({
        title: "Error",
        description: error.message || "Error al programar acción",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelScheduledAction = async (actionId: string) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/queue/cancel/${actionId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cancelar acción");
      }

      const result = await response.json();

      addToast({
        title: "Acción Cancelada",
        description: `Acción ${result.canceledAction.action} para @${result.canceledAction.username} cancelada`,
        color: "success",
      });

      // Refrescar datos
      fetchScheduledActions();
    } catch (error: any) {
      console.error("Error cancelando acción:", error);
      addToast({
        title: "Error",
        description: error.message || "Error al cancelar acción",
        color: "danger",
      });
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a._id === accountId);
    return account ? account.username : accountId;
  };

  const formatScheduledTime = (timeString: string) => {
    const argentineTimeZone = "America/Argentina/Buenos_Aires";
    try {
      return formatInTimeZone(
        new Date(timeString),
        argentineTimeZone,
        "dd/MM/yyyy HH:mm 'hs (Argentina)'"
      );
    } catch (error) {
      return "Fecha inválida";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "tweet":
        return "📝";
      case "reply":
        return "💬";
      case "like":
        return "❤️";
      case "retweet":
        return "🔄";
      case "follow":
        return "➕";
      case "unfollow":
        return "➖";
      default:
        return "📋";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "primary";
      case "executing":
        return "warning";
      case "completed":
        return "success";
      case "error":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">📅 Programar Acciones</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Programa acciones de Twitter para ejecutar en fechas y horas
            específicas
          </p>
        </div>
        <Button
          color="primary"
          onPress={onScheduleOpen}
          size="lg"
          startContent="⏰"
        >
          Nueva Acción Programada
        </Button>
      </div>

      {/* Lista de acciones programadas */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">🗓️ Acciones Programadas</h2>
        </CardHeader>
        <CardBody>
          {scheduledActions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay acciones programadas</p>
              <p className="text-sm">
                Haz clic en "Nueva Acción Programada" para comenzar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledActions.map((action) => (
                <div
                  key={action.id}
                  className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {getActionIcon(action.action)}
                        </span>
                        <span className="font-medium capitalize">
                          {action.action}
                        </span>
                        <Chip
                          color={getStatusColor(action.status)}
                          size="sm"
                          variant="flat"
                        >
                          {action.status}
                        </Chip>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        📅 {formatScheduledTime(action.scheduledTime)}
                      </p>

                      {action.text && (
                        <p className="text-sm mb-2 p-2 bg-white dark:bg-gray-700 rounded">
                          "{action.text}"
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mb-2">
                        {(action.accountIds || []).map((accountId) => (
                          <Chip key={accountId} size="sm" variant="bordered">
                            @{getAccountName(accountId)}
                          </Chip>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500">
                        Delay: {action.baseDelay / 1000}s base +{" "}
                        {action.randomDelay / 1000}s aleatorio
                      </p>
                    </div>

                    {action.status === "scheduled" && (
                      <Button
                        color="danger"
                        variant="light"
                        size="sm"
                        onPress={() => cancelScheduledAction(action.id)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal para nueva acción programada */}
      <Modal
        isOpen={isScheduleOpen}
        onOpenChange={onScheduleOpenChange}
        size="2xl"
      >
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader>
                <h3 className="text-lg font-semibold">
                  📅 Programar Nueva Acción
                </h3>
              </ModalHeader>
              <ModalBody className="space-y-4">
                <Select
                  label="Tipo de Acción"
                  placeholder="Selecciona el tipo de acción"
                  selectedKeys={actionType ? [actionType] : []}
                  onSelectionChange={(keys: any) =>
                    setActionType(Array.from(keys)[0] as any)
                  }
                >
                  <SelectItem key="tweet">📝 Tweet</SelectItem>
                  <SelectItem key="reply">💬 Respuesta</SelectItem>
                  <SelectItem key="like">❤️ Like</SelectItem>
                  <SelectItem key="retweet">🔄 Retweet</SelectItem>
                  <SelectItem key="follow">👥 Seguir</SelectItem>
                  <SelectItem key="unfollow">👥❌ Dejar de seguir</SelectItem>
                </Select>

                {/* Campos específicos por tipo de acción */}
                {["tweet", "reply"].includes(actionType) && (
                  <Textarea
                    label="Texto"
                    placeholder="Escribe el contenido..."
                    value={text}
                    onValueChange={setText}
                    maxRows={4}
                    maxLength={280}
                    description={`${text.length}/280 caracteres`}
                  />
                )}

                {["like", "retweet", "reply"].includes(actionType) && (
                  <Input
                    label="URL o ID del Tweet"
                    placeholder="https://x.com/usuario/status/123456789 o 123456789"
                    value={tweetId}
                    onValueChange={setTweetId}
                    description="URL completa del tweet o solo el ID numérico"
                  />
                )}

                {["follow", "unfollow"].includes(actionType) && (
                  <Input
                    label="Usuario a seguir/dejar de seguir"
                    placeholder="@usuario, https://x.com/usuario o ID numérico"
                    value={targetUserId}
                    onValueChange={setTargetUserId}
                    description="Username, URL del perfil o ID numérico del usuario"
                  />
                )}

                {/* Selector de cuentas */}
                <div>
                  <AccountSelector
                    accounts={accounts}
                    selectedAccounts={selectedAccounts}
                    onSelectionChange={setSelectedAccounts}
                    title="Cuentas para ejecutar la acción"
                  />
                </div>

                {/* Fecha y hora */}
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="Fecha"
                    value={scheduledDate}
                    onChange={setScheduledDate}
                    minValue={
                      new CalendarDate(
                        new Date().getFullYear(),
                        new Date().getMonth() + 1,
                        new Date().getDate()
                      )
                    }
                  />
                  <TimeInput
                    label="Hora"
                    value={scheduledTime}
                    onChange={setScheduledTime}
                  />
                </div>

                {/* Configuración de delays */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Delay Base (segundos)"
                    value={baseDelay.toString()}
                    onValueChange={(value: any) =>
                      setBaseDelay(parseInt(value) || 30)
                    }
                    min="1"
                    max="3600"
                  />
                  <Input
                    type="number"
                    label="Delay Aleatorio (segundos)"
                    value={randomDelay.toString()}
                    onValueChange={(value: any) =>
                      setRandomDelay(parseInt(value) || 60)
                    }
                    min="0"
                    max="3600"
                  />
                </div>

                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Delay Total:</strong> {baseDelay} + 0-{randomDelay}{" "}
                    segundos
                  </p>
                  <p>
                    <strong>Rango:</strong> {baseDelay} -{" "}
                    {baseDelay + randomDelay} segundos entre acciones
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={scheduleAction}
                  isLoading={loading}
                  disabled={
                    !actionType ||
                    selectedAccounts.length === 0 ||
                    !scheduledDate ||
                    !scheduledTime
                  }
                >
                  {loading ? "Programando..." : "Programar Acción"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
