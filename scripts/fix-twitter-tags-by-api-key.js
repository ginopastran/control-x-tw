const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { parse } = require("csv-parse/sync");

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const CSV_FILE_PATH = path.join(
  __dirname,
  "..",
  "frontend",
  "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
);

async function fixTwitterTagsByApiKey() {
  try {
    console.log("🔧 ARREGLO DE TAGS USANDO API KEYS");
    console.log("====================================");
    console.log("📁 Archivo CSV:", CSV_FILE_PATH);
    console.log("🌐 API Backend:", API_BASE_URL);

    // Verificar que el archivo existe
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`Archivo CSV no encontrado: ${CSV_FILE_PATH}`);
    }

    // Verificar que el backend esté disponible
    try {
      await axios.get(`${API_BASE_URL}/api/accounts`);
      console.log("✅ Backend disponible");
    } catch (error) {
      throw new Error(
        `Backend no disponible en ${API_BASE_URL}. ¿Está corriendo el servidor?`
      );
    }

    // Leer archivo CSV
    console.log("📖 Leyendo archivo CSV...");
    const csvContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Encontrados ${records.length} registros en el CSV`);

    // Obtener todas las cuentas existentes
    console.log("🔍 Obteniendo todas las cuentas existentes...");
    const accountsResponse = await axios.get(`${API_BASE_URL}/api/accounts`);
    const existingAccounts = accountsResponse.data;

    console.log(
      `💾 Encontradas ${existingAccounts.length} cuentas en la base de datos`
    );

    // Filtrar registros válidos del CSV
    const validRecords = records.filter(
      (record) =>
        record["API Key"] &&
        record["Tag Twitter"] &&
        record["API Key"].trim() &&
        record["Tag Twitter"].trim()
    );

    console.log(
      `✅ Registros válidos con API Key y Tag Twitter: ${validRecords.length}`
    );

    // Hacer mapeo inteligente usando API Keys
    const updates = [];
    const notFound = [];

    for (const csvRecord of validRecords) {
      const apiKey = csvRecord["API Key"].trim();
      const twitterTag = csvRecord["Tag Twitter"].replace(/^@+/, "").trim();
      const email = csvRecord["Email"] || "email-no-disponible";

      // Buscar cuenta por API Key
      const matchingAccount = existingAccounts.find(
        (account) => account.ownApiKey === apiKey
      );

      if (matchingAccount) {
        if (matchingAccount.username !== twitterTag) {
          updates.push({
            accountId: matchingAccount._id,
            currentUsername: matchingAccount.username,
            newUsername: twitterTag,
            email: email,
            apiKey: apiKey.substring(0, 10) + "...",
          });
        } else {
          console.log(`✅ ${email}: ${twitterTag} ya está correcto`);
        }
      } else {
        notFound.push({
          email,
          twitterTag,
          apiKey: apiKey.substring(0, 10) + "...",
        });
      }
    }

    console.log(`\n🎯 RESUMEN DE MAPEO POR API KEY:`);
    console.log(`   📊 Registros válidos: ${validRecords.length}`);
    console.log(
      `   ✅ Encontradas por API Key: ${
        updates.length +
        (validRecords.length - updates.length - notFound.length)
      }`
    );
    console.log(`   🔧 Necesitan actualización: ${updates.length}`);
    console.log(`   ❌ No encontradas: ${notFound.length}`);

    if (notFound.length > 0) {
      console.log(`\n❌ CUENTAS NO ENCONTRADAS POR API KEY:`);
      notFound.forEach((item) => {
        console.log(
          `   📧 ${item.email} → ${item.twitterTag} (API: ${item.apiKey})`
        );
      });
    }

    if (updates.length === 0) {
      console.log("\n🎉 ¡Todas las cuentas ya tienen los usernames correctos!");
      return;
    }

    // Mostrar las actualizaciones que se van a hacer
    console.log(`\n📋 ACTUALIZACIONES A REALIZAR:`);
    console.log(`===============================================`);
    updates.slice(0, 15).forEach((update) => {
      console.log(`   📧 ${update.email}`);
      console.log(
        `      ${update.currentUsername} → ${update.newUsername} (API: ${update.apiKey})`
      );
    });
    if (updates.length > 15) {
      console.log(`   ... y ${updates.length - 15} más`);
    }

    // Realizar actualizaciones
    console.log("\n🚀 INICIANDO ACTUALIZACIONES PRECISAS...");
    const response = await axios.post(
      `${API_BASE_URL}/api/accounts/bulk-update-usernames-by-id`,
      { updates },
      {
        timeout: 300000, // 5 minutos timeout
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data;

    console.log("\n🎉 ARREGLO COMPLETO EXITOSO!");
    console.log("=============================");
    console.log(`📊 RESUMEN FINAL:`);
    console.log(`   • Total procesados: ${result.results.total}`);
    console.log(`   • Actualizados: ${result.results.updated}`);
    console.log(
      `   • Sin cambios: ${
        result.results.details.filter((d) => d.status === "unchanged").length
      }`
    );
    console.log(`   • Errores: ${result.results.errors}`);

    // Mostrar actualizaciones exitosas
    const successfulUpdates = result.results.details.filter(
      (d) => d.status === "updated"
    );
    if (successfulUpdates.length > 0) {
      console.log(
        `\n✅ ACTUALIZACIONES EXITOSAS (${successfulUpdates.length}):`
      );
      console.log("==========================================");
      successfulUpdates.slice(0, 10).forEach((detail) => {
        console.log(`   📧 ${detail.email}`);
        console.log(`      ${detail.oldUsername} → ${detail.newUsername}`);
      });
      if (successfulUpdates.length > 10) {
        console.log(
          `   ... y ${successfulUpdates.length - 10} más actualizaciones`
        );
      }
    }

    // Mostrar errores si los hay
    const errors = result.results.details.filter((d) => d.status === "error");
    if (errors.length > 0) {
      console.log(`\n❌ ERRORES (${errors.length}):`);
      console.log("==========================================");
      errors.forEach((error) => {
        console.log(`   📧 ${error.email} - ${error.message}`);
      });
    }

    console.log("\n🏁 ¡Arreglo de usernames completado usando API Keys!");
  } catch (error) {
    console.error("\n❌ ERROR EN EL ARREGLO:");
    console.error("==========================================");

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(
        `Error: ${error.response.data.error || "Error desconocido"}`
      );
    } else if (error.request) {
      console.error("No se pudo conectar al servidor");
      console.error("Verifica que el backend esté corriendo en:", API_BASE_URL);
    } else {
      console.error("Error:", error.message);
    }

    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixTwitterTagsByApiKey();
}

module.exports = { fixTwitterTagsByApiKey };
