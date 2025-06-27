const { TwitterApi } = require("twitter-api-v2");

class TwitterService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * 🔥 SIMPLIFICADO: Configurar cliente de Twitter - REPLICA EXACTA del frontend
   * @param {Object} account - Datos de la cuenta con credenciales
   * @returns {TwitterApi} - Cliente configurado
   */
  async getTwitterClient(account) {
    console.log(`🔍 Configurando cliente Twitter para @${account.username}...`);

    // 🔥 PRIORIDAD 1: OAuth 2.0 (si existe)
    if (account.ownOAuth2AccessToken) {
      console.log(`✅ Usando OAuth 2.0 para @${account.username}`);
      return new TwitterApi(account.ownOAuth2AccessToken);
    }

    // 🔥 PRIORIDAD 2: OAuth 1.0a (si existen las 4 claves)
    if (
      account.ownApiKey &&
      account.ownApiSecret &&
      account.ownAccessToken &&
      account.ownAccessTokenSecret
    ) {
      console.log(`✅ Usando OAuth 1.0a para @${account.username}`);
      return new TwitterApi({
        appKey: account.ownApiKey,
        appSecret: account.ownApiSecret,
        accessToken: account.ownAccessToken,
        accessSecret: account.ownAccessTokenSecret,
      });
    }

    // 🔥 ERROR: Sin credenciales válidas
    throw new Error(
      `Cuenta @${account.username} no tiene credenciales válidas configuradas. ` +
        `Necesita OAuth 2.0 (ownOAuth2AccessToken) o OAuth 1.0a completo (ownApiKey, ownApiSecret, ownAccessToken, ownAccessTokenSecret).`
    );
  }

  /**
   * Manejo de errores de Twitter API (igual que en frontend)
   */
  handleTwitterError(error, actionType) {
    console.error(`❌ Error de Twitter API en ${actionType}:`, error);

    // Manejo específico de errores de Twitter
    if (error.code || error.errors) {
      const errorCode =
        error.code || (error.errors && error.errors[0] && error.errors[0].code);

      const errorMessages = {
        32: "No autenticado - Token inválido",
        63: "Usuario suspendido",
        64: "Tu cuenta está suspendida",
        89: "Token inválido o expirado",
        99: "No puedes ver estos datos",
        135: "No se pudo autenticar",
        215: "Credenciales incorrectas",
        326: "Cuenta bloqueada temporalmente",
        187: "Tweet duplicado",
        186: "Tweet demasiado largo",
        161: "No puedes seguir a más usuarios",
        160: "Ya sigues a este usuario",
        162: "No puedes seguir a este usuario",
        108: "No se puede encontrar el usuario especificado",
        50: "Usuario no encontrado",
        144: "Tweet no encontrado",
        324: "La imagen debe ser menor a 5MB",
        422: "El archivo de imagen está corrupto",
      };

      const message =
        errorMessages[errorCode] || `Error de Twitter: ${error.message}`;

      // Crear error personalizado con información adicional
      const customError = new Error(message);
      customError.twitterError = errorCode;
      customError.actionType = actionType;
      customError.originalError = error;

      throw customError;
    }

    // Error genérico
    const customError = new Error(
      `Error ejecutando ${actionType}: ${error.message}`
    );
    customError.actionType = actionType;
    customError.originalError = error;

    throw customError;
  }

  /**
   * 🔥 NUEVO: Verificar credenciales de una cuenta
   * @param {Object} account - Datos de la cuenta
   * @returns {Object} - Resultado de la verificación
   */
  async verifyCredentials(account) {
    try {
      console.log(`🔍 Verificando credenciales para @${account.username}...`);

      // Intentar crear cliente
      const client = await this.getTwitterClient(account);

      // Verificar con una llamada simple a la API
      const user = await client.v2.me();

      console.log(`✅ Credenciales válidas para @${account.username}:`, {
        userId: user.data.id,
        username: user.data.username,
        name: user.data.name,
      });

      return {
        valid: true,
        user: {
          id: user.data.id,
          username: user.data.username,
          name: user.data.name,
        },
        message: "Credenciales verificadas correctamente",
      };
    } catch (error) {
      console.error(
        `❌ Error verificando credenciales para @${account.username}:`,
        error.message
      );

      return {
        valid: false,
        error: error.message,
        message: "Error al verificar credenciales",
      };
    }
  }

  /**
   * Obtener límites de rate limit actuales
   */
  async getRateLimitStatus(account) {
    try {
      const client = await this.getTwitterClient(account);

      // Obtener límites de diferentes endpoints
      const limits = await client.v1.rateLimitStatuses();

      return {
        success: true,
        limits: limits.resources,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `❌ Error obteniendo rate limits para @${account.username}:`,
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualizar información de la cuenta en la base de datos
   */
  async updateAccountActivity(
    accountId,
    actionType,
    success,
    result = null,
    error = null
  ) {
    try {
      await this.prisma.xAccount.update({
        where: { id: accountId },
        data: {
          lastActivity: new Date(),
          updatedAt: new Date(),
          // Actualizar métricas si es necesario
          metrics: {
            lastAction: actionType,
            lastActionAt: new Date().toISOString(),
            lastActionSuccess: success,
            ...(result && { lastResult: result }),
            ...(error && { lastError: error }),
          },
        },
      });
    } catch (err) {
      console.error(
        `❌ Error actualizando actividad de cuenta ${accountId}:`,
        err
      );
    }
  }
}

module.exports = TwitterService;
