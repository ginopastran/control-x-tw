import mongoose from 'mongoose';
import { ServerApiVersion } from 'mongodb';

// Variable global para rastrear la conexión
declare global {
  var mongoConnection: {
    conn: null | typeof mongoose;
    promise: null | Promise<typeof mongoose>;
  };
}

// Inicializar la variable global si es necesario
if (!global.mongoConnection) {
  global.mongoConnection = {
    conn: null,
    promise: null
  };
}

/**
 * Función para conectar a la base de datos MongoDB
 * Con manejo de errores mejorado y opciones de reconexión
 */
export async function connectDB() {
  try {
    // Si ya estamos conectados, devolver la conexión existente
    if (global.mongoConnection.conn) {
      console.log("Utilizando conexión MongoDB existente");
      return global.mongoConnection.conn;
    }

    // Si ya hay una promesa de conexión en proceso, esperar ese resultado
    if (!global.mongoConnection.promise) {
      // Validar la URI de MongoDB
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/controlxapp';

      if (!MONGODB_URI) {
        throw new Error('Por favor, define la variable de entorno MONGODB_URI');
      }
      
      // Opciones mejoradas para la conexión
      const opts: mongoose.ConnectOptions = {
        bufferCommands: false,
        connectTimeoutMS: 20000,  // Tiempo de espera aumentado
        socketTimeoutMS: 45000,   // Tiempo de espera del socket aumentado
        maxPoolSize: 10,          // Conexiones máximas
        serverSelectionTimeoutMS: 30000, // Tiempo de espera de selección de servidor aumentado
        serverApi: ServerApiVersion.v1,  // Usar la versión 1 de la API del servidor
      };

      console.log('Conectando a MongoDB...');
      
      // Crear una nueva promesa de conexión
      global.mongoConnection.promise = mongoose
        .connect(MONGODB_URI, opts)
        .then((mongoose) => {
          console.log('MongoDB conectado exitosamente');
          return mongoose;
        })
        .catch((error) => {
          console.error('Error al conectar a MongoDB:', error);
          
          // Verificar si el error es de IP no permitida
          if (error.message && error.message.includes('IP address is not allowed')) {
            console.error('ERROR: Tu IP no está en la lista blanca de MongoDB Atlas.');
            console.error('Por favor, añade tu IP actual a la lista blanca en: https://cloud.mongodb.com/');
            
            // Mensaje de ayuda para usuarios
            console.error('\nPasos para solucionar:');
            console.error('1. Accede a tu cuenta en MongoDB Atlas');
            console.error('2. Ve a Network Access en el menú de seguridad');
            console.error('3. Haz clic en "Add IP Address"');
            console.error('4. Añade tu IP actual o 0.0.0.0/0 para permitir todas las IPs (solo para desarrollo)');
          }
          
          throw error;
        });
    } else {
      console.log("Esperando conexión MongoDB existente...");
    }

    // Esperar a que se resuelva la promesa
    try {
      global.mongoConnection.conn = await global.mongoConnection.promise;
    } catch (e) {
      // Reset de la promesa para permitir reintentar
      global.mongoConnection.promise = null;
      throw e;
    }

    return global.mongoConnection.conn;
  } catch (error) {
    // Manejo global de errores
    console.error('Error crítico en la conexión a MongoDB:', error);
    
    // En desarrollo, muestra un mensaje más detallado
    if (process.env.NODE_ENV !== 'production') {
      console.error('Detalles técnicos:', error);
      console.error('URI de conexión:', process.env.MONGODB_URI ? '[DEFINIDA]' : '[NO DEFINIDA]');
    }
    
    throw error;
  }
} 