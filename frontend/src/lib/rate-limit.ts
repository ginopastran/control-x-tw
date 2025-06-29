/**
 * Utilidad para manejar los límites de velocidad (rate limits) de la API de X/Twitter
 */

import { logAction, logError } from "@/lib/log-action";

// Mapa para almacenar los timestamps de las últimas peticiones por endpoint
const rateLimitMap: Map<string, number> = new Map();

// Registro de errores de límite de velocidad recientes
const recentRateLimits: { timestamp: number, operation: string }[] = [];

// Configuración de intervalos por tipo de operación (en ms)
const RATE_LIMITS: Record<string, number> = {
  default: 30000,     // 30 segundos entre peticiones por defecto
  like: 60000,        // 1 minuto entre likes
  tweet: 120000,      // 2 minutos entre tweets
  retweet: 90000,     // 1.5 minutos entre retweets
  reply: 90000,       // 1.5 minutos entre respuestas
};

// Tiempo de enfriamiento dinámico para adaptarse a los límites de la API
let cooldownPeriod = 300000; // Comienza con 5 minutos

// Almacenamiento en memoria de las últimas acciones
const lastActionTimes: { [key: string]: number } = {};

/**
 * Ajusta los tiempos de espera basados en la frecuencia de errores de límite
 */
function adjustRateLimitsBasedOnHistory() {
  // Eliminar registros antiguos (más de 30 minutos)
  const now = Date.now();
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  
  while (recentRateLimits.length > 0 && recentRateLimits[0].timestamp < thirtyMinutesAgo) {
    recentRateLimits.shift();
  }
  
  // Ajustar el período de enfriamiento en función de la frecuencia de errores
  const lastFiveMinutes = now - 5 * 60 * 1000;
  const recentErrors = recentRateLimits.filter(record => record.timestamp > lastFiveMinutes).length;
  
  if (recentErrors >= 5) {
    // Muchos errores recientes, aumentar significativamente el tiempo de espera
    cooldownPeriod = Math.min(cooldownPeriod * 2, 15 * 60 * 1000); // Máximo 15 minutos
    console.warn(`Muchos errores de límite de velocidad recientes. Aumentando período de enfriamiento a ${cooldownPeriod/1000}s`);
  } else if (recentErrors === 0 && cooldownPeriod > 60000) {
    // Ningún error reciente, reducir gradualmente el tiempo de espera
    cooldownPeriod = Math.max(60000, cooldownPeriod * 0.8);
  }
}

/**
 * Registra un error de límite de velocidad y ajusta los tiempos de espera
 */
function recordRateLimitError(operationType: string) {
  recentRateLimits.push({ timestamp: Date.now(), operation: operationType });
  adjustRateLimitsBasedOnHistory();
}

/**
 * Verifica si estamos en un período de enfriamiento global
 */
function isInGlobalCooldown(): boolean {
  const lastError = recentRateLimits[recentRateLimits.length - 1];
  if (!lastError) return false;
  
  const timeSinceLastError = Date.now() - lastError.timestamp;
  return timeSinceLastError < cooldownPeriod;
}

/**
 * Espera el tiempo necesario para respetar el límite de velocidad
 * @param operationType Tipo de operación (like, tweet, retweet, reply)
 * @param accountId ID de la cuenta (opcional)
 * @returns Una promesa que se resuelve cuando es seguro realizar la operación
 */
export async function respectRateLimit(operationType: string, accountId?: string): Promise<void> {
  // Crear una clave única para esta combinación de operación y cuenta
  const key = accountId ? `${operationType}_${accountId}` : operationType;
  
  // Verificar si estamos en período de enfriamiento global
  if (isInGlobalCooldown()) {
    const waitTime = Math.ceil((cooldownPeriod - (Date.now() - recentRateLimits[recentRateLimits.length - 1].timestamp)) / 1000);
    console.log(`En período de enfriamiento global. Esperando ${waitTime}s antes de intentar ${operationType}`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }
  
  // Obtener el intervalo mínimo para este tipo de operación
  const minInterval = RATE_LIMITS[operationType] || RATE_LIMITS.default;
  
  // Obtener el timestamp de la última petición para esta clave
  const lastRequestTime = rateLimitMap.get(key) || 0;
  const now = Date.now();
  
  // Calcular cuánto tiempo debemos esperar
  const timeElapsed = now - lastRequestTime;
  const waitTime = timeElapsed < minInterval ? minInterval - timeElapsed : 0;
  
  if (waitTime > 0) {
    console.log(`Esperando ${Math.ceil(waitTime/1000)}s para respetar límites de ${operationType}`);
    // Esperar el tiempo necesario
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Actualizar el timestamp para esta clave
  rateLimitMap.set(key, Date.now());
}

/**
 * Espera el tiempo necesario antes de realizar una acción
 * @param actionType Tipo de acción (like, tweet, etc.)
 * @param accountId ID de la cuenta
 */
export async function waitForRateLimit(actionType: string, accountId: string): Promise<void> {
  const key = `${actionType}_${accountId}`;
  const now = Date.now();
  const lastActionTime = lastActionTimes[key] || 0;
  const waitTime = RATE_LIMITS[actionType as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const timeToWait = Math.max(0, lastActionTime + waitTime - now);

  if (timeToWait > 0) {
    logAction('rate_limit_wait', { 
      actionType, 
      accountId, 
      waitTime: timeToWait 
    });
    await new Promise(resolve => setTimeout(resolve, timeToWait));
  }

  lastActionTimes[key] = Date.now();
}

/**
 * Maneja errores de límite de velocidad con reintentos
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  actionType: string = 'default',
  accountId: string,
  maxRetries: number = 3,
  initialDelay: number = 60000 // Aumentado a 1 minuto
): Promise<T> {
  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Esperar el tiempo necesario antes de la acción
      await waitForRateLimit(actionType, accountId);

      // Si no es el primer intento, esperar el tiempo de retraso
      if (attempt > 0) {
        logAction('rate_limit_retry', {
          attempt,
          actionType,
          accountId,
          delay: Math.ceil(delay/1000)
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 3; // Aumentar el retraso más agresivamente (triplicar en lugar de duplicar)
      }

      return await operation();
    } catch (error: any) {
      lastError = error;

      // Si no es un error de límite de velocidad, no reintentar
      if (!error?.message?.includes('Too Many Requests') &&
          error?.status !== 429 &&
          !error?.message?.includes('rate limit')) {
        throw error;
      }

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        throw new Error(`Límite de velocidad excedido. Por favor espere ${Math.ceil(cooldownPeriod/60000)} minutos antes de intentar nuevamente.`);
      }

      logAction('rate_limit_exceeded', {
        attempt,
        actionType,
        accountId,
        nextRetryIn: delay/1000
      });

      // Aumentar el período de enfriamiento global
      cooldownPeriod = Math.min(cooldownPeriod * 2, 30 * 60 * 1000); // Máximo 30 minutos
    }
  }

  throw lastError;
} 