class CampaignService {
  constructor(prisma, queueService) {
    this.prisma = prisma;
    this.queueService = queueService;
    this.mutualFollowCampaign = null;
  }

  generateCampaignId() {
    return `follow_campaign_${Date.now()}`;
  }

  async createMutualFollowActions() {
    try {
      console.log("🔍 Buscando cuentas con credenciales para la campaña...");

      // Buscar cuentas que tengan credenciales configuradas (sin importar credentialsVerified)
      const accounts = await this.prisma.xAccount.findMany({
        where: {
          AND: [
            { isActive: { not: false } }, // isActive no es false (puede ser true o null)
            {
              OR: [
                // OAuth 1.0a credentials
                {
                  AND: [
                    { ownApiKey: { not: null } },
                    { ownApiSecret: { not: null } },
                    { ownAccessToken: { not: null } },
                    { ownAccessTokenSecret: { not: null } },
                  ],
                },
                // OAuth 2.0 credentials
                {
                  AND: [
                    { ownClientId: { not: null } },
                    { ownClientSecret: { not: null } },
                    { ownOAuth2AccessToken: { not: null } },
                  ],
                },
              ],
            },
          ],
        },
      });

      console.log(
        `📊 Encontradas ${accounts.length} cuentas con credenciales configuradas`
      );

      // Log detallado de las cuentas encontradas para debug
      accounts.forEach((account, index) => {
        const hasOAuth1 = !!(
          account.ownApiKey &&
          account.ownApiSecret &&
          account.ownAccessToken &&
          account.ownAccessTokenSecret
        );
        const hasOAuth2 = !!(
          account.ownClientId &&
          account.ownClientSecret &&
          account.ownOAuth2AccessToken
        );
        console.log(
          `  ${index + 1}. @${
            account.username
          } - OAuth1: ${hasOAuth1}, OAuth2: ${hasOAuth2}, Active: ${
            account.isActive
          }`
        );
      });

      if (accounts.length < 2) {
        throw new Error(
          `Se necesitan al menos 2 cuentas con credenciales para la campaña. Solo se encontraron ${accounts.length} cuentas. Verifique que las cuentas tengan sus credenciales OAuth configuradas.`
        );
      }

      const followActions = [];
      const campaignId = this.generateCampaignId();

      // Crear matriz de follows: cada cuenta sigue a todas las demás
      for (const follower of accounts) {
        for (const target of accounts) {
          if (follower.id !== target.id) {
            followActions.push({
              followerId: follower.id,
              followerUsername: follower.username,
              targetId: target.id,
              targetUsername: target.username,
              targetUserId: target.userId || target.username, // Fallback por si no hay userId
              campaignId,
            });
          }
        }
      }

      console.log(`🎯 Generadas ${followActions.length} acciones de follow`);

      return {
        actions: followActions,
        totalAccounts: accounts.length,
        totalActions: followActions.length,
        campaignId,
      };
    } catch (error) {
      console.error("❌ Error creando acciones de follow mutuo:", error);
      throw error;
    }
  }

  async scheduleFollowActions(actions, campaignId) {
    try {
      console.log(
        `⏱️ Programando ${actions.length} acciones durante 5 días...`
      );

      // Extender la campaña a 5 días como solicitó el usuario
      const CAMPAIGN_DAYS = 5;
      const ACTIONS_PER_DAY = Math.ceil(actions.length / CAMPAIGN_DAYS);

      // Limitar a máximo 40 acciones por día para ser más conservador
      const DAILY_LIMIT = 40;
      const SAFE_ACTIONS_PER_DAY = Math.min(ACTIONS_PER_DAY, DAILY_LIMIT);

      const newScheduledActions = [];
      const now = new Date();

      console.log(
        `📅 Distribuyendo ~${SAFE_ACTIONS_PER_DAY} acciones por día durante ${CAMPAIGN_DAYS} días`
      );

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];

        // Calcular el día (0-4 para 5 días)
        const dayOffset = Math.floor(i / SAFE_ACTIONS_PER_DAY);
        const actionIndexInDay = i % SAFE_ACTIONS_PER_DAY;

        // Distribuir acciones durante 14 horas (6:00 AM - 8:00 PM)
        const HOURS_SPREAD = 14;
        const START_HOUR = 6;

        // Calcular minutos de separación entre acciones en el día
        const minutesSpread = (HOURS_SPREAD * 60) / SAFE_ACTIONS_PER_DAY;

        const scheduledTime = new Date(now);
        scheduledTime.setDate(now.getDate() + dayOffset);
        scheduledTime.setHours(
          START_HOUR + Math.floor((actionIndexInDay * minutesSpread) / 60)
        );
        scheduledTime.setMinutes((actionIndexInDay * minutesSpread) % 60);
        scheduledTime.setSeconds(Math.floor(Math.random() * 60)); // Segundos aleatorios

        const actionObj = {
          id: this.queueService.generateActionId(),
          accountId: action.followerId,
          action: "follow",
          targetUserId: action.targetUserId,
          account: { username: action.followerUsername },
          accountUsername: action.followerUsername,
          accountLabels: [],
          createdAt: new Date().toISOString(),
          scheduledTime: scheduledTime.toISOString(),
          status: "SCHEDULED",
          baseDelay: 45000, // 45 segundos base
          randomDelay: 90000, // +/- 90 segundos aleatorio (muy conservador)
          batchId: campaignId,
          campaignType: "mutual_follow",
          targetUsername: action.targetUsername,
        };

        newScheduledActions.push(actionObj);

        // Agregar a la cola programada y al historial
        await this.queueService.addScheduledAction(actionObj);
        await this.queueService.addToHistory(actionObj);

        // Log de progreso cada 50 acciones
        if ((i + 1) % 50 === 0) {
          console.log(`✅ Programadas ${i + 1}/${actions.length} acciones`);
        }
      }

      console.log(
        `🎉 Todas las ${newScheduledActions.length} acciones programadas exitosamente`
      );
      return newScheduledActions;
    } catch (error) {
      console.error("❌ Error programando acciones:", error);
      throw error;
    }
  }

  async startMutualFollowCampaign() {
    try {
      console.log("🚀 Iniciando campaña de follow mutuo...");

      if (this.mutualFollowCampaign && this.mutualFollowCampaign.isRunning) {
        throw new Error("Ya hay una campaña de follow mutuo en curso");
      }

      const { actions, totalAccounts, totalActions, campaignId } =
        await this.createMutualFollowActions();

      await this.scheduleFollowActions(actions, campaignId);

      // Configurar la campaña para 5 días
      const estimatedCompletionDate = new Date();
      estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + 5);

      this.mutualFollowCampaign = {
        campaignId,
        isRunning: true,
        startedAt: new Date().toISOString(),
        accounts: totalAccounts,
        progress: {
          total: totalActions,
          completed: 0,
          failed: 0,
          pending: totalActions,
        },
        currentPhase: "Ejecutando follows programados",
        estimatedCompletion: estimatedCompletionDate.toISOString(),
        durationDays: 5,
        dailyLimit: 40,
      };

      console.log(
        `✅ Campaña iniciada: ${totalActions} acciones programadas durante 5 días`
      );
      return this.mutualFollowCampaign;
    } catch (error) {
      console.error("❌ Error iniciando campaña de follow mutuo:", error);
      throw error;
    }
  }

  async getCampaignStatus() {
    try {
      if (!this.mutualFollowCampaign) {
        return { isRunning: false, campaign: null };
      }

      // Obtener estadísticas actualizadas de la base de datos
      const [completedActions, failedActions, pendingActions] =
        await Promise.all([
          this.prisma.actionHistory.count({
            where: {
              batchId: this.mutualFollowCampaign.campaignId,
              status: "COMPLETED",
            },
          }),
          this.prisma.actionHistory.count({
            where: {
              batchId: this.mutualFollowCampaign.campaignId,
              status: "FAILED",
            },
          }),
          this.prisma.actionHistory.count({
            where: {
              batchId: this.mutualFollowCampaign.campaignId,
              status: { in: ["SCHEDULED", "QUEUED", "RUNNING"] },
            },
          }),
        ]);

      // Actualizar progreso
      this.mutualFollowCampaign.progress = {
        completed: completedActions,
        failed: failedActions,
        pending: pendingActions,
        total: this.mutualFollowCampaign.progress.total,
      };

      // Verificar si la campaña ha terminado
      if (
        completedActions + failedActions >=
        this.mutualFollowCampaign.progress.total
      ) {
        this.mutualFollowCampaign.isRunning = false;
        this.mutualFollowCampaign.currentPhase = "Completada";
        this.mutualFollowCampaign.completedAt = new Date().toISOString();
      }

      return {
        isRunning: this.mutualFollowCampaign.isRunning,
        campaign: this.mutualFollowCampaign,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estado de campaña:", error);
      throw error;
    }
  }

  async cancelCampaign() {
    try {
      if (!this.mutualFollowCampaign || !this.mutualFollowCampaign.isRunning) {
        throw new Error("No hay campaña de follow mutuo en curso");
      }

      console.log(
        `🛑 Cancelando campaña ${this.mutualFollowCampaign.campaignId}...`
      );

      const canceledCount = await this.queueService.cancelCampaignActions(
        this.mutualFollowCampaign.campaignId
      );

      this.mutualFollowCampaign.isRunning = false;
      this.mutualFollowCampaign.currentPhase = "Cancelada";
      this.mutualFollowCampaign.cancelledAt = new Date().toISOString();

      console.log(`✅ Campaña cancelada, ${canceledCount} acciones removidas`);

      // Limpiar campaña después de 10 segundos
      setTimeout(() => {
        this.mutualFollowCampaign = null;
      }, 10000);

      return { canceledActions: canceledCount };
    } catch (error) {
      console.error("❌ Error cancelando campaña:", error);
      throw error;
    }
  }
}

module.exports = CampaignService;
