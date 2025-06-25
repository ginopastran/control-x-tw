"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface XAccount {
  _id: string;
  username: string;
  labels: string[];
}

interface Message {
  text: string;
  accountId: string;
  type: "tweet" | "reply";
  tweetId?: string;
}

export default function TestTweets() {
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [messages, setMessages] = useState<string>("");
  const [distribution, setDistribution] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"tweet" | "reply">("tweet");
  const [tweetUrl, setTweetUrl] = useState("");

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
      setError("Error al cargar las cuentas");
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
    if (selectedLabel === label) {
      // Si la etiqueta ya está seleccionada, la deseleccionamos
      setSelectedLabel("");
      setSelectedAccounts([]);
    } else {
      // Seleccionamos la nueva etiqueta y filtramos las cuentas
      setSelectedLabel(label);
      const filteredAccounts = accounts.filter((account) =>
        account.labels?.includes(label)
      );
      setSelectedAccounts(filteredAccounts.map((account) => account._id));
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
    const messageList = messages
      .split("\n")
      .filter((msg) => msg.trim() !== "")
      .map((msg) => msg.trim());

    if (messageList.length === 0) {
      setError("Por favor, ingresa al menos un mensaje");
      return;
    }

    if (selectedAccounts.length === 0) {
      setError("Por favor, selecciona al menos una cuenta");
      return;
    }

    if (mode === "reply") {
      const tweetId = extractTweetId(tweetUrl);
      if (!tweetId) {
        setError("Por favor, ingresa una URL válida del tweet");
        return;
      }
    }

    const distribution: Message[] = [];
    let messageIndex = 0;
    const tweetId =
      mode === "reply" ? extractTweetId(tweetUrl) || undefined : undefined;

    // Distribuir mensajes entre las cuentas seleccionadas
    selectedAccounts.forEach((accountId) => {
      const message = messageList[messageIndex];
      distribution.push({
        text: message,
        accountId: accountId,
        type: mode,
        tweetId,
      });
      messageIndex = (messageIndex + 1) % messageList.length;
    });

    setDistribution(distribution);
    setError("");
    setSuccess("Mensajes distribuidos correctamente");
  };

  const handlePublish = async () => {
    if (!distribution.length) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      for (const message of distribution) {
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

        if (!response.ok) {
          throw new Error("Error al publicar tweets");
        }

        // Esperar 2 segundos entre cada publicación
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setSuccess("¡Todos los mensajes fueron publicados exitosamente!");
      setMessages("");
      setDistribution([]);
      if (mode === "reply") {
        setTweetUrl("");
      }
    } catch (err) {
      setError("Error al publicar los tweets. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const getAccountUsername = (accountId: string) => {
    const account = accounts.find((a) => a._id === accountId);
    return account ? account.username : accountId;
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Distribuidor de Tweets (Beta)
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Distribuye diferentes mensajes entre las cuentas seleccionadas.
        </p>
      </div>

      {/* Selector de modo */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Modo</label>
        <div className="flex gap-4">
          <button
            onClick={() => setMode("tweet")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === "tweet"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Tweets
          </button>
          <button
            onClick={() => setMode("reply")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === "reply"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Comentarios
          </button>
        </div>
      </div>

      {/* URL del tweet para respuestas */}
      {mode === "reply" && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            URL del Tweet a Comentar
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
          {availableLabels.length === 0 && (
            <p className="text-sm text-gray-500">
              No hay etiquetas disponibles
            </p>
          )}
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

      {/* Editor de mensajes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {mode === "tweet" ? "Tweets" : "Comentarios"} (uno por línea)
        </label>
        <textarea
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 min-h-[200px]"
          value={messages}
          onChange={(e) => setMessages(e.target.value)}
          placeholder={`Escribe cada ${
            mode === "tweet" ? "tweet" : "comentario"
          } en una línea diferente...`}
        />
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
          onClick={distributeMessages}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Vista Previa
        </button>
        {distribution.length > 0 && (
          <button
            onClick={handlePublish}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading
              ? "Publicando..."
              : `Publicar ${mode === "tweet" ? "Tweets" : "Comentarios"}`}
          </button>
        )}
      </div>

      {/* Vista previa de la distribución */}
      {distribution.length > 0 && (
        <div className="border rounded-lg p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">
            Vista Previa de Distribución
          </h2>
          <div className="space-y-4">
            {distribution.map((item, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div className="font-medium text-sm text-blue-600 dark:text-blue-400 mb-1">
                  @{getAccountUsername(item.accountId)}
                  {item.type === "reply" && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      (Comentario al tweet {item.tweetId})
                    </span>
                  )}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
