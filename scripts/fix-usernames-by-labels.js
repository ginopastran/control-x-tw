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

async function fixUsernamesByLabels() {
  try {
    console.log("🛠️  ARREGLO CORRECTO DE USERNAMES USANDO LABELS");
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
      throw new Error(`Backend no disponible en ${API_BASE_URL}`);
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

    // Crear mapeo CSV por email
    const csvByEmail = {};
    records.forEach((record) => {
      if (record["Email"] && record["Tag Twitter"]) {
        const email = record["Email"].trim().toLowerCase();
        const twitterTag = record["Tag Twitter"].replace(/^@+/, "").trim();
        csvByEmail[email] = twitterTag;
      }
    });

    console.log(
      `📧 Mapeo CSV creado para ${Object.keys(csvByEmail).length} emails`
    );

    // Buscar coincidencias usando los labels de las cuentas
    const updates = [];
    const matches = [];
    const notFound = [];

    for (const account of existingAccounts) {
      let foundMatch = false;
      let matchedEmail = null;
      let correctUsername = null;

      // Buscar en los labels de la cuenta
      if (account.labels && Array.isArray(account.labels)) {
        for (const label of account.labels) {
          // Buscar emails en los labels
          const emailMatch = label.match(
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
          );
          if (emailMatch) {
            const emailFromLabel = emailMatch[1].toLowerCase();
            if (csvByEmail[emailFromLabel]) {
              foundMatch = true;
              matchedEmail = emailFromLabel;
              correctUsername = csvByEmail[emailFromLabel];
              break;
            }
          }
        }
      }

      if (foundMatch) {
        matches.push({
          accountId: account._id,
          currentUsername: account.username,
          correctUsername: correctUsername,
          email: matchedEmail,
          labels: account.labels?.slice(0, 2).join(", ") || "sin labels",
        });

        // Solo agregar a updates si necesita cambio
        if (account.username !== correctUsername) {
          updates.push({
            accountId: account._id,
            currentUsername: account.username,
            newUsername: correctUsername,
            email: matchedEmail,
          });
        }
      } else {
        notFound.push({
          accountId: account._id,
          currentUsername: account.username,
          labels: account.labels?.slice(0, 2).join(", ") || "sin labels",
        });
      }
    }

    console.log(`\n🎯 RESUMEN DE MAPEO POR LABELS:`);
    console.log(`   📊 Total cuentas: ${existingAccounts.length}`);
    console.log(`   ✅ Coincidencias encontradas: ${matches.length}`);
    console.log(`   🔧 Necesitan actualización: ${updates.length}`);
    console.log(`   ❌ Sin coincidencia: ${notFound.length}`);

    // Mostrar algunas coincidencias encontradas
    if (matches.length > 0) {
      console.log(`\n✅ COINCIDENCIAS ENCONTRADAS (primeras 10):`);
      console.log("=".repeat(50));
      matches.slice(0, 10).forEach((match, index) => {
        const status =
          match.currentUsername === match.correctUsername
            ? "✅ CORRECTO"
            : "🔧 NECESITA CAMBIO";
        console.log(`${index + 1}. ${match.email}`);
        console.log(
          `   Actual: ${match.currentUsername} → Correcto: ${match.correctUsername} ${status}`
        );
        console.log(`   Labels: ${match.labels}`);
        console.log("");
      });
    }

    // Mostrar cuentas sin coincidencia
    if (notFound.length > 0) {
      console.log(`\n❌ CUENTAS SIN COINCIDENCIA (primeras 5):`);
      console.log("=".repeat(50));
      notFound.slice(0, 5).forEach((item, index) => {
        console.log(`${index + 1}. ${item.currentUsername}`);
        console.log(`   Labels: ${item.labels}`);
        console.log("");
      });
    }

    if (updates.length === 0) {
      console.log("\n🎉 ¡Todos los usernames ya están correctos!");
      return;
    }

    // Mostrar las actualizaciones que se van a hacer
    console.log(`\n📋 ACTUALIZACIONES A REALIZAR (${updates.length}):`);
    console.log("=".repeat(50));
    updates.slice(0, 15).forEach((update, index) => {
      console.log(`${index + 1}. ${update.email}`);
      console.log(`   ${update.currentUsername} → ${update.newUsername}`);
    });
    if (updates.length > 15) {
      console.log(`   ... y ${updates.length - 15} más actualizaciones`);
    }

    // Realizar actualizaciones
    console.log("\n🚀 INICIANDO CORRECCIÓN MASIVA...");
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

    console.log("\n🎉 CORRECCIÓN COMPLETA EXITOSA!");
    console.log("===============================");
    console.log(`📊 RESUMEN FINAL:`);
    console.log(`   • Total procesados: ${result.results.total}`);
    console.log(`   • Corregidos: ${result.results.updated}`);
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
      console.log(`\n✅ CORRECCIONES EXITOSAS (${successfulUpdates.length}):`);
      console.log("==========================================");
      successfulUpdates.slice(0, 15).forEach((detail) => {
        console.log(`   📧 ${detail.email}`);
        console.log(
          `      ❌ ${detail.oldUsername} → ✅ ${detail.newUsername}`
        );
      });
      if (successfulUpdates.length > 15) {
        console.log(
          `   ... y ${successfulUpdates.length - 15} más correcciones`
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

    console.log(
      "\n🏁 ¡Usernames corregidos exitosamente usando mapeo por labels!"
    );
  } catch (error) {
    console.error("\n❌ ERROR EN LA CORRECCIÓN:");
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
  fixUsernamesByLabels();
}

module.exports = { fixUsernamesByLabels };
