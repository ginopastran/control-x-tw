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
    const accounts = await this.prisma.xAccount.findMany({
      where: {
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
      },
    });

    if (accounts.length < 2) {
      throw new Error(
        "Se necesitan al menos 2 cuentas verificadas para la campaña"
      );
    }

    const followActions = [];
    const campaignId = this.generateCampaignId();

    for (const follower of accounts) {
      for (const target of accounts) {
        if (follower.id !== target.id) {
          followActions.push({
            followerId: follower.id,
            followerUsername: follower.username,
            targetId: target.id,
            targetUsername: target.username,
            targetUserId: target.userId,
            campaignId,
          });
        }
      }
    }

    return {
      actions: followActions,
      totalAccounts: accounts.length,
      totalActions: followActions.length,
      campaignId,
    };
  }

  async scheduleFollowActions(actions, campaignId) {
    const CAMPAIGN_DAYS = 4;
    const ACTIONS_PER_DAY = Math.ceil(actions.length / CAMPAIGN_DAYS);
    const DAILY_LIMIT = 50;

    const newScheduledActions = [];
    const now = new Date();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const dayOffset = Math.floor(i / ACTIONS_PER_DAY);
      const actionIndexInDay = i % ACTIONS_PER_DAY;

      const hoursSpread = 12;
      const minutesSpread =
        (hoursSpread * 60) / Math.min(ACTIONS_PER_DAY, DAILY_LIMIT);

      const scheduledTime = new Date(now);
      scheduledTime.setDate(now.getDate() + dayOffset);
      scheduledTime.setHours(9);
      scheduledTime.setMinutes(actionIndexInDay * minutesSpread);
      scheduledTime.setSeconds(Math.random() * 60);

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
        baseDelay: 30000,
        randomDelay: 60000,
        batchId: campaignId,
        campaignType: "mutual_follow",
        targetUsername: action.targetUsername,
      };

      newScheduledActions.push(actionObj);
      await this.queueService.addScheduledAction(actionObj);
      await this.queueService.addToHistory(actionObj);
    }

    return newScheduledActions;
  }

  async startMutualFollowCampaign() {
    if (this.mutualFollowCampaign && this.mutualFollowCampaign.isRunning) {
      throw new Error("Ya hay una campaña de follow mutuo en curso");
    }

    const { actions, totalAccounts, totalActions, campaignId } =
      await this.createMutualFollowActions();

    await this.scheduleFollowActions(actions, campaignId);

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
      currentPhase: "Programando follows",
      estimatedCompletion: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    return this.mutualFollowCampaign;
  }

  async getCampaignStatus() {
    if (!this.mutualFollowCampaign) {
      return { isRunning: false, campaign: null };
    }

    const completedActions = await this.prisma.actionHistory.count({
      where: {
        batchId: this.mutualFollowCampaign.campaignId,
        status: "COMPLETED",
      },
    });

    const failedActions = await this.prisma.actionHistory.count({
      where: {
        batchId: this.mutualFollowCampaign.campaignId,
        status: "FAILED",
      },
    });

    const pendingActions = await this.prisma.actionHistory.count({
      where: {
        batchId: this.mutualFollowCampaign.campaignId,
        status: { in: ["SCHEDULED", "QUEUED", "RUNNING"] },
      },
    });

    this.mutualFollowCampaign.progress = {
      completed: completedActions,
      failed: failedActions,
      pending: pendingActions,
      total: this.mutualFollowCampaign.progress.total,
    };

    if (
      completedActions + failedActions >=
      this.mutualFollowCampaign.progress.total
    ) {
      this.mutualFollowCampaign.isRunning = false;
      this.mutualFollowCampaign.completedAt = new Date().toISOString();
    }

    return {
      isRunning: this.mutualFollowCampaign.isRunning,
      campaign: this.mutualFollowCampaign,
    };
  }

  async cancelCampaign() {
    if (!this.mutualFollowCampaign || !this.mutualFollowCampaign.isRunning) {
      throw new Error("No hay campaña de follow mutuo en curso");
    }

    const canceledCount = await this.queueService.cancelCampaignActions(
      this.mutualFollowCampaign.campaignId
    );

    this.mutualFollowCampaign.isRunning = false;
    this.mutualFollowCampaign.cancelledAt = new Date().toISOString();

    setTimeout(() => {
      this.mutualFollowCampaign = null;
    }, 5000);

    return { canceledActions: canceledCount };
  }
}

module.exports = CampaignService;
