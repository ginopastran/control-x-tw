/**
 * Registra acciones con información de contexto para depuración
 */
export function logAction(action: string, details: any, isError: boolean = false) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] ${action}:`;
  
  if (isError) {
    console.error(logPrefix, details);
  } else {
    console.log(logPrefix, details);
  }
  
  // Si estamos en desarrollo, podríamos guardar los logs en otro lugar
  if (process.env.NODE_ENV !== 'production') {
    try {
      // Aquí podrías implementar almacenamiento adicional de logs para desarrollo
      // Por ejemplo, en localStorage o enviarlos a un endpoint específico
    } catch (e) {
      // No hacer nada si falla el almacenamiento adicional
    }
  }
}

/**
 * Registra errores con stack trace y contexto
 */
export function logError(action: string, error: any, context: any = {}) {
  // Asegurar que error no sea null o undefined
  if (error === null || error === undefined) {
    error = new Error('Error desconocido (null o undefined)');
  }
  
  // Si error no es un objeto Error, convertirlo
  if (typeof error !== 'object' || error === null) {
    error = new Error(String(error));
  }
  
  const errorDetails = {
    message: error.message || String(error),
    stack: error.stack,
    ...context
  };
  
  logAction(action, errorDetails, true);
  
  // Aquí podrías implementar más lógica como enviar a un servicio de monitoreo
} 