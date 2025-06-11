"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Textarea,
  Checkbox,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Chip,
  Divider,
  Progress,
  addToast,
  Switch,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Slider,
  Badge,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@heroui/react";
import AccountSelector from "@/components/AccountSelector";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface TweetAction {
  type: "tweet" | "reply" | "like" | "retweet" | "follow" | "unfollow";
  text?: string;
  tweetId?: string;
  targetUserId?: string;
}

interface BatchTweet {
  id: string;
  text: string;
  type: "tweet" | "reply";
  replyToTweetUrl?: string;
  assignedAccounts: string[];
  status: "pending" | "completed" | "error";
}

interface ActionResult {
  account: string;
  success: boolean;
  message: string;
  details?: string;
}

// Función de utilidad para esperar
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Función para realizar un intento con retraso exponencial
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<any> => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryableError =
        error.message?.includes("Too Many Requests") ||
        error.message?.includes("Rate limit") ||
        error.message?.includes("Service Unavailable") ||
        error.message?.includes("Internal Server Error") ||
        error.message?.includes("Bad Gateway") ||
        error.message?.includes("Gateway Timeout") ||
        error.message?.includes("timeout") ||
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504;

      if (isRetryableError) {
        retries++;
        if (retries === maxRetries) throw error;

        const exponentialDelay = baseDelay * Math.pow(2, retries);
        const jitter = Math.random() * 1000;
        const waitTime = exponentialDelay + jitter;

        console.log(
          `Intento ${retries}/${maxRetries} falló. Esperando ${Math.round(
            waitTime
          )}ms antes de reintentar...`
        );
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
};

export default function TweetsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionResults, setActionResults] = useState<ActionResult[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Estados para el tab activo
  const [activeTab, setActiveTab] = useState("tweet");

  // Estados para cada tipo de acción
  const [tweetText, setTweetText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTweetUrl, setReplyTweetUrl] = useState("");
  const [likeTweetUrl, setLikeTweetUrl] = useState("");
  const [retweetUrl, setRetweetUrl] = useState("");
  const [followUser, setFollowUser] = useState("");
  const [unfollowUser, setUnfollowUser] = useState("");

  // Estados para delays y configuración
  const [baseDelay, setBaseDelay] = useState(30);
  const [randomDelay, setRandomDelay] = useState(60);
  const [enableRandomDelay, setEnableRandomDelay] = useState(true);

  // Nuevos estados para control avanzado de delays
  const [delayMode, setDelayMode] = useState<"seconds" | "minutes">("seconds");
  const [useLongDelays, setUseLongDelays] = useState(false);

  // Estados para Lotes
  const [batchTweets, setBatchTweets] = useState<BatchTweet[]>([]);
  const [newTweetText, setNewTweetText] = useState("");
  const [newTweetType, setNewTweetType] = useState<"tweet" | "reply">("tweet");
  const [newReplyToTweetUrl, setNewReplyToTweetUrl] = useState("");
  const [selectedTweetForAssignment, setSelectedTweetForAssignment] = useState<
    string | null
  >(null);

  // Modal states
  const {
    isOpen: isPreviewOpen,
    onOpen: onPreviewOpen,
    onOpenChange: onPreviewOpenChange,
  } = useDisclosure();

  const {
    isOpen: isAddTweetOpen,
    onOpen: onAddTweetOpen,
    onOpenChange: onAddTweetOpenChange,
  } = useDisclosure();

  const {
    isOpen: isAssignAccountsOpen,
    onOpen: onAssignAccountsOpen,
    onOpenChange: onAssignAccountsOpenChange,
  } = useDisclosure();

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const labels = new Set<string>();
    accounts.forEach((account) => {
      account.labels?.forEach((label) => labels.add(label));
    });
    setAvailableLabels(Array.from(labels));
  }, [accounts]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
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

  const calculateDelay = (index: number) => {
    // Convertir a milisegundos basado en el modo seleccionado
    const baseMs =
      delayMode === "minutes" ? baseDelay * 60 * 1000 : baseDelay * 1000;

    let totalDelay = baseMs;

    if (enableRandomDelay) {
      const randomMs =
        delayMode === "minutes"
          ? Math.random() * randomDelay * 60 * 1000
          : Math.random() * randomDelay * 1000;
      totalDelay += randomMs;
    }

    return totalDelay;
  };

  const handleAction = async (actionType: TweetAction["type"]) => {
    if (selectedAccounts.length === 0) {
      addToast({
        title: "Error",
        description: "Selecciona al menos una cuenta",
        color: "danger",
      });
      return;
    }

    setLoading(true);
    setActionResults([]);

    try {
      await executeAction(actionType);
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (actionType: TweetAction["type"]) => {
    if (!isActionValid()) return;

    setLoading(true);
    setActionResults([]);

    try {
      const accountIds = selectedAccounts;

      // Preparar datos de la acción
      const actionData: any = {
        action: actionType,
        accountIds,
        baseDelay:
          delayMode === "minutes" ? baseDelay * 60000 : baseDelay * 1000,
        randomDelay:
          delayMode === "minutes" ? randomDelay * 60000 : randomDelay * 1000,
      };

      // Añadir datos específicos según el tipo de acción
      if (actionType === "tweet") {
        actionData.text = tweetText;
      } else if (actionType === "reply") {
        actionData.text = replyText;
        if (replyTweetUrl) {
          const tweetId = extractTweetId(replyTweetUrl);
          if (!tweetId) {
            throw new Error("URL de tweet inválida para respuesta");
          }
          actionData.tweetId = tweetId;
        }
      } else if (actionType === "like") {
        if (!likeTweetUrl) {
          throw new Error("URL de tweet requerida");
        }
        const tweetId = extractTweetId(likeTweetUrl);
        if (!tweetId) {
          throw new Error("URL de tweet inválida");
        }
        actionData.tweetId = tweetId;
      } else if (actionType === "retweet") {
        if (!retweetUrl) {
          throw new Error("URL de tweet requerida");
        }
        const tweetId = extractTweetId(retweetUrl);
        if (!tweetId) {
          throw new Error("URL de tweet inválida");
        }
        actionData.tweetId = tweetId;
      } else if (actionType === "follow") {
        const userId = extractAndValidateUserId(followUser);
        if (!userId) {
          throw new Error("Usuario objetivo inválido");
        }
        actionData.targetUserId = userId;
      } else if (actionType === "unfollow") {
        const userId = extractAndValidateUserId(unfollowUser);
        if (!userId) {
          throw new Error("Usuario objetivo inválido");
        }
        actionData.targetUserId = userId;
      }

      // Enviar a la cola
      const response = await retryWithBackoff(async () => {
        const res = await fetch("http://localhost:3001/api/queue/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(actionData),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(
            errorData.error || `Error ${res.status}: ${res.statusText}`
          );
        }

        return res.json();
      });

      // Mostrar resultado exitoso
      setActionResults([
        {
          account: "Sistema",
          success: true,
          message: response.message,
          details: `${response.actions.length} acciones añadidas a la cola`,
        },
      ]);

      // Limpiar formulario
      setTweetText("");
      setReplyText("");
      setReplyTweetUrl("");
      setLikeTweetUrl("");
      setRetweetUrl("");
      setFollowUser("");
      setUnfollowUser("");
    } catch (error: any) {
      console.error(`Error ejecutando ${actionType}:`, error);
      setActionResults([
        {
          account: "Sistema",
          success: false,
          message: "Error al añadir acciones a la cola",
          details: error.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getEstimatedTime = () => {
    const accountCount = selectedAccounts.length;

    if (accountCount <= 1) return "Inmediato";

    // Calcular delay promedio en segundos
    const baseSeconds = delayMode === "minutes" ? baseDelay * 60 : baseDelay;
    const randomSeconds = enableRandomDelay
      ? delayMode === "minutes"
        ? (randomDelay * 60) / 2
        : randomDelay / 2
      : 0;

    const avgDelaySeconds = baseSeconds + randomSeconds;
    const totalSeconds = (accountCount - 1) * avgDelaySeconds;

    if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = Math.round(totalSeconds % 60);

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m${
        remainingSeconds ? ` ${remainingSeconds}s` : ""
      }`;
    }

    return `${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ""}`;
  };

  const isActionValid = () => {
    switch (activeTab) {
      case "tweet":
        return tweetText.trim().length > 0;
      case "reply":
        return replyText.trim().length > 0 && replyTweetUrl.trim().length > 0;
      case "like":
        return likeTweetUrl.trim().length > 0;
      case "retweet":
        return retweetUrl.trim().length > 0;
      case "follow":
        return followUser.trim().length > 0;
      case "unfollow":
        return unfollowUser.trim().length > 0;
      case "batch":
        return (
          batchTweets.filter((t) => t.assignedAccounts.length > 0).length > 0
        );
      default:
        return false;
    }
  };

  // Funciones para manejar lotes
  const addBatchTweet = () => {
    if (!newTweetText.trim()) {
      addToast({
        title: "Error",
        description: "El texto del tweet/respuesta no puede estar vacío",
        color: "danger",
      });
      return;
    }

    if (newTweetType === "reply" && !newReplyToTweetUrl.trim()) {
      addToast({
        title: "Error",
        description: "La URL del tweet a responder es requerida",
        color: "danger",
      });
      return;
    }

    const newTweet: BatchTweet = {
      id: Date.now().toString(),
      text: newTweetText.trim(),
      type: newTweetType,
      replyToTweetUrl:
        newTweetType === "reply" ? newReplyToTweetUrl.trim() : undefined,
      assignedAccounts: [],
      status: "pending",
    };

    setBatchTweets([...batchTweets, newTweet]);
    setNewTweetText("");
    setNewReplyToTweetUrl("");
    onAddTweetOpenChange();

    addToast({
      title: newTweetType === "tweet" ? "Tweet Agregado" : "Respuesta Agregada",
      description: `${
        newTweetType === "tweet" ? "Tweet" : "Respuesta"
      } agregado al lote exitosamente`,
      color: "success",
    });
  };

  const removeBatchTweet = (tweetId: string) => {
    setBatchTweets(batchTweets.filter((tweet) => tweet.id !== tweetId));
    addToast({
      title: "Tweet Eliminado",
      description: "Tweet eliminado del lote",
      color: "success",
    });
  };

  const openAssignAccounts = (tweetId: string) => {
    setSelectedTweetForAssignment(tweetId);
    onAssignAccountsOpen();
  };

  const assignAccountsToTweet = (accountIds: string[]) => {
    if (!selectedTweetForAssignment) return;

    setBatchTweets(
      batchTweets.map((tweet) =>
        tweet.id === selectedTweetForAssignment
          ? { ...tweet, assignedAccounts: accountIds }
          : tweet
      )
    );

    setSelectedTweetForAssignment(null);
    onAssignAccountsOpenChange();

    addToast({
      title: "Cuentas Asignadas",
      description: `Cuentas asignadas al tweet exitosamente`,
      color: "success",
    });
  };

  // Función para ejecutar todos los tweets del lote
  const executeBatchTweets = async () => {
    setLoading(true);
    const tweetsToExecute = batchTweets.filter(
      (t) => t.assignedAccounts.length > 0
    );

    if (tweetsToExecute.length === 0) {
      alert("No hay tweets con cuentas asignadas para ejecutar");
      setLoading(false);
      return;
    }

    console.log(
      `🚀 Enviando ${tweetsToExecute.length} acciones al sistema de colas...`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const tweet of tweetsToExecute) {
      // Marcar como en progreso
      setBatchTweets((prev) =>
        prev.map((t) =>
          t.id === tweet.id ? { ...t, status: "pending" as const } : t
        )
      );

      for (const accountId of tweet.assignedAccounts) {
        try {
          const requestBody: any = {
            accountId,
            action: tweet.type, // "tweet" o "reply"
            text: tweet.text,
          };

          // Agregar tweetId si es una respuesta
          if (tweet.type === "reply" && tweet.replyToTweetUrl) {
            requestBody.tweetId = tweet.replyToTweetUrl;
          }

          // Enviar al sistema de colas del backend
          const response = await fetch("http://localhost:3001/api/tweets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
          }

          const result = await response.json();
          console.log(`✅ Acción ${tweet.type} añadida a la cola:`, result);
          successCount++;
        } catch (error: any) {
          console.error(
            `❌ Error enviando ${tweet.type} para @${getAccountName(
              accountId
            )}:`,
            error.message
          );
          errorCount++;

          // Marcar como error
          setBatchTweets((prev) =>
            prev.map((t) =>
              t.id === tweet.id ? { ...t, status: "error" as const } : t
            )
          );
        }
      }

      // Pequeño delay entre tweets para evitar saturar el sistema
      if (tweetsToExecute.indexOf(tweet) < tweetsToExecute.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Marcar tweets exitosos como completados
    setBatchTweets((prev) =>
      prev.map((t) =>
        tweetsToExecute.find((tt) => tt.id === t.id) && t.status !== "error"
          ? { ...t, status: "completed" as const }
          : t
      )
    );

    setLoading(false);

    console.log(
      `🎉 Proceso completado: ${successCount} éxitos, ${errorCount} errores`
    );
    alert(
      `Lote enviado al sistema de colas:\n✅ ${successCount} acciones añadidas\n❌ ${errorCount} errores\n\nPuedes ver el progreso en el Dashboard.`
    );
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc._id === accountId);
    return account ? account.username : accountId;
  };

  const getTotalAssignedAccounts = () => {
    return batchTweets.reduce(
      (total, tweet) => total + tweet.assignedAccounts.length,
      0
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center w-full">
            <div>
              <h1 className="text-2xl font-bold">
                🐦 Panel de Acciones de Twitter
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Gestiona todas las acciones de Twitter desde un solo lugar
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="ghost" color="primary">
                📊 Ver Dashboard
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs de acciones */}
      <Card>
        <CardBody>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            variant="bordered"
            color="primary"
            size="lg"
          >
            <Tab key="tweet" title="📝 Tweet">
              <div className="space-y-4 mt-4">
                <Textarea
                  label="Texto del tweet"
                  placeholder="¿Qué está pasando?"
                  value={tweetText}
                  onValueChange={setTweetText}
                  maxRows={4}
                  description="Publica un nuevo tweet en las cuentas seleccionadas"
                />
              </div>
            </Tab>

            <Tab key="reply" title="💬 Responder">
              <div className="space-y-4 mt-4">
                <Input
                  label="URL del tweet a responder"
                  placeholder="https://x.com/usuario/status/123456789"
                  value={replyTweetUrl}
                  onValueChange={setReplyTweetUrl}
                  description="URL del tweet al que quieres responder"
                />
                <Textarea
                  label="Texto de la respuesta"
                  placeholder="Escribe tu respuesta aquí..."
                  value={replyText}
                  onValueChange={setReplyText}
                  maxRows={4}
                  description="El texto de respuesta que se enviará"
                />
              </div>
            </Tab>

            <Tab key="like" title="❤️ Me Gusta">
              <div className="space-y-4 mt-4">
                <Input
                  label="URL del tweet"
                  placeholder="https://x.com/usuario/status/123456789"
                  value={likeTweetUrl}
                  onValueChange={setLikeTweetUrl}
                  description="URL del tweet al que quieres dar me gusta"
                />
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 Las cuentas seleccionadas darán "me gusta" al tweet
                    especificado
                  </p>
                </div>
              </div>
            </Tab>

            <Tab key="retweet" title="🔄 Retweet">
              <div className="space-y-4 mt-4">
                <Input
                  label="URL del tweet"
                  placeholder="https://x.com/usuario/status/123456789"
                  value={retweetUrl}
                  onValueChange={setRetweetUrl}
                  description="URL del tweet que quieres retweetear"
                />
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    💡 Las cuentas seleccionadas harán retweet del tweet
                    especificado
                  </p>
                </div>
              </div>
            </Tab>

            <Tab key="follow" title="👤+ Seguir">
              <div className="space-y-4 mt-4">
                <Input
                  label="Usuario a seguir"
                  placeholder="@username o URL del perfil"
                  value={followUser}
                  onValueChange={setFollowUser}
                  description="Usuario que las cuentas seleccionadas seguirán"
                />
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    💡 Puedes usar: @username, username, o URL completa del
                    perfil
                  </p>
                </div>
              </div>
            </Tab>

            <Tab key="unfollow" title="👤- Dejar de Seguir">
              <div className="space-y-4 mt-4">
                <Input
                  label="Usuario a dejar de seguir"
                  placeholder="@username o URL del perfil"
                  value={unfollowUser}
                  onValueChange={setUnfollowUser}
                  description="Usuario que las cuentas seleccionadas dejarán de seguir"
                />
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    💡 Puedes usar: @username, username, o URL completa del
                    perfil
                  </p>
                </div>
              </div>
            </Tab>

            <Tab key="batch" title="📦 Lotes">
              <div className="space-y-6 mt-4">
                {/* Header del tab de lotes */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Gestión de Lotes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Asigna tweets específicos a cuentas específicas
                    </p>
                  </div>
                  <Button
                    color="primary"
                    onPress={onAddTweetOpen}
                    startContent={
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    }
                  >
                    Añadir Tweet
                  </Button>
                </div>

                {/* Estadísticas del lote */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <h4 className="text-2xl font-bold text-blue-600">
                        {batchTweets.filter((t) => t.type === "tweet").length}
                      </h4>
                      <p className="text-sm text-gray-600">Tweets</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <h4 className="text-2xl font-bold text-purple-600">
                        {batchTweets.filter((t) => t.type === "reply").length}
                      </h4>
                      <p className="text-sm text-gray-600">Respuestas</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <h4 className="text-2xl font-bold text-green-600">
                        {getTotalAssignedAccounts()}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Asignaciones Total
                      </p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <h4 className="text-2xl font-bold text-orange-600">
                        {
                          batchTweets.filter(
                            (t) => t.assignedAccounts.length > 0
                          ).length
                        }
                      </h4>
                      <p className="text-sm text-gray-600">Acciones Listas</p>
                    </CardBody>
                  </Card>
                </div>

                {/* Tabla de tweets */}
                {batchTweets.length > 0 ? (
                  <Table aria-label="Tabla de tweets en lote">
                    <TableHeader>
                      <TableColumn>TIPO</TableColumn>
                      <TableColumn>CONTENIDO</TableColumn>
                      <TableColumn>CUENTAS ASIGNADAS</TableColumn>
                      <TableColumn>ESTADO</TableColumn>
                      <TableColumn>ACCIONES</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {batchTweets.map((tweet) => (
                        <TableRow key={tweet.id}>
                          <TableCell>
                            <Chip
                              size="sm"
                              color={
                                tweet.type === "tweet" ? "primary" : "secondary"
                              }
                              variant="flat"
                              startContent={
                                tweet.type === "tweet" ? "📝" : "💬"
                              }
                            >
                              {tweet.type === "tweet" ? "Tweet" : "Respuesta"}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs space-y-1">
                              <p className="text-sm truncate">{tweet.text}</p>
                              {tweet.type === "reply" &&
                                tweet.replyToTweetUrl && (
                                  <p className="text-xs text-gray-500 truncate">
                                    ↳ Responde a: {tweet.replyToTweetUrl}
                                  </p>
                                )}
                              <Tooltip
                                content={
                                  <div className="max-w-sm">
                                    <p className="font-semibold mb-2">
                                      {tweet.type === "tweet"
                                        ? "Tweet:"
                                        : "Respuesta:"}
                                    </p>
                                    <p className="mb-2">{tweet.text}</p>
                                    {tweet.type === "reply" &&
                                      tweet.replyToTweetUrl && (
                                        <p className="text-xs text-gray-400">
                                          Responde a: {tweet.replyToTweetUrl}
                                        </p>
                                      )}
                                  </div>
                                }
                              >
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="p-0 h-auto text-xs text-blue-600"
                                >
                                  Ver completo
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tweet.assignedAccounts.length > 0 ? (
                                tweet.assignedAccounts
                                  .slice(0, 3)
                                  .map((accountId) => (
                                    <Chip
                                      key={accountId}
                                      size="sm"
                                      variant="flat"
                                      color="primary"
                                    >
                                      @{getAccountName(accountId)}
                                    </Chip>
                                  ))
                              ) : (
                                <Chip size="sm" variant="flat" color="warning">
                                  Sin asignar
                                </Chip>
                              )}
                              {tweet.assignedAccounts.length > 3 && (
                                <Chip size="sm" variant="flat" color="default">
                                  +{tweet.assignedAccounts.length - 3}
                                </Chip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="sm"
                              color={
                                tweet.status === "completed"
                                  ? "success"
                                  : tweet.status === "error"
                                  ? "danger"
                                  : "default"
                              }
                              variant="flat"
                            >
                              {tweet.status === "pending" && "Pendiente"}
                              {tweet.status === "completed" && "Completado"}
                              {tweet.status === "error" && "Error"}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => openAssignAccounts(tweet.id)}
                                disabled={loading}
                              >
                                Asignar
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="danger"
                                onPress={() => removeBatchTweet(tweet.id)}
                                disabled={loading}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Card>
                    <CardBody className="text-center py-12">
                      <div className="text-6xl mb-4">📦</div>
                      <h4 className="text-lg font-semibold mb-2">
                        No hay tweets en el lote
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Comienza añadiendo tweets para crear tu lote
                        personalizado
                      </p>
                      <Button color="primary" onPress={onAddTweetOpen}>
                        Añadir Primer Tweet
                      </Button>
                    </CardBody>
                  </Card>
                )}

                {/* Botón de ejecución de lote */}
                {batchTweets.length > 0 && (
                  <div className="text-center">
                    <Button
                      color="success"
                      size="lg"
                      onPress={executeBatchTweets}
                      isLoading={loading}
                      disabled={
                        batchTweets.filter((t) => t.assignedAccounts.length > 0)
                          .length === 0
                      }
                      className="px-8"
                    >
                      {loading
                        ? "Ejecutando Lote..."
                        : "🚀 Ejecutar Lote Completo"}
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      Se ejecutarán {getTotalAssignedAccounts()} tweets en total
                    </p>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Mostrar configuración de delays solo si no estamos en el tab de lotes */}
      {activeTab !== "batch" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">⏱️ Control de Timing</h3>
              <Switch
                isSelected={delayMode === "minutes"}
                onValueChange={(checked) =>
                  setDelayMode(checked ? "minutes" : "seconds")
                }
                color="primary"
                size="sm"
              >
                Modo: {delayMode === "minutes" ? "Minutos" : "Segundos"}
              </Switch>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">
                  Delay base entre acciones
                </span>
                <span className="text-sm text-gray-600">
                  {baseDelay}
                  {delayMode === "minutes" ? "m" : "s"}
                </span>
              </div>
              <Slider
                value={baseDelay}
                onChange={(value) =>
                  setBaseDelay(Array.isArray(value) ? value[0] : value)
                }
                minValue={delayMode === "minutes" ? 1 : 5}
                maxValue={delayMode === "minutes" ? 10 : 300}
                step={delayMode === "minutes" ? 0.5 : 5}
                color="primary"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{delayMode === "minutes" ? "1m" : "5s"}</span>
                <span>{delayMode === "minutes" ? "10m" : "300s"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Switch
                isSelected={enableRandomDelay}
                onValueChange={setEnableRandomDelay}
                color="secondary"
              >
                Añadir delay aleatorio
              </Switch>
            </div>

            {enableRandomDelay && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">
                    Delay aleatorio adicional (0 a {randomDelay}
                    {delayMode === "minutes" ? "m" : "s"})
                  </span>
                  <span className="text-sm text-gray-600">
                    ±{randomDelay}
                    {delayMode === "minutes" ? "m" : "s"}
                  </span>
                </div>
                <Slider
                  value={randomDelay}
                  onChange={(value) =>
                    setRandomDelay(Array.isArray(value) ? value[0] : value)
                  }
                  minValue={0}
                  maxValue={delayMode === "minutes" ? 5 : 180}
                  step={delayMode === "minutes" ? 0.25 : 5}
                  color="secondary"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>{delayMode === "minutes" ? "5m" : "180s"}</span>
                </div>
              </div>
            )}

            {/* Presets rápidos */}
            <div>
              <p className="text-sm font-medium mb-3">
                🚀 Configuraciones Predefinidas:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={() => {
                    setDelayMode("seconds");
                    setBaseDelay(10);
                    setRandomDelay(20);
                    setEnableRandomDelay(true);
                  }}
                >
                  Rápido
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  onPress={() => {
                    setDelayMode("seconds");
                    setBaseDelay(60);
                    setRandomDelay(60);
                    setEnableRandomDelay(true);
                  }}
                >
                  Medio
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="success"
                  onPress={() => {
                    setDelayMode("minutes");
                    setBaseDelay(2);
                    setRandomDelay(3);
                    setEnableRandomDelay(true);
                  }}
                >
                  Seguro
                </Button>
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">
                Rápido: 10-30s | Medio: 60-120s | Seguro: 2-5min
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600">⏰</span>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  Tiempo estimado total: <strong>{getEstimatedTime()}</strong>
                </p>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300">
                💡 Delays más largos = menor riesgo de rate limits
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Mostrar selección de cuentas solo si no estamos en el tab de lotes */}
      {activeTab !== "batch" && (
        <AccountSelector
          accounts={accounts}
          selectedAccounts={selectedAccounts}
          onSelectionChange={setSelectedAccounts}
          title="👥 Seleccionar Cuentas para Acciones"
          groupByLabels={true}
          showStats={false}
        />
      )}

      {/* Mostrar botón de acción solo si no estamos en el tab de lotes */}
      {activeTab !== "batch" && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-4">
              <Button
                color="primary"
                size="lg"
                onClick={() => handleAction(activeTab as TweetAction["type"])}
                isLoading={loading}
                disabled={selectedAccounts.length === 0 || !isActionValid()}
                className="px-8"
              >
                {loading
                  ? "Ejecutando..."
                  : `🚀 Ejecutar ${
                      activeTab === "tweet"
                        ? "Tweet"
                        : activeTab === "reply"
                        ? "Respuesta"
                        : activeTab === "like"
                        ? "Me Gusta"
                        : activeTab === "retweet"
                        ? "Retweet"
                        : activeTab === "follow"
                        ? "Seguir"
                        : "Dejar de Seguir"
                    }`}
              </Button>

              {(!isActionValid() || selectedAccounts.length === 0) && (
                <p className="text-sm text-gray-500 text-center">
                  {selectedAccounts.length === 0
                    ? "Selecciona al menos una cuenta"
                    : "Completa todos los campos requeridos"}
                </p>
              )}

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  💡 Los delays inteligentes evitan límites de rate limit
                </p>
                <Button
                  color="default"
                  variant="flat"
                  size="sm"
                  onClick={() => {
                    setTweetText("");
                    setReplyText("");
                    setReplyTweetUrl("");
                    setLikeTweetUrl("");
                    setRetweetUrl("");
                    setFollowUser("");
                    setUnfollowUser("");
                    setActionResults([]);
                  }}
                  disabled={loading}
                >
                  🗑️ Limpiar Todo
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Progreso */}
      {loading && (
        <Card>
          <CardBody>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  ⚡ Procesando acciones...
                </span>
                <span className="text-sm text-gray-600">
                  {progress.current} de {progress.total}
                </span>
              </div>
              <Progress
                value={(progress.current / progress.total) * 100}
                color="primary"
                className="w-full"
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Resultados */}
      {actionResults.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">📊 Resultados</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {actionResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    result.success
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {result.success ? "✅" : "❌"} {result.account}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {result.message}
                      </p>
                      {result.details && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {result.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Modal para añadir tweet */}
      <Modal
        isOpen={isAddTweetOpen}
        onOpenChange={onAddTweetOpenChange}
        size="2xl"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">
                  Añadir Nueva Acción al Lote
                </h3>
                <p className="text-sm text-gray-600">
                  Elige el tipo de acción y escribe el contenido
                </p>
              </ModalHeader>
              <ModalBody>
                <Tabs
                  selectedKey={newTweetType}
                  onSelectionChange={(key) =>
                    setNewTweetType(key as "tweet" | "reply")
                  }
                  variant="bordered"
                  color="primary"
                >
                  <Tab key="tweet" title="📝 Tweet">
                    <div className="space-y-4 mt-4">
                      <Textarea
                        label="Texto del tweet"
                        placeholder="¿Qué quieres que tweeteen las cuentas?"
                        value={newTweetText}
                        onValueChange={setNewTweetText}
                        maxRows={6}
                        maxLength={280}
                        description={`${newTweetText.length}/280 caracteres`}
                      />
                    </div>
                  </Tab>
                  <Tab key="reply" title="💬 Respuesta">
                    <div className="space-y-4 mt-4">
                      <Input
                        label="URL del tweet a responder"
                        placeholder="https://x.com/usuario/status/123456789"
                        value={newReplyToTweetUrl}
                        onValueChange={setNewReplyToTweetUrl}
                        description="URL del tweet al que quieres responder"
                      />
                      <Textarea
                        label="Texto de la respuesta"
                        placeholder="Escribe la respuesta que quieres que envíen las cuentas..."
                        value={newTweetText}
                        onValueChange={setNewTweetText}
                        maxRows={6}
                        maxLength={280}
                        description={`${newTweetText.length}/280 caracteres`}
                      />
                    </div>
                  </Tab>
                </Tabs>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={addBatchTweet}
                  disabled={
                    !newTweetText.trim() ||
                    (newTweetType === "reply" && !newReplyToTweetUrl.trim())
                  }
                >
                  Añadir {newTweetType === "tweet" ? "Tweet" : "Respuesta"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal para asignar cuentas */}
      <Modal
        isOpen={isAssignAccountsOpen}
        onOpenChange={onAssignAccountsOpenChange}
        size="3xl"
      >
        <ModalContent>
          {(onClose) => {
            const currentTweet = batchTweets.find(
              (t) => t.id === selectedTweetForAssignment
            );
            const [tempSelectedAccounts, setTempSelectedAccounts] = useState<
              string[]
            >(currentTweet?.assignedAccounts || []);

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">
                    Asignar Cuentas al Tweet
                  </h3>
                  {currentTweet && (
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm">{currentTweet.text}</p>
                    </div>
                  )}
                </ModalHeader>
                <ModalBody>
                  <AccountSelector
                    accounts={accounts}
                    selectedAccounts={tempSelectedAccounts}
                    onSelectionChange={setTempSelectedAccounts}
                    title="Seleccionar Cuentas para este Tweet"
                    groupByLabels={true}
                    showStats={false}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    color="primary"
                    onPress={() => {
                      assignAccountsToTweet(tempSelectedAccounts);
                      onClose();
                    }}
                  >
                    Asignar Cuentas ({tempSelectedAccounts.length})
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
