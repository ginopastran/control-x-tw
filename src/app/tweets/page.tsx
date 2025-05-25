'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface TweetAction {
  type: 'tweet' | 'reply' | 'like' | 'retweet';
  text?: string;
  tweetId?: string;
}

// Función de utilidad para esperar
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      if (error.message?.includes('Too Many Requests')) {
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
  const [tweetText, setTweetText] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionResults, setActionResults] = useState<{[key: string]: string}>({});
  const [progress, setProgress] = useState<{current: number, total: number}>({ current: 0, total: 0 });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    // Extraer todas las etiquetas únicas de las cuentas
    const labels = new Set<string>();
    accounts.forEach(account => {
      account.labels?.forEach(label => labels.add(label));
    });
    setAvailableLabels(Array.from(labels));
  }, [accounts]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error('Error al cargar cuentas');
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError('Error al cargar las cuentas');
    }
  };

  const extractTweetId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const statusIndex = pathParts.indexOf('status');
      return statusIndex !== -1 ? pathParts[statusIndex + 1] : null;
    } catch {
      return null;
    }
  };

  const handleAction = async (actionType: TweetAction['type']) => {
    if (selectedAccounts.length === 0) {
      setError('Por favor selecciona al menos una cuenta');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setActionResults({});
    setProgress({ current: 0, total: selectedAccounts.length });

    try {
      const tweetId = tweetUrl ? extractTweetId(tweetUrl) : null;
      
      if ((actionType === 'reply' || actionType === 'like' || actionType === 'retweet') && !tweetId) {
        throw new Error('URL de tweet inválida');
      }

      if ((actionType === 'tweet' || actionType === 'reply') && !tweetText.trim()) {
        throw new Error('El texto del tweet no puede estar vacío');
      }

      // Procesar cuentas secuencialmente con retraso
      const newActionResults: {[key: string]: string} = {};
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < selectedAccounts.length; i++) {
        const accountId = selectedAccounts[i];
        const account = accounts.find(a => a._id === accountId);
        const username = account ? account.username : accountId;

        try {
          await retryWithBackoff(async () => {
            const response = await fetch('/api/tweets', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accountId,
                action: actionType,
                text: tweetText,
                tweetId
              }),
            });

            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Error desconocido');
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
        setActionResults({...newActionResults});

        // Esperar un tiempo entre solicitudes para evitar límites de tasa
        if (i < selectedAccounts.length - 1) {
          await delay(2000);
        }
      }

      if (failureCount === 0) {
        setSuccess(`¡${actionType} realizado con éxito en ${successCount} ${successCount === 1 ? 'cuenta' : 'cuentas'}!`);
      } else if (successCount === 0) {
        setError(`No se pudo realizar la acción en ninguna cuenta. Revisa los detalles abajo.`);
      } else {
        setSuccess(`Acción parcialmente completada: ${successCount} exitosas, ${failureCount} fallidas. Revisa los detalles abajo.`);
      }

      if (actionType === 'tweet' || actionType === 'reply') {
        setTweetText('');
      }
      setTweetUrl('');
    } catch (err: any) {
      setError(err.message || 'Error al realizar la acción');
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleAccountSelection = (accountId: string) => {
    setSelectedAccounts(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(account => account._id));
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
    const filteredAccounts = accounts.filter(account =>
      account.labels?.includes(label)
    );
    setSelectedAccounts(filteredAccounts.map(account => account._id));
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6"></h1>
      
      {/* Selector de etiquetas */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Filtrar por Etiquetas</label>
          {selectedLabels.length > 0 && (
            <button
              onClick={() => {
                setSelectedLabels([]);
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
                selectedLabels.includes(label)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {label}
              {selectedLabels.includes(label) && (
                <span className="ml-2 text-xs">✕</span>
              )}
            </button>
          ))}
          {availableLabels.length === 0 && (
            <p className="text-sm text-gray-500">No hay etiquetas disponibles</p>
          )}
        </div>
      </div>

      {/* Selector de cuentas */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Seleccionar Cuentas</label>
          <div className="flex gap-2 items-center">
            <Link 
              href="/accounts"
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Agregar Cuenta
            </Link>
            <button
              onClick={toggleAllAccounts}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              {selectedAccounts.length === accounts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2 dark:border-gray-700">
          {accounts.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No hay cuentas configuradas. 
              <Link href="/accounts" className="text-blue-500 hover:text-blue-600 ml-1">
                Agregar una cuenta
              </Link>
            </div>
          ) : (
            accounts.map((account) => (
              <div key={account._id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={account._id}
                    checked={selectedAccounts.includes(account._id)}
                    onChange={() => handleAccountSelection(account._id)}
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
                        className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {selectedAccounts.length} {selectedAccounts.length === 1 ? 'cuenta seleccionada' : 'cuentas seleccionadas'}
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
      
      {/* Barra de progreso */}
      {loading && progress.total > 0 && (
        <div className="mb-4">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-500 mt-1 text-center">
            Procesando cuenta {progress.current} de {progress.total}
          </div>
        </div>
      )}

      {Object.keys(actionResults).length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded dark:bg-gray-800">
          <h3 className="font-medium mb-2">Resultados por cuenta:</h3>
          <div className="space-y-1">
            {Object.entries(actionResults).map(([accountId, result]) => (
              <div key={accountId} className="text-sm">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de Tweet/Respuesta */}
      <div className="mb-6 p-4 border rounded dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Publicar Tweet o Respuesta</h2>
        <div className="mb-4">
          <textarea
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            rows={4}
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            placeholder="¿Qué está pasando?"
            maxLength={280}
          />
          <div className="text-sm text-gray-500 text-right">
            {tweetText.length}/280
          </div>
        </div>
        <div className="mb-4">
          <input
            type="text"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="URL del tweet para responder (opcional)"
          />
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={() => handleAction('tweet')}
            disabled={loading || !tweetText.trim() || selectedAccounts.length === 0}
          >
            Twittear ({selectedAccounts.length})
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={() => handleAction('reply')}
            disabled={loading || !tweetText.trim() || !tweetUrl || selectedAccounts.length === 0}
          >
            Responder ({selectedAccounts.length})
          </button>
        </div>
      </div>
          
      {/* Sección de Interacciones */}
      <div className="p-4 border rounded dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Interactuar con Tweet</h2>
        <div className="mb-4">
          <input 
            type="text"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="URL del tweet para interactuar"
          />
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            onClick={() => handleAction('like')}
            disabled={loading || !tweetUrl || selectedAccounts.length === 0}
          >
            Me gusta ({selectedAccounts.length})
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            onClick={() => handleAction('retweet')}
            disabled={loading || !tweetUrl || selectedAccounts.length === 0}
          >
            Retweet ({selectedAccounts.length})
          </button>
        </div>
      </div>
    </div>
  );
} 