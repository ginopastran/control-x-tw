const { PrismaClient } = require("@prisma/client");

class AccountService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getAllAccounts() {
    return await this.prisma.xAccount.findMany({
      select: {
        id: true,
        username: true,
        labels: true,
        isActive: true,
        status: true,
        lastActivity: true,
        metrics: true,
        dailyLimits: true,
      },
      orderBy: { username: "asc" },
    });
  }

  async getAccountById(id) {
    return await this.prisma.xAccount.findUnique({
      where: { id },
      include: {
        actionHistory: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async updateAccount(id, updateData) {
    return await this.prisma.xAccount.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  async enableAccountsForMutualFollow(accountIds) {
    const updatedAccounts = [];

    for (const accountId of accountIds) {
      try {
        const updatedAccount = await this.prisma.xAccount.update({
          where: { id: accountId },
          data: {
            useOwnCredentials: true,
            credentialsVerified: true,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        updatedAccounts.push(updatedAccount);
      } catch (error) {
        console.error(
          `❌ Error actualizando cuenta ${accountId}:`,
          error.message
        );
      }
    }

    return updatedAccounts;
  }

  async createSampleAccounts() {
    const sampleAccounts = [
      {
        username: "test_account_1",
        userId: "test_user_1",
        twitterUserId: "1234567890",
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
        labels: ["test", "verified"],
        status: "active",
      },
      // ... resto de cuentas de prueba
    ];

    const createdAccounts = [];

    for (const accountData of sampleAccounts) {
      const existingAccount = await this.prisma.xAccount.findFirst({
        where: { username: accountData.username },
      });

      if (existingAccount) {
        const updatedAccount = await this.prisma.xAccount.update({
          where: { id: existingAccount.id },
          data: {
            useOwnCredentials: accountData.useOwnCredentials,
            credentialsVerified: accountData.credentialsVerified,
            isActive: accountData.isActive,
            labels: accountData.labels,
            status: accountData.status,
            updatedAt: new Date(),
          },
        });
        createdAccounts.push(updatedAccount);
      } else {
        const newAccount = await this.prisma.xAccount.create({
          data: {
            ...accountData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        createdAccounts.push(newAccount);
      }
    }

    return createdAccounts;
  }
}

module.exports = AccountService;
