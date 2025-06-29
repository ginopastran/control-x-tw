const cors = require("cors");

// Obtener variables de entorno
const FRONTEND_URL = process.env.FRONTEND_URL;
const NODE_ENV = process.env.NODE_ENV;

// Configurar orígenes permitidos
const getAllowedOrigins = () => {
  const origins = [];

  // En desarrollo, permitir localhost
  if (NODE_ENV === "development") {
    origins.push("http://localhost:3000");
    origins.push("http://127.0.0.1:3000");
  }

  // En producción, usar la URL del frontend
  if (FRONTEND_URL) {
    origins.push(FRONTEND_URL);
  }

  return origins;
};

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();

    // Permitir requests sin origin (como Postman, mobile apps, cron jobs, etc.)
    // Esto es importante para los servicios de keep-alive
    if (!origin) return callback(null, true);

    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin ${origin} no permitido`);
      console.log(`✅ Orígenes permitidos: ${allowedOrigins.join(", ")}`);
      callback(new Error("No permitido por la política CORS"));
    }
  },
  credentials: true, // Permitir cookies y headers de autenticación
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "X-Access-Token",
  ],
  exposedHeaders: ["X-Total-Count"],
  maxAge: 86400, // Cache preflight por 24 horas
  optionsSuccessStatus: 200, // Para navegadores legacy
};

// Middleware CORS
const corsMiddleware = cors(corsOptions);

// Función para logs de debugging
const logCorsConfig = () => {
  const allowedOrigins = getAllowedOrigins();
  console.log("🔧 Configuración CORS:");
  console.log(`   Entorno: ${NODE_ENV || "development"}`);
  console.log(`   Orígenes permitidos: ${allowedOrigins.join(", ")}`);
  console.log(`   Frontend URL: ${FRONTEND_URL || "No configurada"}`);
};

module.exports = {
  corsMiddleware,
  corsOptions,
  logCorsConfig,
  getAllowedOrigins,
};
