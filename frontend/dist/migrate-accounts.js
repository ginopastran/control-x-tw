"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateAccounts = migrateAccounts;
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const papaparse_1 = __importDefault(require("papaparse"));
const prisma = new client_1.PrismaClient();
async function parseCSV() {
    const csvPath = path.join(__dirname, "../CUENTAS-TWITTER.csv");
    const csvContent = fs.readFileSync(csvPath, "utf8");
    const result = papaparse_1.default.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
    });
    if (result.errors.length > 0) {
        console.warn("⚠️  Errores al parsear CSV:", result.errors);
    }
    // Filtrar filas válidas
    const validRows = result.data.filter((row) => row["Tag Twitter"] &&
        !row["Tag Twitter"].includes("callback") &&
        row["Tag Twitter"].trim() !== "" &&
        row["Tag Twitter"] !== "Tag Twitter" // Evitar header duplicado
    );
    console.log(`📊 Se encontraron ${validRows.length} cuentas válidas en el CSV`);
    return validRows;
}
function cleanTwitterUsername(tagTwitter) {
    if (!tagTwitter)
        return "";
    // Remover @ y espacios en blanco, y saltos de línea
    return tagTwitter.replace("@", "").trim().replace(/\n/g, "");
}
function cleanString(str) {
    if (!str)
        return null;
    const cleaned = str.trim().replace(/\n/g, " ");
    return cleaned === "" ? null : cleaned;
}
function parseLabels(row) {
    const labels = [];
    // Agregar etiquetas basadas en los datos
    if (row["Género"])
        labels.push(`genero:${cleanString(row["Género"])?.toLowerCase()}`);
    if (row["Edad"])
        labels.push(`edad:${cleanString(row["Edad"])}`);
    if (row["Clase Social"])
        labels.push(`clase:${cleanString(row["Clase Social"])
            ?.toLowerCase()
            .replace(" ", "-")}`);
    if (row["Ideología"])
        labels.push(`ideologia:${cleanString(row["Ideología"])
            ?.toLowerCase()
            .replace(" ", "-")}`);
    if (row["Profesión"])
        labels.push(`profesion:${cleanString(row["Profesión"])?.toLowerCase()}`);
    if (row["RESTRINGIDA"] === "TRUE")
        labels.push("restringida");
    return labels.filter((label) => label && !label.includes("null"));
}
async function migrateAccounts() {
    try {
        console.log("🚀 Iniciando migración de cuentas...");
        // Leer y parsear CSV
        const csvData = await parseCSV();
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const errors = [];
        for (const row of csvData) {
            try {
                const username = cleanTwitterUsername(row["Tag Twitter"]);
                if (!username) {
                    console.log(`⚠️  Saltando fila sin username válido`);
                    skippedCount++;
                    continue;
                }
                // Verificar si la cuenta ya existe
                const existingAccount = await prisma.xAccount.findUnique({
                    where: { username },
                });
                if (existingAccount) {
                    console.log(`⚠️  Cuenta @${username} ya existe, saltando...`);
                    skippedCount++;
                    continue;
                }
                // Preparar datos de la cuenta
                const accountData = {
                    username,
                    labels: parseLabels(row),
                    // Credenciales OAuth 1.0a
                    ownApiKey: cleanString(row["API Key"]),
                    ownApiSecret: cleanString(row["API Key Secret"]),
                    ownBearerToken: cleanString(row["Bearer Token"]),
                    ownAccessToken: cleanString(row["Access Token"]),
                    ownAccessTokenSecret: cleanString(row["Access Token Secret"]),
                    // Credenciales OAuth 2.0
                    ownClientId: cleanString(row["Client ID "]),
                    ownClientSecret: cleanString(row["client secrect"]),
                    // Configuración
                    useOwnCredentials: !!cleanString(row["API Key"]),
                    preferOAuth2: !!cleanString(row["Client ID "]),
                    credentialsVerified: false,
                    isActive: row["RESTRINGIDA"] !== "TRUE",
                    // Información del perfil
                    profileInfo: {
                        email: cleanString(row["Email"]),
                        bio: cleanString(row["Bio Tw"]),
                        age: cleanString(row["Edad"]),
                        gender: cleanString(row["Género"]),
                        socialClass: cleanString(row["Clase Social"]),
                        situation: cleanString(row["Situación"]),
                        profession: cleanString(row["Profesión"]),
                        work: cleanString(row["Trabajo"]),
                        phone: cleanString(row["Número de teléfono"]),
                        ideology: cleanString(row["Ideología"]),
                        photo: cleanString(row["Foto"]),
                        googleLogin: row["Google Login"] === "TRUE",
                        password: cleanString(row["Contraseña"]),
                    },
                    // Información de la app
                    userAppName: cleanString(row["name-app"]),
                    // Límites diarios por defecto
                    dailyLimits: {
                        tweets: 50,
                        likes: 1000,
                        retweets: 300,
                        follows: 400,
                        unfollows: 400,
                        replies: 300,
                    },
                    // Métricas iniciales
                    metrics: {
                        totalTweets: 0,
                        totalLikes: 0,
                        totalRetweets: 0,
                        totalFollows: 0,
                        totalUnfollows: 0,
                        totalReplies: 0,
                        lastReset: new Date().toISOString(),
                    },
                };
                // Crear la cuenta
                await prisma.xAccount.create({
                    data: accountData,
                });
                console.log(`✅ Cuenta @${username} migrada exitosamente`);
                successCount++;
            }
            catch (error) {
                const username = cleanTwitterUsername(row["Tag Twitter"] || "unknown");
                const errorMsg = `Error en cuenta @${username}: ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
                errorCount++;
            }
        }
        // Resumen final
        console.log("\n📊 RESUMEN DE MIGRACIÓN:");
        console.log(`✅ Cuentas migradas exitosamente: ${successCount}`);
        console.log(`⚠️  Cuentas saltadas (duplicadas/inválidas): ${skippedCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        if (errors.length > 0) {
            console.log("\n🚨 ERRORES DETALLADOS:");
            errors.forEach((error) => console.log(`   - ${error}`));
        }
        // Mostrar estadísticas finales
        const totalAccounts = await prisma.xAccount.count();
        console.log(`\n📈 Total de cuentas en la base de datos: ${totalAccounts}`);
        // Mostrar algunas estadísticas adicionales
        const accountsByGender = await prisma.xAccount.groupBy({
            by: ["labels"],
            _count: true,
        });
        console.log("\n📊 Estadísticas de cuentas cargadas:");
        console.log(`   - Con credenciales propias: ${await prisma.xAccount.count({
            where: { useOwnCredentials: true },
        })}`);
        console.log(`   - Activas: ${await prisma.xAccount.count({
            where: { isActive: true },
        })}`);
        console.log(`   - Con OAuth 2.0: ${await prisma.xAccount.count({
            where: { preferOAuth2: true },
        })}`);
    }
    catch (error) {
        console.error("💥 Error fatal en la migración:", error);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Ejecutar migración
if (require.main === module) {
    migrateAccounts()
        .then(() => {
        console.log("🎉 Migración completada");
        process.exit(0);
    })
        .catch((error) => {
        console.error("💥 Error en migración:", error);
        process.exit(1);
    });
}
