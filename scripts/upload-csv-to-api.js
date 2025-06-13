const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const CSV_FILE_PATH = path.join(
  __dirname,
  "..",
  "frontend",
  "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
);

async function uploadCSV() {
  try {
    console.log("🚀 Iniciando carga de cuentas desde CSV...");
    console.log("📁 Archivo CSV:", CSV_FILE_PATH);

    // Verificar que el archivo existe
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`Archivo CSV no encontrado: ${CSV_FILE_PATH}`);
    }

    // Crear FormData
    const form = new FormData();
    form.append("csvFile", fs.createReadStream(CSV_FILE_PATH));

    console.log("📤 Enviando archivo al backend...");

    // Subir archivo
    const response = await axios.post(
      `${API_BASE_URL}/api/accounts/upload-csv`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000, // 1 minuto timeout
      }
    );

    const result = response.data;

    console.log("\n✅ CARGA COMPLETADA EXITOSAMENTE");
    console.log("==========================================");

    // Mostrar resumen
    console.log("📊 RESUMEN:");
    console.log(`   • Total registros en CSV: ${result.summary.totalRecords}`);
    console.log(
      `   • Procesados exitosamente: ${result.summary.processedSuccessfully}`
    );
    console.log(`   • Cuentas creadas: ${result.summary.createdAccounts}`);
    console.log(`   • Cuentas actualizadas: ${result.summary.updatedAccounts}`);
    console.log(`   • Errores CSV: ${result.summary.csvErrors}`);
    console.log(`   • Errores BD: ${result.summary.dbErrors}`);

    // Mostrar logs detallados
    console.log("\n📋 LOGS DETALLADOS:");
    console.log("==========================================");
    result.logs.forEach((log) => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const icon = getLogIcon(log.level);
      console.log(`${timestamp} ${icon} ${log.message}`);
    });

    // Mostrar cuentas cargadas
    if (result.savedAccounts.length > 0) {
      console.log("\n✅ CUENTAS CARGADAS:");
      console.log("==========================================");
      result.savedAccounts.forEach((acc) => {
        const oauthInfo = [];
        if (acc.hasOAuth1) oauthInfo.push("OAuth1.0a");
        if (acc.hasOAuth2) oauthInfo.push("OAuth2.0");

        console.log(
          `   ${acc.action === "created" ? "🆕" : "🔄"} @${
            acc.username
          } - ${oauthInfo.join(", ")}`
        );
        if (acc.labels.length > 0) {
          console.log(
            `      Etiquetas: ${acc.labels.slice(0, 3).join(", ")}${
              acc.labels.length > 3 ? "..." : ""
            }`
          );
        }
      });
    }

    // Mostrar errores si los hay
    if (result.errors.length > 0) {
      console.log("\n❌ ERRORES:");
      console.log("==========================================");
      result.errors.forEach((error) => {
        console.log(
          `   Línea ${error.lineNumber}: @${error.username} - ${error.error}`
        );
      });
    }

    console.log("\n🎉 Proceso completado!");
  } catch (error) {
    console.error("\n❌ ERROR EN LA CARGA:");
    console.error("==========================================");

    if (error.response) {
      // Error de respuesta del servidor
      console.error(`Status: ${error.response.status}`);
      console.error(
        `Error: ${error.response.data.error || "Error desconocido"}`
      );

      if (error.response.data.logs) {
        console.error("\nLogs del servidor:");
        error.response.data.logs.forEach((log) => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const icon = getLogIcon(log.level);
          console.error(`${timestamp} ${icon} ${log.message}`);
        });
      }
    } else if (error.request) {
      console.error("No se pudo conectar al servidor");
      console.error("Verifica que el backend esté corriendo en:", API_BASE_URL);
    } else {
      console.error("Error:", error.message);
    }

    process.exit(1);
  }
}

function getLogIcon(level) {
  switch (level) {
    case "SUCCESS":
      return "✅";
    case "ERROR":
      return "❌";
    case "INFO":
      return "ℹ️";
    default:
      return "📝";
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  uploadCSV();
}

module.exports = { uploadCSV };
