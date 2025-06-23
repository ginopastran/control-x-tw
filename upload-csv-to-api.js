const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const CSV_FILE_PATH = "./frontend/CUENTAS-TWITTER-CON-CLAVES.csv";

async function uploadCSV() {
  try {
    console.log("📤 CARGANDO CUENTAS DESDE CSV");
    console.log("===============================");
    console.log("🌐 API Backend:", API_BASE_URL);
    console.log("📄 Archivo CSV:", CSV_FILE_PATH);

    // Verificar que el archivo CSV existe
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`Archivo CSV no encontrado: ${CSV_FILE_PATH}`);
    }

    console.log("✅ Archivo CSV encontrado");

    // Preparar FormData
    const form = new FormData();
    form.append("csvFile", fs.createReadStream(CSV_FILE_PATH));

    console.log("\n📤 Enviando archivo CSV al backend...");

    // Hacer la petición
    const response = await axios.post(
      `${API_BASE_URL}/api/accounts/upload-csv`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("\n🎉 RESPUESTA DEL SERVIDOR:");
    console.log("===========================");

    if (response.data.success) {
      console.log("✅ Carga exitosa!");
      console.log("📊 Resumen:");
      console.log(
        `   - Total registros: ${response.data.summary.totalRecords}`
      );
      console.log(
        `   - Procesados exitosamente: ${response.data.summary.processedSuccessfully}`
      );
      console.log(
        `   - Guardados en BD: ${response.data.summary.savedAccounts}`
      );
      console.log(
        `   - Cuentas creadas: ${response.data.summary.createdAccounts}`
      );
      console.log(
        `   - Cuentas actualizadas: ${response.data.summary.updatedAccounts}`
      );
      console.log(`   - Errores CSV: ${response.data.summary.csvErrors}`);
      console.log(`   - Errores BD: ${response.data.summary.dbErrors}`);

      if (
        response.data.savedAccounts &&
        response.data.savedAccounts.length > 0
      ) {
        console.log("\n✅ CUENTAS PROCESADAS:");
        console.log("========================");
        response.data.savedAccounts.forEach((account, index) => {
          console.log(
            `${index + 1}. @${
              account.username
            } - ${account.action.toUpperCase()} - OAuth1: ${
              account.hasOAuth1 ? "✓" : "✗"
            } OAuth2: ${account.hasOAuth2 ? "✓" : "✗"}`
          );
        });
      }

      if (response.data.errors && response.data.errors.length > 0) {
        console.log("\n⚠️  ERRORES ENCONTRADOS:");
        console.log("=========================");
        response.data.errors.forEach((error, index) => {
          console.log(
            `${index + 1}. Línea ${error.lineNumber}: ${error.error}`
          );
        });
      }
    } else {
      console.log("❌ Error en la carga");
      console.log(JSON.stringify(response.data, null, 2));
    }

    return response.data;
  } catch (error) {
    console.error("❌ ERROR EN LA CARGA:", error.message);

    if (error.response) {
      console.error("📋 Detalles de la respuesta:");
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    }

    throw error;
  }
}

// Permitir ejecutar directamente este script
if (require.main === module) {
  uploadCSV()
    .then(() => {
      console.log("\n🎉 PROCESO COMPLETADO EXITOSAMENTE!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 PROCESO FALLÓ:", error.message);
      process.exit(1);
    });
}

module.exports = { uploadCSV };
