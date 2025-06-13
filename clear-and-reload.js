const axios = require("axios");

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

async function clearAndReload() {
  try {
    console.log("🧹 LIMPIEZA Y RECARGA COMPLETA DE CUENTAS");
    console.log("==========================================");
    console.log("🌐 API Backend:", API_BASE_URL);

    // Verificar que el backend esté disponible
    try {
      await axios.get(`${API_BASE_URL}/api/accounts`);
      console.log("✅ Backend disponible");
    } catch (error) {
      throw new Error(`Backend no disponible en ${API_BASE_URL}`);
    }

    // Paso 1: Limpiar todas las cuentas existentes
    console.log("\n🗑️  PASO 1: Limpiando cuentas existentes...");
    try {
      const deleteResponse = await axios.delete(
        `${API_BASE_URL}/api/accounts/clear-all`
      );
      console.log(`✅ ${deleteResponse.data.message}`);
    } catch (error) {
      console.log(
        "⚠️  Error al limpiar o ya estaba vacía:",
        error.response?.data?.error || error.message
      );
    }

    // Paso 2: Cargar cuentas desde CSV
    console.log("\n📤 PASO 2: Cargando cuentas desde CSV...");

    // Importar y ejecutar la función de upload
    const { uploadCSV } = require("./upload-csv-to-api");
    await uploadCSV();

    console.log("\n🎉 PROCESO COMPLETO EXITOSO!");
    console.log("============================");
    console.log("✅ Base de datos limpiada");
    console.log("✅ Cuentas cargadas correctamente desde CSV");
    console.log("✅ Tags de Twitter actualizados automáticamente");
  } catch (error) {
    console.error("\n❌ ERROR EN EL PROCESO:");
    console.error("=======================");

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
  clearAndReload();
}

module.exports = { clearAndReload };
