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

async function forceUpdateAllTwitterTags() {
  try {
    console.log("🚀 ACTUALIZACIÓN COMPLETA FORZADA DE TAGS DE TWITTER");
    console.log("================================================");
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

    // Mapear por posición (asumiendo que el CSV y las cuentas están en el mismo orden)
    const updates = [];
    let matchedCount = 0;

    for (
      let i = 0;
      i < Math.min(records.length, existingAccounts.length);
      i++
    ) {
      const csvRecord = records[i];
      const account = existingAccounts[i];

      if (csvRecord["Tag Twitter"] && csvRecord["Tag Twitter"].trim()) {
        const twitterTag = csvRecord["Tag Twitter"].replace(/^@+/, "").trim();

        if (account.username !== twitterTag) {
          updates.push({
            accountId: account._id,
            currentUsername: account.username,
            newUsername: twitterTag,
            email: csvRecord["Email"] || `cuenta-${i + 1}`,
            csvIndex: i + 1,
          });
          matchedCount++;
        } else {
          console.log(
            `✅ Cuenta ${i + 1}: ${account.username} ya está correcta`
          );
        }
      }
    }

    console.log(`\n🎯 RESUMEN DE MAPEO:`);
    console.log(`   📊 Total registros CSV: ${records.length}`);
    console.log(`   💾 Total cuentas DB: ${existingAccounts.length}`);
    console.log(`   🔧 Cuentas a actualizar: ${updates.length}`);
    console.log(`   ✅ Cuentas ya correctas: ${matchedCount - updates.length}`);

    if (updates.length === 0) {
      console.log("\n🎉 ¡Todas las cuentas ya tienen los usernames correctos!");
      return;
    }

    // Mostrar las actualizaciones que se van a hacer
    console.log(`\n📋 ACTUALIZACIONES A REALIZAR:`);
    console.log(`===============================================`);
    updates.slice(0, 10).forEach((update, index) => {
      console.log(
        `   ${update.csvIndex}. ${update.currentUsername} → ${update.newUsername}`
      );
    });
    if (updates.length > 10) {
      console.log(`   ... y ${updates.length - 10} más`);
    }

    // Realizar actualizaciones
    console.log("\n🚀 INICIANDO ACTUALIZACIONES MASIVAS...");
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

    console.log("\n🎉 ACTUALIZACIÓN COMPLETA EXITOSA!");
    console.log("=====================================");
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
      successfulUpdates.forEach((detail) => {
        console.log(`   📧 ${detail.email}`);
        console.log(`      ${detail.oldUsername} → ${detail.newUsername}`);
      });
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

    console.log("\n🏁 ¡Proceso de actualización completa terminado!");
  } catch (error) {
    console.error("\n❌ ERROR EN LA ACTUALIZACIÓN COMPLETA:");
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
  forceUpdateAllTwitterTags();
}

module.exports = { forceUpdateAllTwitterTags };
