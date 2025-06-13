const fs = require("fs");
const path = require("path");
const axios = require("axios");
const csv = require("csv-parse/sync");

// Intentar cargar dotenv, pero no fallar si no existe
try {
  require("dotenv").config({
    path: path.join(__dirname, "..", "backend", ".env"),
  });
} catch (e) {
  console.log("⚠️  No se encontró archivo .env, usando valores por defecto");
}

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const CSV_FILE_PATH = path.join(
  __dirname,
  "..",
  "frontend",
  "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
);

async function updateTwitterTags() {
  try {
    console.log("🚀 Iniciando actualización de tags de Twitter...");
    console.log("📁 Archivo CSV:", CSV_FILE_PATH);
    console.log("🌐 API Backend:", API_BASE_URL);

    // Verificar que el archivo existe
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`Archivo CSV no encontrado: ${CSV_FILE_PATH}`);
    }

    // Verificar que el backend esté disponible
    try {
      console.log("🔌 Verificando conexión con el backend...");
      await axios.get(`${API_BASE_URL}/api/keepalive`, { timeout: 5000 });
      console.log("✅ Backend disponible");
    } catch (error) {
      throw new Error(
        `No se pudo conectar al backend en ${API_BASE_URL}. ¿Está ejecutándose?`
      );
    }

    // Leer archivo CSV
    console.log("📖 Leyendo archivo CSV...");
    const csvContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ",",
    });

    console.log(`📊 Encontrados ${records.length} registros en el CSV`);

    // Preparar datos para actualización masiva
    const updates = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const email = record["Email"]?.trim();
      const twitterTag = record["Tag Twitter"]?.trim();

      if (email && twitterTag) {
        updates.push({
          email,
          twitterTag,
        });
      }
    }

    console.log(
      `🔄 Preparando actualización de ${updates.length} registros válidos...`
    );

    // Primero obtener todas las cuentas existentes para hacer un mapeo más inteligente
    console.log("🔍 Obteniendo cuentas existentes para mapeo inteligente...");
    const accountsResponse = await axios.get(`${API_BASE_URL}/api/accounts`);
    const existingAccounts = accountsResponse.data;

    console.log(
      `📋 Encontradas ${existingAccounts.length} cuentas en la base de datos`
    );

    // Hacer mapeo inteligente entre CSV y cuentas existentes
    const smartUpdates = [];
    for (const update of updates) {
      const { email, twitterTag } = update;
      const emailPrefix = email.split("@")[0];
      const cleanedTag = twitterTag.replace(/^@+/, "");

      // Buscar cuenta correspondiente con múltiples criterios
      const matchingAccount = existingAccounts.find((account) => {
        return (
          // Coincidencia exacta por username actual
          account.username === cleanedTag ||
          account.username === emailPrefix ||
          account.username === email ||
          // Coincidencia por prefijo de email
          account.username.toLowerCase().includes(emailPrefix.toLowerCase()) ||
          // Coincidencia por labels que contengan el email
          (account.labels &&
            account.labels.some(
              (label) =>
                label.toLowerCase().includes(email.toLowerCase()) ||
                label.toLowerCase().includes(emailPrefix.toLowerCase())
            ))
        );
      });

      if (matchingAccount) {
        smartUpdates.push({
          accountId: matchingAccount._id,
          email,
          twitterTag: cleanedTag,
          currentUsername: matchingAccount.username,
        });
      } else {
        console.log(
          `⚠️  No se encontró coincidencia para: ${email} → ${twitterTag}`
        );
      }
    }

    console.log(
      `🎯 Mapeo completado: ${smartUpdates.length} coincidencias de ${updates.length} registros`
    );

    // Enviar actualización masiva al backend usando IDs específicos
    console.log("📤 Enviando actualizaciones inteligentes al backend...");
    const response = await axios.post(
      `${API_BASE_URL}/api/accounts/bulk-update-usernames-by-id`,
      { updates: smartUpdates },
      {
        timeout: 120000, // 2 minutos timeout para operaciones masivas
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data;

    console.log("\n🎉 PROCESO COMPLETADO EXITOSAMENTE");
    console.log("==========================================");

    // Mostrar resumen
    console.log("📊 RESUMEN:");
    console.log(`   • Total registros procesados: ${result.results.total}`);
    console.log(`   • Cuentas actualizadas: ${result.results.updated}`);
    console.log(`   • Cuentas no encontradas: ${result.results.notFound}`);
    console.log(`   • Errores: ${result.results.errors}`);

    // Mostrar detalles de actualizaciones exitosas
    const updated = result.results.details.filter(
      (d) => d.status === "updated"
    );
    if (updated.length > 0) {
      console.log("\n✅ ACTUALIZACIONES EXITOSAS:");
      console.log("==========================================");
      updated.forEach((detail) => {
        console.log(`   📧 ${detail.email}`);
        console.log(`      ${detail.oldUsername} → ${detail.newUsername}`);
      });
    }

    // Mostrar cuentas que ya tenían el username correcto
    const unchanged = result.results.details.filter(
      (d) => d.status === "unchanged"
    );
    if (unchanged.length > 0) {
      console.log("\n ℹ️ YA ESTABAN CORRECTAS:");
      console.log("==========================================");
      unchanged.forEach((detail) => {
        console.log(`   📧 ${detail.email} → ${detail.username} (sin cambios)`);
      });
    }

    // Mostrar cuentas no encontradas
    const notFound = result.results.details.filter(
      (d) => d.status === "notFound"
    );
    if (notFound.length > 0) {
      console.log("\n❌ CUENTAS NO ENCONTRADAS:");
      console.log("==========================================");
      notFound.forEach((detail) => {
        console.log(`   📧 ${detail.email} - ${detail.message}`);
      });
    }

    // Mostrar errores
    const errors = result.results.details.filter((d) => d.status === "error");
    if (errors.length > 0) {
      console.log("\n🚨 ERRORES:");
      console.log("==========================================");
      errors.forEach((detail) => {
        console.log(`   📧 ${detail.email} - ${detail.message}`);
      });
    }

    console.log("\n🎯 Actualización completada!");
  } catch (error) {
    console.error("\n❌ ERROR EN LA ACTUALIZACIÓN:");
    console.error("==========================================");

    if (error.response) {
      // Error de respuesta del servidor
      console.error(`Status: ${error.response.status}`);
      console.error(
        `Error: ${error.response.data?.error || "Error desconocido"}`
      );

      if (error.response.data?.results) {
        console.error("Detalles del error:", error.response.data.results);
      }
    } else if (error.request) {
      console.error("No se pudo conectar al servidor");
      console.error("Verifica que el backend esté corriendo en:", API_BASE_URL);
      console.error(
        "Puedes iniciarlo con: npm start desde la carpeta backend/"
      );
    } else {
      console.error("Error:", error.message);
    }

    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  updateTwitterTags();
}

module.exports = { updateTwitterTags };
