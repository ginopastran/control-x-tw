const fs = require("fs");
const csv = require("csv-parse/sync");
const mongoose = require("mongoose");
const path = require("path");

// Importar el modelo de XAccount desde el backend
const XAccount = require("../backend/models/XAccount");

// Configuración de MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/control-x";

// Función para conectar a MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    throw error;
  }
}

// Función para leer y parsear el CSV
function readCSV(filePath) {
  try {
    const csvContent = fs.readFileSync(filePath, "utf-8");

    // Parsear CSV con las opciones correctas
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ",",
      quote: '"',
      escape: '"',
    });

    console.log(
      `📊 CSV leído correctamente. ${records.length} registros encontrados.`
    );
    return records;
  } catch (error) {
    console.error("❌ Error leyendo el CSV:", error.message);
    throw error;
  }
}

// Función para limpiar y validar datos
function cleanAccountData(record) {
  // Extraer username de la columna "Tag Twitter"
  const tagTwitter = record["Tag Twitter"] || "";
  const username = tagTwitter.replace("@", "").trim();

  if (!username) {
    console.warn("⚠️ Registro sin username válido:", record["Email"]);
    return null;
  }

  // Verificar si la cuenta de X está creada
  const cuentaXCreada = record["Cuenta de X creada"] === "TRUE";
  const cuentaDesarrollador = record["Cuenta de desarrollador"] === "TRUE";

  if (!cuentaXCreada) {
    console.warn(`⚠️ Cuenta @${username} - Cuenta de X no creada, saltando...`);
    return null;
  }

  // Extraer credenciales OAuth 1.0a
  const apiKey = record["API Key"] ? record["API Key"].trim() : "";
  const apiSecret = record["API Key Secret"]
    ? record["API Key Secret"].trim()
    : "";
  const bearerToken = record["Bearer Token"]
    ? record["Bearer Token"].trim()
    : "";
  const accessToken = record["Access Token"]
    ? record["Access Token"].trim()
    : "";
  const accessTokenSecret = record["Access Token Secret"]
    ? record["Access Token Secret"].trim()
    : "";

  // Extraer credenciales OAuth 2.0
  const clientId = record["Client ID "] ? record["Client ID "].trim() : "";
  const clientSecret = record["client secrect"]
    ? record["client secrect"].trim()
    : "";

  // Determinar si tiene credenciales OAuth 1.0a
  const hasOAuth1 = !!(apiKey && apiSecret);

  // Determinar si tiene credenciales OAuth 2.0
  const hasOAuth2 = !!(clientId && clientSecret);

  // Si no tiene credenciales de desarrollador pero dice que sí, mostrar advertencia
  if (cuentaDesarrollador && !hasOAuth1 && !hasOAuth2) {
    console.warn(
      `⚠️ Cuenta @${username} - Marcada como desarrollador pero sin credenciales`
    );
  }

  // Extraer otros datos
  const email = record["Email"] ? record["Email"].trim() : "";
  const edad = record["Edad"] ? record["Edad"].trim() : "";
  const genero = record["Género"] ? record["Género"].trim() : "";
  const claseSocial = record["Clase Social"]
    ? record["Clase Social"].trim()
    : "";
  const ideologia = record["Ideología"] ? record["Ideología"].trim() : "";
  const appName = record["name-app"] ? record["name-app"].trim() : "";
  const situacion = record["Situación"] ? record["Situación"].trim() : "";
  const profesion = record["Profesión"] ? record["Profesión"].trim() : "";

  // Crear etiquetas basadas en los datos del CSV
  const labels = [];
  if (edad) labels.push(`edad-${edad.toLowerCase().replace(/\s+/g, "-")}`);
  if (genero) labels.push(`genero-${genero.toLowerCase()}`);
  if (claseSocial)
    labels.push(`clase-${claseSocial.toLowerCase().replace(/\s+/g, "-")}`);
  if (ideologia)
    labels.push(`ideologia-${ideologia.toLowerCase().replace(/\s+/g, "-")}`);
  if (situacion)
    labels.push(`situacion-${situacion.toLowerCase().replace(/\s+/g, "-")}`);
  if (profesion)
    labels.push(`profesion-${profesion.toLowerCase().replace(/\s+/g, "-")}`);
  if (cuentaDesarrollador) labels.push("cuenta-desarrollador");
  if (hasOAuth1) labels.push("oauth1");
  if (hasOAuth2) labels.push("oauth2");

  return {
    username,
    email,
    appName,
    hasCredentials: hasOAuth1 || hasOAuth2,
    hasOAuth1,
    hasOAuth2,
    labels,
    credentials: {
      // OAuth 1.0a
      ownApiKey: apiKey || undefined,
      ownApiSecret: apiSecret || undefined,
      ownBearerToken: bearerToken || undefined,
      ownAccessToken: accessToken || undefined,
      ownAccessTokenSecret: accessTokenSecret || undefined,
      // OAuth 2.0
      ownClientId: clientId || undefined,
      ownClientSecret: clientSecret || undefined,
    },
    metadata: {
      edad,
      genero,
      claseSocial,
      ideologia,
      situacion,
      profesion,
      email,
      desarrollador: cuentaDesarrollador,
    },
  };
}

// Función para crear una cuenta directamente en MongoDB
async function createAccountInDB(accountData) {
  try {
    console.log(`📝 Creando cuenta para @${accountData.username}...`);

    // Verificar si ya existe una cuenta con el mismo username
    const existingAccount = await XAccount.findOne({
      username: accountData.username,
    });
    if (existingAccount) {
      console.warn(
        `⚠️ La cuenta @${accountData.username} ya existe, saltando...`
      );
      return {
        success: false,
        username: accountData.username,
        error: "La cuenta ya existe",
      };
    }

    // Crear objeto de cuenta basado en el schema de XAccount
    const accountDocument = {
      username: accountData.username,
      userId: `csv_${accountData.username}_${Date.now()}`,
      labels: accountData.labels,

      // Configuración de credenciales
      useOwnCredentials: accountData.hasCredentials,
      preferOAuth2: accountData.hasOAuth2, // Preferir OAuth 2.0 si está disponible
      credentialsVerified: accountData.hasCredentials, // Marcar como verificadas si tiene credenciales

      // Credenciales OAuth 1.0a
      ownApiKey: accountData.credentials.ownApiKey,
      ownApiSecret: accountData.credentials.ownApiSecret,
      ownBearerToken: accountData.credentials.ownBearerToken,
      ownAccessToken: accountData.credentials.ownAccessToken,
      ownAccessTokenSecret: accountData.credentials.ownAccessTokenSecret,

      // Credenciales OAuth 2.0
      ownClientId: accountData.credentials.ownClientId,
      ownClientSecret: accountData.credentials.ownClientSecret,

      // Estado inicial
      isActive: true,
      status: "active",

      // Límites diarios por defecto
      dailyLimits: {
        tweets: {
          used: 0,
          limit: 300,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        follows: {
          used: 0,
          limit: 400,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        likes: {
          used: 0,
          limit: 1000,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        retweets: {
          used: 0,
          limit: 300,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },

      // Métricas iniciales
      metrics: {
        tweets: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        follows: 0,
        unfollows: 0,
        totalActions: 0,
      },
    };

    // Crear la cuenta en MongoDB
    const newAccount = await XAccount.create(accountDocument);

    const authType = accountData.hasOAuth2
      ? "OAuth 2.0"
      : accountData.hasOAuth1
      ? "OAuth 1.0a"
      : "Sin credenciales";
    console.log(
      `✅ Cuenta @${accountData.username} creada con ID: ${newAccount._id} (${authType})`
    );

    return {
      success: true,
      username: accountData.username,
      accountId: newAccount._id,
      hasCredentials: accountData.hasCredentials,
      authType: authType,
    };
  } catch (error) {
    console.error(
      `❌ Error creando cuenta @${accountData.username}:`,
      error.message
    );
    return {
      success: false,
      username: accountData.username,
      error: error.message,
    };
  }
}

// Función principal
async function uploadAccountsFromCSV() {
  console.log("🚀 Iniciando carga de cuentas desde CSV...\n");

  try {
    // Conectar a MongoDB
    await connectToMongoDB();

    // Buscar el archivo CSV
    let csvPath = path.join(
      __dirname,
      "..",
      "frontend",
      "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
    );

    if (!fs.existsSync(csvPath)) {
      console.error("❌ Archivo CSV no encontrado en:", csvPath);
      console.log("📁 Buscando en rutas alternativas...");

      // Intentar otras rutas posibles
      const alternativePaths = [
        path.join(
          __dirname,
          "..",
          "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
        ),
        path.join(
          process.cwd(),
          "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
        ),
        path.join(
          process.cwd(),
          "frontend",
          "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
        ),
      ];

      let foundPath = null;
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          break;
        }
      }

      if (!foundPath) {
        console.error(
          "❌ No se pudo encontrar el archivo CSV en ninguna ubicación."
        );
        console.log("📋 Rutas verificadas:");
        [csvPath, ...alternativePaths].forEach((p) => console.log(`   - ${p}`));
        return;
      }

      csvPath = foundPath;
      console.log(`✅ Archivo encontrado en: ${csvPath}`);
    }

    // Leer y parsear CSV
    const records = readCSV(csvPath);

    // Procesar registros
    console.log("\n📋 Procesando registros...");
    const validAccounts = [];
    const skippedAccounts = [];

    for (const record of records) {
      const accountData = cleanAccountData(record);
      if (accountData) {
        validAccounts.push(accountData);
      } else {
        skippedAccounts.push(record["Email"] || "Email no disponible");
      }
    }

    console.log(`\n📊 Resumen del procesamiento:`);
    console.log(`   ✅ Cuentas válidas: ${validAccounts.length}`);
    console.log(`   ⚠️ Cuentas saltadas: ${skippedAccounts.length}`);

    if (skippedAccounts.length > 0) {
      console.log(`\n⚠️ Cuentas saltadas (sin cuenta de X o sin username):`);
      skippedAccounts
        .slice(0, 10)
        .forEach((email) => console.log(`   - ${email}`));
      if (skippedAccounts.length > 10) {
        console.log(`   ... y ${skippedAccounts.length - 10} más`);
      }
    }

    // Mostrar estadísticas de credenciales
    const withOAuth1 = validAccounts.filter((acc) => acc.hasOAuth1).length;
    const withOAuth2 = validAccounts.filter((acc) => acc.hasOAuth2).length;
    const withoutCredentials = validAccounts.filter(
      (acc) => !acc.hasCredentials
    ).length;

    console.log(`\n🔐 Estadísticas de credenciales:`);
    console.log(`   🔑 Con OAuth 1.0a: ${withOAuth1}`);
    console.log(`   🆕 Con OAuth 2.0: ${withOAuth2}`);
    console.log(`   ❌ Sin credenciales: ${withoutCredentials}`);

    // Confirmar antes de proceder
    console.log(`\n🔄 Se procesarán ${validAccounts.length} cuentas.`);
    console.log("Presiona Ctrl+C para cancelar o Enter para continuar...");

    // Esperar confirmación del usuario en modo interactivo
    if (process.stdin.isTTY) {
      await new Promise((resolve) => {
        process.stdin.once("data", () => resolve());
      });
    } else {
      console.log("Modo no interactivo - continuando automáticamente...");
    }

    // Crear cuentas
    console.log("\n🚀 Creando cuentas en MongoDB...\n");
    const results = {
      success: [],
      errors: [],
      duplicates: [],
    };

    for (let i = 0; i < validAccounts.length; i++) {
      const accountData = validAccounts[i];
      console.log(
        `[${i + 1}/${validAccounts.length}] Procesando @${
          accountData.username
        }...`
      );

      const result = await createAccountInDB(accountData);

      if (result.success) {
        results.success.push(result);
      } else if (result.error === "La cuenta ya existe") {
        results.duplicates.push(result);
      } else {
        results.errors.push(result);
      }

      // Pequeña pausa entre creaciones para evitar sobrecarga
      if (i < validAccounts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Mostrar resumen final
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN FINAL");
    console.log("=".repeat(60));
    console.log(`✅ Cuentas creadas exitosamente: ${results.success.length}`);
    console.log(`🔄 Cuentas ya existentes: ${results.duplicates.length}`);
    console.log(`❌ Cuentas con errores: ${results.errors.length}`);

    if (results.success.length > 0) {
      console.log("\n✅ Cuentas creadas exitosamente:");
      results.success.forEach((result) => {
        console.log(`   - @${result.username} (${result.authType})`);
      });
    }

    if (results.duplicates.length > 0) {
      console.log("\n🔄 Cuentas ya existentes:");
      results.duplicates.forEach((result) => {
        console.log(`   - @${result.username}`);
      });
    }

    if (results.errors.length > 0) {
      console.log("\n❌ Cuentas con errores:");
      results.errors.forEach((result) => {
        console.log(`   - @${result.username}: ${result.error}`);
      });
    }

    console.log("\n🎉 Proceso completado!");

    // Cerrar conexión a MongoDB
    await mongoose.disconnect();
    console.log("🔌 Desconectado de MongoDB");
  } catch (error) {
    console.error("❌ Error general:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  uploadAccountsFromCSV().catch(console.error);
}

module.exports = { uploadAccountsFromCSV, readCSV, cleanAccountData };
