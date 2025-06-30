const express = require("express");

function createAdditionalRoutes(
  queueService,
  historyService,
  accountService,
  prisma
) {
  const router = express.Router();

  // Endpoint principal para acciones de Twitter (compatibilidad)
  router.post("/tweets", async (req, res) => {
    try {
      const { accountId, action, text, tweetId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: "accountId es requerido" });
      }

      if (!action) {
        return res.status(400).json({ error: "action es requerido" });
      }

      // Validar cuenta usando Prisma
      const account = await prisma.xAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Crear objeto de acción para la cola
      const actionObj = {
        id: queueService.generateActionId(),
        accountId,
        action,
        text,
        tweetId,
        account: account,
        accountUsername: account.username,
        createdAt: new Date().toISOString(),
        estimatedStartTime: new Date(
          Date.now() + queueService.actionQueue.length * 60000
        ).toISOString(),
        status: "QUEUED",
        baseDelay: 30000,
        randomDelay: 0,
      };

      await queueService.addActionsToQueue([actionObj]);

      res.json({
        success: true,
        message: "Acción añadida a la cola exitosamente",
        actionId: actionObj.id,
        queuePosition: queueService.actionQueue.length,
        estimatedStartTime: actionObj.estimatedStartTime,
      });
    } catch (error) {
      console.error("Error en /api/tweets:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Límites de cuenta
  router.get("/account-limits", async (req, res) => {
    try {
      const accounts = await accountService.getAllAccounts();

      const accountLimits = accounts.map((account) => ({
        id: account.id,
        username: account.username,
        status: account.isActive ? "active" : "suspended",
        lastActivity: account.lastActivity,
        limits: account.dailyLimits || {
          tweets: { used: 0, limit: 50 },
          retweets: { used: 0, limit: 100 },
          likes: { used: 0, limit: 1000 },
          follows: { used: 0, limit: 400 },
        },
        metrics: account.metrics || {},
      }));

      res.json(accountLimits);
    } catch (error) {
      console.error("Error obteniendo límites de cuenta:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Métricas en tiempo real
  router.get("/metrics/realtime", async (req, res) => {
    try {
      const todayMetrics = await historyService.getRealTimeMetrics();
      const queueStatus = await queueService.getQueueStatus();

      const metrics = {
        ...todayMetrics,
        realtime: {
          queueLength: queueStatus?.stats?.queueLength || 0,
          runningActions: queueStatus?.stats?.runningCount || 0,
          scheduledActions: queueStatus?.stats?.scheduled || 0,
        },
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error obteniendo métricas en tiempo real:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
        // Devolver métricas vacías en caso de error
        realtime: {
          queueLength: 0,
          runningActions: 0,
          scheduledActions: 0,
        },
      });
    }
  });

  // Debug de cuentas
  router.get("/debug/accounts", async (req, res) => {
    try {
      const accounts = await prisma.xAccount.findMany({
        select: {
          id: true,
          username: true,
          userId: true,
          labels: true,
          createdAt: true,
          useOwnCredentials: true,
          credentialsVerified: true,
          isActive: true,
          status: true,
          lastActivity: true,
        },
        orderBy: { username: "asc" },
      });

      // Calcular estadísticas
      const stats = {
        total: accounts.length,
        valid: accounts.filter((acc) => acc.isActive).length,
        needsRefresh: 0,
        expired: 0,
        invalid: accounts.filter((acc) => !acc.isActive).length,
        needsReauth: 0,
      };

      res.json({
        stats,
        accounts: accounts.map((account) => ({
          _id: account.id,
          username: account.username,
          userId: account.userId,
          developerTag: account.username,
          labels: account.labels || [],
          createdAt: account.createdAt.toISOString(),
          hasAccessToken: account.useOwnCredentials,
          hasRefreshToken: account.credentialsVerified,
          needsReauth: false,
          useOwnCredentials: account.useOwnCredentials,
          credentialsVerified: account.credentialsVerified,
          tokenInfo: {
            isValid: account.isActive,
            status: account.isActive ? "VALID" : "INVALID",
            hoursToExpiry: null,
          },
        })),
      });
    } catch (error) {
      console.error("Error en /api/debug/accounts:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // 🔥 NUEVO: Endpoint para verificar credenciales de una cuenta específica
  router.get("/accounts/:id/verify-credentials", async (req, res) => {
    try {
      const { id } = req.params;

      console.log("🔍 Verificando credenciales para cuenta ID:", id);

      // Obtener cuenta con TODAS las credenciales
      const account = await prisma.xAccount.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          userId: true,
          ownApiKey: true,
          ownApiSecret: true,
          ownAccessToken: true,
          ownAccessTokenSecret: true,
          ownOAuth2AccessToken: true,
          ownOAuth2RefreshToken: true,
          useOwnCredentials: true,
          credentialsVerified: true,
          isActive: true,
        },
      });

      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      const credentialsInfo = {
        username: account.username,
        hasOAuth2AccessToken: !!account.ownOAuth2AccessToken,
        hasOAuth2RefreshToken: !!account.ownOAuth2RefreshToken,
        hasOAuth1Complete: !!(
          account.ownApiKey &&
          account.ownApiSecret &&
          account.ownAccessToken &&
          account.ownAccessTokenSecret
        ),
        details: {
          ownApiKey: account.ownApiKey
            ? `${account.ownApiKey.substring(0, 8)}...`
            : "NO",
          ownApiSecret: account.ownApiSecret
            ? `${account.ownApiSecret.substring(0, 8)}...`
            : "NO",
          ownAccessToken: account.ownAccessToken
            ? `${account.ownAccessToken.substring(0, 8)}...`
            : "NO",
          ownAccessTokenSecret: account.ownAccessTokenSecret
            ? `${account.ownAccessTokenSecret.substring(0, 8)}...`
            : "NO",
          ownOAuth2AccessToken: account.ownOAuth2AccessToken
            ? `${account.ownOAuth2AccessToken.substring(0, 8)}...`
            : "NO",
        },
        flags: {
          useOwnCredentials: account.useOwnCredentials,
          credentialsVerified: account.credentialsVerified,
          isActive: account.isActive,
        },
      };

      console.log("🔍 Credenciales encontradas:", credentialsInfo);

      // Intentar crear cliente de Twitter
      try {
        const TwitterService = require("../services/twitterService");
        const twitterService = new TwitterService(prisma);

        const verification = await twitterService.verifyCredentials(account);

        res.json({
          success: true,
          account: credentialsInfo,
          verification: verification,
        });
      } catch (error) {
        console.error("❌ Error verificando con Twitter:", error.message);
        res.json({
          success: false,
          account: credentialsInfo,
          error: error.message,
        });
      }
    } catch (error) {
      console.error("Error verificando credenciales:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // 🔥 NUEVO: Endpoint para obtener todas las cuentas con sus credenciales (para debug)
  router.get("/debug/accounts-credentials", async (req, res) => {
    try {
      console.log("🔍 Obteniendo todas las cuentas con credenciales...");

      const accounts = await prisma.xAccount.findMany({
        select: {
          id: true,
          username: true,
          userId: true,
          twitterUserId: true,
          twitterId: true,
          ownApiKey: true,
          ownApiSecret: true,
          ownAccessToken: true,
          ownAccessTokenSecret: true,
          ownOAuth2AccessToken: true,
          ownOAuth2RefreshToken: true,
          useOwnCredentials: true,
          credentialsVerified: true,
          isActive: true,
        },
        orderBy: { username: "asc" },
      });

      const accountsInfo = accounts.map((account) => ({
        id: account.id,
        username: account.username,
        twitterUserId: account.twitterUserId || null,
        twitterId: account.twitterId || null,
        userId: account.userId || null,
        hasOAuth2: !!(
          account.ownOAuth2AccessToken && account.ownOAuth2RefreshToken
        ),
        hasOAuth1: !!(
          account.ownApiKey &&
          account.ownApiSecret &&
          account.ownAccessToken &&
          account.ownAccessTokenSecret
        ),
        credentials: {
          ownApiKey: account.ownApiKey
            ? `${account.ownApiKey.substring(0, 8)}...`
            : "NO",
          ownApiSecret: account.ownApiSecret
            ? `${account.ownApiSecret.substring(0, 8)}...`
            : "NO",
          ownAccessToken: account.ownAccessToken
            ? `${account.ownAccessToken.substring(0, 8)}...`
            : "NO",
          ownAccessTokenSecret: account.ownAccessTokenSecret
            ? `${account.ownAccessTokenSecret.substring(0, 8)}...`
            : "NO",
          ownOAuth2AccessToken: account.ownOAuth2AccessToken
            ? `${account.ownOAuth2AccessToken.substring(0, 8)}...`
            : "NO",
        },
        flags: {
          useOwnCredentials: account.useOwnCredentials,
          credentialsVerified: account.credentialsVerified,
          isActive: account.isActive,
        },
      }));

      console.log(`✅ Encontradas ${accountsInfo.length} cuentas`);

      res.json({
        success: true,
        count: accountsInfo.length,
        accounts: accountsInfo,
      });
    } catch (error) {
      console.error("Error obteniendo cuentas:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  return router;
}

module.exports = createAdditionalRoutes;
