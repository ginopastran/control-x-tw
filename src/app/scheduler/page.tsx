"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface ScheduledAction {
  type: "tweet" | "reply" | "like" | "retweet";
  text?: string;
  tweetId?: string;
  accountId: string;
  delay: number; // delay in seconds
  status?: "pending" | "executing" | "completed" | "error";
  error?: string;
}

export default function Scheduler() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [actionType, setActionType] = useState<
    "tweet" | "reply" | "like" | "retweet"
  >("tweet");
  const [tweetText, setTweetText] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");
  const [baseDelay, setBaseDelay] = useState(0); // Retraso base en segundos
  const [incrementalDelay, setIncrementalDelay] = useState(0); // Retraso incremental en segundos
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setError("Error al cargar las cuentas");
    }
  };

  const handleLabelSelection = (label: string) => {
    if (selectedLabel === label) {
      setSelectedLabel("");
      setSelectedAccounts([]);
    } else {
      setSelectedLabel(label);
      const filteredAccounts = accounts.filter((account) =>
        account.labels?.includes(label)
      );
      setSelectedAccounts(filteredAccounts.map((account) => account._id));
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

  const validateAction = () => {
    if (selectedAccounts.length === 0) {
      setError("Por favor, selecciona al menos una cuenta");
      return false;
    }

    if (actionType === "tweet" && !tweetText.trim()) {
      setError("Por favor, ingresa el texto del tweet");
      return false;
    }

    if (
      (actionType === "reply" ||
        actionType === "like" ||
        actionType === "retweet") &&
      !tweetUrl
    ) {
      setError("Por favor, ingresa la URL del tweet");
      return false;
    }

    const tweetId = tweetUrl ? extractTweetId(tweetUrl) : null;
    if (
      (actionType === "reply" ||
        actionType === "like" ||
        actionType === "retweet") &&
      !tweetId
    ) {
      setError("URL del tweet inválida");
      return false;
    }

    return true;
  };

  const scheduleActions = () => {
    if (!validateAction()) return;

    const tweetId = tweetUrl
      ? extractTweetId(tweetUrl) || undefined
      : undefined;
    const actions: ScheduledAction[] = [];

    selectedAccounts.forEach((accountId, index) => {
      actions.push({
        type: actionType,
        text:
          actionType === "tweet" || actionType === "reply"
            ? tweetText
            : undefined,
        tweetId,
        accountId,
        delay: baseDelay + incrementalDelay * index,
      });
    });

    setScheduledActions(actions);
    setError("");
    setSuccess("Acciones programadas correctamente");
  };

  const executeScheduledActions = async () => {
    if (!scheduledActions.length) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const updatedActions = [...scheduledActions];
      let completedCount = 0;
      let errorCount = 0;

      console.log(
        `Ejecutando ${updatedActions.length} acciones programadas...`
      );

      // Procesar todas las acciones secuencialmente
      for (let i = 0; i < updatedActions.length; i++) {
        const action = updatedActions[i];

        try {
          // Actualizar estado a ejecutando
          action.status = "executing";
          setScheduledActions([...updatedActions]);

          console.log(`Ejecutando acción ${i + 1}/${updatedActions.length}:`, {
            type: action.type,
            account: getAccountUsername(action.accountId),
            delay: action.delay,
            text:
              action.text?.substring(0, 30) +
              (action.text && action.text.length > 30 ? "..." : ""),
            tweetId: action.tweetId,
          });

          // Esperar el delay programado si es mayor a 0
          if (action.delay > 0) {
            console.log(
              `Esperando ${action.delay} segundos antes de ejecutar...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, action.delay * 1000)
            );
          }

          // Preparar el payload para la API
          const payload: any = {
            accountId: action.accountId,
            action: action.type,
          };

          // Agregar texto si es necesario
          if (action.type === "tweet" || action.type === "reply") {
            if (!action.text?.trim()) {
              throw new Error("El texto es requerido para esta acción");
            }
            payload.text = action.text;
          }

          // Agregar tweetId si es necesario
          if (
            action.type === "reply" ||
            action.type === "like" ||
            action.type === "retweet"
          ) {
            let finalTweetId = action.tweetId;

            // Si no hay tweetId pero hay URL, extraerlo
            if (!finalTweetId && tweetUrl) {
              finalTweetId = extractTweetId(tweetUrl) || undefined;
            }

            if (!finalTweetId) {
              throw new Error("ID del tweet es requerido para esta acción");
            }
            payload.tweetId = finalTweetId;
          }

          // Ejecutar la acción
          const response = await fetch("/api/tweets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json();

            // Si es un error de rate limit (429), mostrar mensaje específico
            if (response.status === 429) {
              throw new Error(
                `⏰ Rate limit de Twitter: ${
                  errorData.error ||
                  "Espera unos minutos antes de intentar de nuevo"
                }`
              );
            }

            throw new Error(errorData.error || `Error ${response.status}`);
          }

          const data = await response.json();
          console.log(`Acción ${i + 1} completada:`, data);

          // Actualizar estado a completado
          action.status = "completed";
          completedCount++;
          setScheduledActions([...updatedActions]);
        } catch (err: any) {
          console.error(`Error en acción ${i + 1}:`, err);
          action.status = "error";
          action.error = err.message;
          errorCount++;
          setScheduledActions([...updatedActions]);
        }

        // Pequeña pausa entre acciones para evitar saturar la API
        if (i < updatedActions.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Mostrar resultado final
      if (errorCount === 0) {
        setSuccess(
          `¡Todas las acciones (${completedCount}) se completaron exitosamente!`
        );
      } else if (completedCount === 0) {
        setError(
          `No se pudo completar ninguna acción. Revisa los errores en el listado.`
        );
      } else {
        setSuccess(
          `Se completaron ${completedCount} de ${updatedActions.length} acciones. ${errorCount} fallaron.`
        );
      }

      // Limpiar después de 5 segundos si todas fueron exitosas
      if (errorCount === 0) {
        setTimeout(() => {
          setScheduledActions([]);
          setTweetText("");
          setTweetUrl("");
        }, 5000);
      }
    } catch (err: any) {
      console.error("Error general:", err);
      setError(err.message || "Error al ejecutar las acciones");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} segundos`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}${
      remainingSeconds ? ` y ${remainingSeconds} segundos` : ""
    }`;
  };

  const getAccountUsername = (accountId: string) => {
    const account = accounts.find((a) => a._id === accountId);
    return account ? account.username : accountId;
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Programador de Acciones (Beta)
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Programa tweets, respuestas, likes y retweets con retrasos
          personalizados.
        </p>
      </div>

      {/* Selector de tipo de acción */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Tipo de Acción</label>
        <div className="flex flex-wrap gap-2">
          {(["tweet", "reply", "like", "retweet"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActionType(type)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                actionType === type
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {type === "tweet" && "Tweet"}
              {type === "reply" && "Comentario"}
              {type === "like" && "Me gusta"}
              {type === "retweet" && "Retweet"}
            </button>
          ))}
        </div>
      </div>

      {/* Configuración de retrasos */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Retraso Inicial (segundos)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={baseDelay}
              onChange={(e) =>
                setBaseDelay(Math.max(0, parseInt(e.target.value) || 0))
              }
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              placeholder="0"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setBaseDelay((prev) => prev + 10)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 10 segundos"
              >
                +10s
              </button>
              <button
                onClick={() => setBaseDelay((prev) => prev + 30)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 30 segundos"
              >
                +30s
              </button>
              <button
                onClick={() => setBaseDelay((prev) => prev + 60)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 1 minuto"
              >
                +1m
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Tiempo antes de la primera acción
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Retraso Entre Acciones (segundos)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={incrementalDelay}
              onChange={(e) =>
                setIncrementalDelay(Math.max(0, parseInt(e.target.value) || 0))
              }
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              placeholder="0"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setIncrementalDelay((prev) => prev + 10)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 10 segundos"
              >
                +10s
              </button>
              <button
                onClick={() => setIncrementalDelay((prev) => prev + 30)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 30 segundos"
              >
                +30s
              </button>
              <button
                onClick={() => setIncrementalDelay((prev) => prev + 60)}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Agregar 1 minuto"
              >
                +1m
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Tiempo adicional entre cada acción
          </p>
        </div>
      </div>

      {/* URL del tweet para acciones que lo requieren */}
      {(actionType === "reply" ||
        actionType === "like" ||
        actionType === "retweet") && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            URL del Tweet
          </label>
          <input
            type="text"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="https://twitter.com/usuario/status/123456789"
          />
        </div>
      )}

      {/* Editor de texto para tweet/reply */}
      {(actionType === "tweet" || actionType === "reply") && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {actionType === "tweet"
              ? "Texto del Tweet"
              : "Texto del Comentario"}
          </label>
          <textarea
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 min-h-[100px]"
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            placeholder={`Escribe tu ${
              actionType === "tweet" ? "tweet" : "comentario"
            }...`}
            maxLength={280}
          />
          <div className="text-sm text-gray-500 text-right">
            {tweetText.length}/280
          </div>
        </div>
      )}

      {/* Selector de etiquetas */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">
            Filtrar por Etiqueta
          </label>
          {selectedLabel && (
            <button
              onClick={() => {
                setSelectedLabel("");
                setSelectedAccounts([]);
              }}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              Limpiar filtro
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {availableLabels.map((label) => (
            <button
              key={label}
              onClick={() => handleLabelSelection(label)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedLabel === label
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {label}
              {selectedLabel === label && (
                <span className="ml-2 text-xs">✕</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de cuentas */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">
            Seleccionar Cuentas
          </label>
          <div className="flex gap-2">
            {!selectedLabel && (
              <button
                onClick={toggleAllAccounts}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                {selectedAccounts.length === accounts.length
                  ? "Deseleccionar todo"
                  : "Seleccionar todo"}
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2 dark:border-gray-700">
          {accounts.map((account) => (
            <div
              key={account._id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={account._id}
                  checked={selectedAccounts.includes(account._id)}
                  onChange={() =>
                    !selectedLabel && handleAccountSelection(account._id)
                  }
                  disabled={
                    selectedLabel !== "" &&
                    !account.labels?.includes(selectedLabel)
                  }
                  className="mr-2"
                />
                <label htmlFor={account._id} className="cursor-pointer">
                  @{account.username}
                </label>
              </div>
              {account.labels && account.labels.length > 0 && (
                <div className="flex gap-1">
                  {account.labels.map((label) => (
                    <span
                      key={label}
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        selectedLabel === label
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {selectedAccounts.length}{" "}
          {selectedAccounts.length === 1
            ? "cuenta seleccionada"
            : "cuentas seleccionadas"}
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded dark:bg-green-900 dark:text-green-100">
          {success}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={scheduleActions}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Programar Acciones
        </button>
        {scheduledActions.length > 0 && (
          <button
            onClick={executeScheduledActions}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? "Ejecutando..." : "Ejecutar Acciones"}
          </button>
        )}
      </div>

      {/* Vista previa de acciones programadas */}
      {scheduledActions.length > 0 && (
        <div className="border rounded-lg p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Acciones Programadas</h2>
          <div className="space-y-4">
            {scheduledActions.map((action, index) => (
              <div
                key={index}
                className={`p-3 rounded ${
                  action.status === "completed"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : action.status === "error"
                    ? "bg-red-50 dark:bg-red-900/20"
                    : action.status === "executing"
                    ? "bg-yellow-50 dark:bg-yellow-900/20"
                    : "bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm text-blue-600 dark:text-blue-400">
                    @{getAccountUsername(action.accountId)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-500">
                      Retraso: {formatTime(action.delay)}
                    </div>
                    {action.status && (
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          action.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : action.status === "error"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : action.status === "executing"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {action.status === "completed"
                          ? "Completado"
                          : action.status === "error"
                          ? "Error"
                          : action.status === "executing"
                          ? "Ejecutando"
                          : "Pendiente"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Acción:{" "}
                  {action.type === "tweet"
                    ? "Tweet"
                    : action.type === "reply"
                    ? "Comentario"
                    : action.type === "like"
                    ? "Me gusta"
                    : "Retweet"}
                </div>
                {action.text && (
                  <div className="text-gray-700 dark:text-gray-300 border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                    {action.text}
                  </div>
                )}
                {action.tweetId && (
                  <div className="text-sm text-gray-500 mt-1">
                    ID del tweet: {action.tweetId}
                  </div>
                )}
                {action.error && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Error: {action.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
