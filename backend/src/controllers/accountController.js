class AccountController {
  constructor(accountService) {
    this.accountService = accountService;
  }

  async getAllAccounts(req, res) {
    try {
      const accounts = await this.accountService.getAllAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error obteniendo cuentas:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        details: error.message,
      });
    }
  }

  async getAccountById(req, res) {
    try {
      const { id } = req.params;
      const account = await this.accountService.getAccountById(id);

      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      const accountData = {
        id: account.id,
        username: account.username,
        userId: account.userId,
        labels: account.labels,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastActivity: account.lastActivity,
        status: account.status,
        isActive: account.isActive,
        useOwnCredentials: account.useOwnCredentials,
        credentialsVerified: account.credentialsVerified,
        metrics: account.metrics,
        dailyLimits: account.dailyLimits,
        recentActions: account.actionHistory.map((a) => ({
          id: a.actionId,
          action: a.action,
          status: a.status,
          success: a.success,
          createdAt: a.createdAt,
          text: a.text?.substring(0, 100),
        })),
      };

      res.json({ success: true, account: accountData });
    } catch (error) {
      console.error("Error obteniendo cuenta:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  }

  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const { labels, isActive, dailyLimits } = req.body;

      const updateData = {};
      if (labels !== undefined) updateData.labels = labels;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (dailyLimits !== undefined) updateData.dailyLimits = dailyLimits;

      const account = await this.accountService.updateAccount(id, updateData);
      res.json({ success: true, account });
    } catch (error) {
      console.error("Error actualizando cuenta:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  }

  async enableForMutualFollow(req, res) {
    try {
      const { accountIds } = req.body;

      if (!accountIds || !Array.isArray(accountIds)) {
        return res.status(400).json({
          error: "Se requiere un array de accountIds",
        });
      }

      const updatedAccounts =
        await this.accountService.enableAccountsForMutualFollow(accountIds);

      res.json({
        success: true,
        message: `${updatedAccounts.length} cuentas habilitadas para follow mutuo`,
        accounts: updatedAccounts.map((acc) => ({
          id: acc.id,
          username: acc.username,
          useOwnCredentials: acc.useOwnCredentials,
          credentialsVerified: acc.credentialsVerified,
          isActive: acc.isActive,
        })),
      });
    } catch (error) {
      console.error("Error habilitando cuentas:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  }

  async createSampleAccounts(req, res) {
    try {
      const createdAccounts = await this.accountService.createSampleAccounts();

      res.json({
        success: true,
        message: `${createdAccounts.length} cuentas de prueba procesadas exitosamente`,
        accounts: createdAccounts.map((acc) => ({
          id: acc.id,
          username: acc.username,
          useOwnCredentials: acc.useOwnCredentials,
          credentialsVerified: acc.credentialsVerified,
          isActive: acc.isActive,
          status: acc.status,
          labels: acc.labels,
        })),
        verifiedCount: createdAccounts.filter(
          (acc) => acc.useOwnCredentials && acc.credentialsVerified
        ).length,
      });
    } catch (error) {
      console.error("Error creando cuentas de prueba:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  }
}

module.exports = AccountController;
