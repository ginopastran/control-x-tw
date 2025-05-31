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
} from "@heroui/react";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface TweetAction {
  type: "tweet" | "reply" | "like" | "retweet";
  text?: string;
  tweetId?: string;
}

interface DistributedMessage {
  text: string;
  accountId: string;
  type: "tweet" | "reply";
  tweetId?: string;
  delay: number;
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
      if (error.message?.includes("Too Many Requests")) {
        retries++;
        if (retries === maxRetries) throw error;
        const waitTime = baseDelay * Math.pow(2, retries);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
};

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [tweetText, setTweetText] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionResults, setActionResults] = useState<{ [key: string]: string }>(
    {}
  );
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Estados para distribución de mensajes
  const [isDistributionEnabled, setIsDistributionEnabled] = useState(false);
  const [distributionMessages, setDistributionMessages] = useState("");
  const [distributedMessages, setDistributedMessages] = useState<
    DistributedMessage[]
  >([]);

  // Estados para control de tiempo
  const [baseDelay, setBaseDelay] = useState(0);
  const [incrementalDelay, setIncrementalDelay] = useState(0);

  // Estados para modales
  const {
    isOpen: isPreviewOpen,
    onOpen: onPreviewOpen,
    onOpenChange: onPreviewOpenChange,
  } = useDisclosure();

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    // Extraer todas las etiquetas únicas de las cuentas
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
      return statusIndex !== -1 ? pathParts[statusIndex + 1] : null;
    } catch {
      return null;
    }
  };

  const distributeMessages = () => {
    if (!isDistributionEnabled) return;

    const messageList = distributionMessages
      .split("\n")
      .filter((msg) => msg.trim() !== "")
      .map((msg) => msg.trim());

    if (messageList.length === 0) {
      addToast({
        title: "Error",
        description: "Por favor, ingresa al menos un mensaje",
        color: "danger",
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      addToast({
        title: "Error",
        description: "Por favor, selecciona al menos una cuenta",
        color: "danger",
      });
      return;
    }

    // Verificar si hay diferencia entre mensajes y cuentas
    const difference = selectedAccounts.length - messageList.length;
    if (difference > 0) {
      addToast({
        title: "Advertencia",
        description: `Faltan ${difference} mensajes para completar todas las cuentas. Los mensajes se repetirán.`,
        color: "warning",
      });
    } else if (difference < 0) {
      addToast({
        title: "Advertencia",
        description: `Sobran ${Math.abs(
          difference
        )} mensajes. Algunas cuentas no recibirán mensajes.`,
        color: "warning",
      });
    }

    const distributed: DistributedMessage[] = [];
    let messageIndex = 0;
    const tweetId = tweetUrl
      ? extractTweetId(tweetUrl) || undefined
      : undefined;

    selectedAccounts.forEach((accountId, index) => {
      const message = messageList[messageIndex];
      distributed.push({
        text: message,
        accountId: accountId,
        type: tweetUrl ? "reply" : "tweet",
        tweetId,
        delay: baseDelay + incrementalDelay * index,
      });
      messageIndex = (messageIndex + 1) % messageList.length;
    });

    setDistributedMessages(distributed);
    onPreviewOpen();
  };

  const handleAction = async (actionType: TweetAction["type"]) => {
    if (selectedAccounts.length === 0) {
      addToast({
        title: "Error",
        description: "Por favor selecciona al menos una cuenta",
        color: "danger",
      });
      return;
    }

    setLoading(true);
    setActionResults({});

    // Si está habilitada la distribución, usar los mensajes distribuidos
    if (isDistributionEnabled && distributedMessages.length > 0) {
      setProgress({ current: 0, total: distributedMessages.length });
      await executeDistributedMessages();
    } else {
      setProgress({ current: 0, total: selectedAccounts.length });
      await executeStandardAction(actionType);
    }
  };

  const executeDistributedMessages = async () => {
    const newActionResults: { [key: string]: string } = {};
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < distributedMessages.length; i++) {
      const message = distributedMessages[i];
      const account = accounts.find((a) => a._id === message.accountId);
      const username = account ? account.username : message.accountId;

      try {
        // Aplicar delay si es necesario
        if (message.delay > 0) {
          await delay(message.delay * 1000);
        }

        await retryWithBackoff(async () => {
          const response = await fetch("/api/tweets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountId: message.accountId,
              action: message.type,
              text: message.text,
              tweetId: message.tweetId,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Error desconocido");
          }

          return data;
        });

        successCount++;
        newActionResults[
          message.accountId
        ] = `✅ @${username}: Éxito - "${message.text.substring(0, 50)}${
          message.text.length > 50 ? "..." : ""
        }"`;
      } catch (error: any) {
        failureCount++;
        newActionResults[
          message.accountId
        ] = `❌ @${username}: ${error.message}`;
      }

      setProgress({ current: i + 1, total: distributedMessages.length });
      setActionResults({ ...newActionResults });

      // Esperar entre solicitudes
      if (i < distributedMessages.length - 1) {
        await delay(2000);
      }
    }

    showFinalResult(successCount, failureCount);
  };

  const executeStandardAction = async (actionType: TweetAction["type"]) => {
    try {
      const tweetId = tweetUrl ? extractTweetId(tweetUrl) : null;

      if (
        (actionType === "reply" ||
          actionType === "like" ||
          actionType === "retweet") &&
        !tweetId
      ) {
        throw new Error("URL de tweet inválida");
      }

      if (
        (actionType === "tweet" || actionType === "reply") &&
        !tweetText.trim()
      ) {
        throw new Error("El texto del tweet no puede estar vacío");
      }

      const newActionResults: { [key: string]: string } = {};
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < selectedAccounts.length; i++) {
        const accountId = selectedAccounts[i];
        const account = accounts.find((a) => a._id === accountId);
        const username = account ? account.username : accountId;

        try {
          // Aplicar delay si es necesario
          const currentDelay = baseDelay + incrementalDelay * i;
          if (currentDelay > 0) {
            await delay(currentDelay * 1000);
          }

          await retryWithBackoff(async () => {
            const response = await fetch("/api/tweets", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                accountId,
                action: actionType,
                text: tweetText,
                tweetId,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || "Error desconocido");
            }

            return data;
          });

          successCount++;
          newActionResults[accountId] = `✅ @${username}: Éxito`;
        } catch (error: any) {
          failureCount++;
          newActionResults[accountId] = `❌ @${username}: ${error.message}`;
        }

        setProgress({ current: i + 1, total: selectedAccounts.length });
        setActionResults({ ...newActionResults });

        if (i < selectedAccounts.length - 1) {
          await delay(2000);
        }
      }

      showFinalResult(successCount, failureCount);
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

  const showFinalResult = (successCount: number, failureCount: number) => {
    if (failureCount === 0) {
      addToast({
        title: "Éxito",
        description: `¡Acción realizada con éxito en ${successCount} ${
          successCount === 1 ? "cuenta" : "cuentas"
        }!`,
        color: "success",
      });
    } else if (successCount === 0) {
      addToast({
        title: "Error",
        description: `No se pudo realizar la acción en ninguna cuenta`,
        color: "danger",
      });
    } else {
      addToast({
        title: "Parcialmente completado",
        description: `Éxito en ${successCount} cuentas, error en ${failureCount}`,
        color: "warning",
      });
    }

    setLoading(false);
  };

  const handleAccountSelection = (accountId: string) => {
    setSelectedAccounts((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((account) => account._id));
    }
  };

  const handleLabelSelection = (label: string) => {
    setSelectedLabels((prev) => {
      if (prev.includes(label)) {
        const newLabels = prev.filter((l) => l !== label);
        if (newLabels.length === 0) {
          setSelectedAccounts([]);
        } else {
          const filteredAccounts = accounts.filter((account) =>
            newLabels.some((l) => account.labels?.includes(l))
          );
          setSelectedAccounts(filteredAccounts.map((account) => account._id));
        }
        return newLabels;
      } else {
        const newLabels = [...prev, label];
        const filteredAccounts = accounts.filter((account) =>
          newLabels.some((l) => account.labels?.includes(l))
        );
        setSelectedAccounts(filteredAccounts.map((account) => account._id));
        return newLabels;
      }
    });
  };

  const getAccountUsername = (accountId: string) => {
    const account = accounts.find((a) => a._id === accountId);
    return account ? account.username : accountId;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ""}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center w-full">
            <div>
              <h1 className="text-2xl font-bold">Panel de Tweets</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Gestiona tus publicaciones de Twitter con funciones avanzadas
              </p>
            </div>
            <Link href="/test-tweets">
              <Button variant="ghost" color="primary">
                Ver Test Tweets
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Switch de distribución de mensajes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Switch
              isSelected={isDistributionEnabled}
              onValueChange={setIsDistributionEnabled}
              color="primary"
            />
            <div>
              <h3 className="text-lg font-semibold">
                Distribución de Mensajes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Distribuye diferentes mensajes entre las cuentas seleccionadas
              </p>
            </div>
          </div>
        </CardHeader>
        {isDistributionEnabled && (
          <CardBody className="pt-0">
            <Textarea
              label="Mensajes (uno por línea)"
              placeholder="Escribe cada mensaje en una línea diferente..."
              value={distributionMessages}
              onValueChange={setDistributionMessages}
              minRows={4}
              className="mb-4"
            />
            <div className="flex gap-4">
              <Button
                onClick={distributeMessages}
                color="primary"
                variant="flat"
                disabled={
                  !distributionMessages.trim() || selectedAccounts.length === 0
                }
              >
                Vista Previa de Distribución
              </Button>
              {distributedMessages.length > 0 && (
                <Chip color="success" variant="flat">
                  {distributedMessages.length} mensajes distribuidos
                </Chip>
              )}
            </div>
          </CardBody>
        )}
      </Card>

      {/* Control de tiempo */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Control de Tiempo</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Retraso inicial (segundos)"
              placeholder="0"
              value={baseDelay.toString()}
              onValueChange={(value) =>
                setBaseDelay(Math.max(0, parseInt(value) || 0))
              }
              endContent={
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onClick={() => setBaseDelay((prev) => prev + 10)}
                  >
                    +10
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onClick={() => setBaseDelay((prev) => prev + 30)}
                  >
                    +30
                  </Button>
                </div>
              }
            />
            <Input
              type="number"
              label="Intervalo entre acciones (segundos)"
              placeholder="0"
              value={incrementalDelay.toString()}
              onValueChange={(value) =>
                setIncrementalDelay(Math.max(0, parseInt(value) || 0))
              }
              endContent={
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onClick={() => setIncrementalDelay((prev) => prev + 5)}
                  >
                    +5
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onClick={() => setIncrementalDelay((prev) => prev + 15)}
                  >
                    +15
                  </Button>
                </div>
              }
            />
          </div>
          {(baseDelay > 0 || incrementalDelay > 0) && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📅 Tiempo estimado total:{" "}
                {formatTime(
                  baseDelay +
                    incrementalDelay * Math.max(0, selectedAccounts.length - 1)
                )}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Selección de cuentas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="text-lg font-semibold">Seleccionar Cuentas</h3>
          <Button variant="flat" size="sm" onClick={toggleAllAccounts}>
            {selectedAccounts.length === accounts.length
              ? "Deseleccionar todo"
              : "Seleccionar todo"}
          </Button>
        </CardHeader>
        <CardBody>
          {/* Filtro por etiquetas */}
          {availableLabels.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Filtrar por etiquetas:</p>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map((label) => (
                  <Chip
                    key={label}
                    variant={selectedLabels.includes(label) ? "solid" : "flat"}
                    color={
                      selectedLabels.includes(label) ? "primary" : "default"
                    }
                    className="cursor-pointer"
                    onClick={() => handleLabelSelection(label)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Lista de cuentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {accounts.map((account) => (
              <div
                key={account._id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedAccounts.includes(account._id)
                    ? "border-primary bg-primary-50 dark:bg-primary-950"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
                onClick={() => handleAccountSelection(account._id)}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    isSelected={selectedAccounts.includes(account._id)}
                    onChange={() => handleAccountSelection(account._id)}
                    color="primary"
                  />
                  <span className="font-medium">@{account.username}</span>
                </div>
                {account.labels && account.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {account.labels.map((label) => (
                      <Chip
                        key={label}
                        size="sm"
                        variant="flat"
                        color="secondary"
                      >
                        {label}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 text-sm text-gray-600">
            {selectedAccounts.length} de {accounts.length} cuentas seleccionadas
          </div>
        </CardBody>
      </Card>

      {/* Contenido del tweet/acción */}
      {!isDistributionEnabled && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Contenido</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Textarea
              label="Texto del tweet"
              placeholder="¿Qué está pasando?"
              value={tweetText}
              onValueChange={setTweetText}
              maxRows={4}
            />
            <Input
              label="URL del tweet (para respuestas, likes o retweets)"
              placeholder="https://twitter.com/usuario/status/123456789"
              value={tweetUrl}
              onValueChange={setTweetUrl}
            />
          </CardBody>
        </Card>
      )}

      {/* Acciones */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Acciones</h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              color="primary"
              variant="solid"
              onClick={() => handleAction("tweet")}
              isLoading={loading}
              disabled={selectedAccounts.length === 0}
            >
              Publicar Tweet
            </Button>
            <Button
              color="secondary"
              variant="solid"
              onClick={() => handleAction("reply")}
              isLoading={loading}
              disabled={
                selectedAccounts.length === 0 ||
                (!isDistributionEnabled && !tweetUrl)
              }
            >
              Responder
            </Button>
            <Button
              color="success"
              variant="flat"
              onClick={() => handleAction("like")}
              isLoading={loading}
              disabled={
                selectedAccounts.length === 0 ||
                (!isDistributionEnabled && !tweetUrl)
              }
            >
              Me gusta
            </Button>
            <Button
              color="warning"
              variant="flat"
              onClick={() => handleAction("retweet")}
              isLoading={loading}
              disabled={
                selectedAccounts.length === 0 ||
                (!isDistributionEnabled && !tweetUrl)
              }
            >
              Retweet
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Progreso */}
      {loading && (
        <Card>
          <CardBody>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Procesando...</span>
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
      {Object.keys(actionResults).length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Resultados</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(actionResults).map(([accountId, result]) => (
                <div
                  key={accountId}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <p className="text-sm">{result}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Modal de vista previa de distribución */}
      <Modal
        isOpen={isPreviewOpen}
        onOpenChange={onPreviewOpenChange}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <h3 className="text-xl font-semibold">
                  Vista Previa de Distribución
                </h3>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {distributedMessages.map((message, index) => (
                    <Card
                      key={index}
                      className="border border-gray-200 dark:border-gray-700"
                    >
                      <CardBody className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Chip color="primary" size="sm" variant="flat">
                              @{getAccountUsername(message.accountId)}
                            </Chip>
                            <Chip color="secondary" size="sm" variant="flat">
                              {message.type === "tweet" ? "Tweet" : "Respuesta"}
                            </Chip>
                            {message.delay > 0 && (
                              <Chip color="warning" size="sm" variant="flat">
                                Delay: {formatTime(message.delay)}
                              </Chip>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {message.text}
                        </p>
                        {message.tweetId && (
                          <p className="text-xs text-gray-500 mt-2">
                            Respondiendo al tweet: {message.tweetId}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cerrar
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    onClose();
                    handleAction(distributedMessages[0]?.type || "tweet");
                  }}
                  disabled={distributedMessages.length === 0}
                >
                  Ejecutar Distribución
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
