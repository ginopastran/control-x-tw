const axios = require("axios");

async function checkAccounts() {
  try {
    const response = await axios.get("http://localhost:3001/api/accounts");
    const accounts = response.data;

    console.log(
      `\n📊 ESTADO ACTUAL DE LAS CUENTAS (${accounts.length} total):`
    );
    console.log("=".repeat(50));

    accounts.slice(0, 10).forEach((account, index) => {
      console.log(`${index + 1}. ${account.username}`);
      console.log(
        `   API Key: ${
          account.ownApiKey
            ? account.ownApiKey.substring(0, 10) + "..."
            : "❌ NO EXISTE"
        }`
      );
      console.log(
        `   Labels: ${account.labels?.slice(0, 2).join(", ") || "sin labels"}`
      );
      console.log("");
    });

    if (accounts.length > 10) {
      console.log(`... y ${accounts.length - 10} cuentas más`);
    }

    const withApiKeys = accounts.filter((acc) => acc.ownApiKey).length;
    const withoutApiKeys = accounts.length - withApiKeys;

    console.log(`\n📈 RESUMEN:`);
    console.log(`   🔑 Con API Key: ${withApiKeys}`);
    console.log(`   ❌ Sin API Key: ${withoutApiKeys}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkAccounts();
