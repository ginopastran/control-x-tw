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
    setProgress({ current: 0, total: selectedAccounts.length });

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

      // Procesar cuentas secuencialmente con retraso
      const newActionResults: { [key: string]: string } = {};
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < selectedAccounts.length; i++) {
        const accountId = selectedAccounts[i];
        const account = accounts.find((a) => a._id === accountId);
        const username = account ? account.username : accountId;

        try {
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

        // Esperar un tiempo entre solicitudes para evitar límites de tasa
        if (i < selectedAccounts.length - 1) {
          await delay(2000);
        }
      }

      if (failureCount === 0) {
        addToast({
          title: "Éxito",
          description: `¡${actionType} realizado con éxito en ${successCount} ${
            successCount === 1 ? "cuenta" : "cuentas"
          }!`,
          color: "success",
        });
      } else if (successCount === 0) {
        addToast({
          title: "Error",
          description: `No se pudo realizar la acción en ninguna cuenta. Revisa los detalles abajo.`,
          color: "danger",
        });
      } else {
        addToast({
          title: "Parcialmente completado",
          description: `Acción parcialmente completada: ${successCount} exitosas, ${failureCount} fallidas. Revisa los detalles abajo.`,
          color: "warning",
        });
      }

      if (actionType === "tweet" || actionType === "reply") {
        setTweetText("");
      }
      setTweetUrl("");
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.message || "Error al realizar la acción",
        color: "danger",
      });
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
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
    // Si la etiqueta ya está seleccionada, la deseleccionamos y limpiamos la selección de cuentas
    if (selectedLabels.includes(label)) {
      setSelectedLabels([]);
      setSelectedAccounts([]);
      return;
    }

    // Si es una nueva etiqueta, la seleccionamos (reemplazando cualquier selección anterior)
    setSelectedLabels([label]);

    // Filtramos las cuentas que tienen esta etiqueta
    const filteredAccounts = accounts.filter((account) =>
      account.labels?.includes(label)
    );
    setSelectedAccounts(filteredAccounts.map((account) => account._id));
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Gestión de tweets</h1>

      {/* Selector de etiquetas */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex justify-between items-center mb-2">
            <p className="text-md font-medium">Filtrar por Etiquetas</p>
            {selectedLabels.length > 0 && (
              <Button
                onClick={() => {
                  setSelectedLabels([]);
                  setSelectedAccounts([]);
                }}
                size="sm"
                variant="light"
                color="primary"
              >
                Limpiar filtro
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {availableLabels.map((label) => (
              <Chip
                key={label}
                onClick={() => handleLabelSelection(label)}
                color={selectedLabels.includes(label) ? "primary" : "default"}
                variant={selectedLabels.includes(label) ? "solid" : "bordered"}
              >
                {label}
                {selectedLabels.includes(label) && (
                  <span className="ml-2 text-xs">✕</span>
                )}
              </Chip>
            ))}
            {availableLabels.length === 0 && (
              <p className="text-sm text-gray-500">
                No hay etiquetas disponibles
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Selector de cuentas */}
      <Card className="mb-6">
        <CardHeader className="flex justify-between items-center px-6">
          <p className="text-md font-medium">Seleccionar Cuentas</p>
          <div className="flex gap-2 items-center">
            <Button as={Link} href="/accounts" color="success" size="sm">
              Agregar Cuenta
            </Button>
            <Button onClick={toggleAllAccounts} size="sm" variant="flat">
              {selectedAccounts.length === accounts.length
                ? "Deseleccionar todo"
                : "Seleccionar todo"}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-2 max-h-40 overflow-y-auto p-2">
            {accounts.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No hay cuentas configuradas.
                <Link
                  href="/accounts"
                  className="text-blue-500 hover:text-blue-600 ml-1"
                >
                  Agregar una cuenta
                </Link>
              </div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account._id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Checkbox
                      isSelected={selectedAccounts.includes(account._id)}
                      onChange={() => handleAccountSelection(account._id)}
                      className="mr-2"
                    />
                    <label className="cursor-pointer">
                      @{account.username}
                    </label>
                  </div>
                  {account.labels && account.labels.length > 0 && (
                    <div className="flex gap-1">
                      {account.labels.map((label) => (
                        <Chip key={label} size="sm" variant="flat">
                          {label}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {selectedAccounts.length}{" "}
            {selectedAccounts.length === 1
              ? "cuenta seleccionada"
              : "cuentas seleccionadas"}
          </div>
        </CardBody>
      </Card>

      {/* Barra de progreso */}
      {loading && progress.total > 0 && (
        <Card className="mb-4">
          <CardBody>
            <Progress
              value={(progress.current / progress.total) * 100}
              color="primary"
              showValueLabel={true}
              label={`Procesando cuenta ${progress.current} de ${progress.total}`}
              className="mb-2"
            />
          </CardBody>
        </Card>
      )}

      {Object.keys(actionResults).length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <h3 className="text-md font-medium">Resultados por cuenta:</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-1">
              {Object.entries(actionResults).map(([accountId, result]) => (
                <div key={accountId} className="text-sm">
                  {result}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sección de Tweet/Respuesta */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Publicar Tweet o Respuesta</h2>
        </CardHeader>
        <CardBody>
          <div className="mb-4">
            <Textarea
              fullWidth
              rows={4}
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              placeholder="¿Qué está pasando?"
              maxLength={280}
              description={`${tweetText.length}/280`}
            />
          </div>
          <div className="mb-4">
            <Input
              fullWidth
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="URL del tweet para responder (opcional)"
            />
          </div>
        </CardBody>
        <CardFooter className="flex gap-2">
          <Button
            color="primary"
            onClick={() => handleAction("tweet")}
            isDisabled={
              loading || !tweetText.trim() || selectedAccounts.length === 0
            }
          >
            Twittear ({selectedAccounts.length})
          </Button>
          <Button
            color="primary"
            onClick={() => handleAction("reply")}
            isDisabled={
              loading ||
              !tweetText.trim() ||
              !tweetUrl ||
              selectedAccounts.length === 0
            }
          >
            Responder ({selectedAccounts.length})
          </Button>
        </CardFooter>
      </Card>

      {/* Sección de Interacciones */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Interactuar con Tweet</h2>
        </CardHeader>
        <CardBody>
          <div className="mb-4">
            <Input
              fullWidth
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="URL del tweet para interactuar"
            />
          </div>
        </CardBody>
        <CardFooter className="flex gap-2">
          <Button
            color="danger"
            onClick={() => handleAction("like")}
            isDisabled={loading || !tweetUrl || selectedAccounts.length === 0}
          >
            Me gusta ({selectedAccounts.length})
          </Button>
          <Button
            color="success"
            onClick={() => handleAction("retweet")}
            isDisabled={loading || !tweetUrl || selectedAccounts.length === 0}
          >
            Retweet ({selectedAccounts.length})
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
