# Configuración de CORS y Variables de Entorno

## 📋 Resumen de Cambios

He actualizado tu aplicación para usar variables de entorno en lugar de URLs hardcodeadas, lo que te permitirá desplegar fácilmente en producción.

## 🔧 Cambios Realizados

### Frontend (`frontend/`)

1. **Archivo de configuración API** (`src/config/api.ts`):

   - Centraliza todas las URLs del backend
   - Usa `NEXT_PUBLIC_API_URL` para configurar la URL base
   - Fallback a `http://localhost:3001` en desarrollo

2. **Archivos actualizados**:

   - `src/app/schedule/page.tsx` - Usa la nueva configuración
   - `src/app/dashboard/page.tsx` - Usa la nueva configuración
   - `src/app/tweets/page.tsx` - Usa la nueva configuración

3. **Endpoint Keep-Alive** (`/api/keepalive`):
   - Endpoint para mantener activo el backend
   - Evita que el servidor se duerma en Render
   - Respuesta ultra-rápida con información del servidor

### Backend (`backend/`)

1. **Configuración CORS** (`src/config/cors.js`):

   - Configuración dinámica basada en entorno
   - Permite `localhost:3000` en desarrollo
   - Usa `FRONTEND_URL` en producción
   - Logs informativos para debugging

2. **Archivo principal actualizado** (`index.js`):
   - Importa y usa la nueva configuración CORS
   - Muestra logs de configuración al iniciar
   - **Endpoint Keep-Alive** (`GET /api/keepalive`):
     - Respuesta JSON con estado del servidor
     - Información de uptime y timestamp
     - Diseñado para cron jobs externos

## 🚀 Configuración para Desarrollo

### Frontend

Crea un archivo `.env.local` en `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend

Tu archivo `.env` en `backend/` debe incluir:

```env
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
# ... otras variables existentes
```

## 🌐 Configuración para Producción

### Frontend

En tu plataforma de hosting (Vercel, Netlify, etc.):

```env
NEXT_PUBLIC_API_URL=https://tu-backend-en-produccion.com
```

### Backend

En tu servidor de producción:

```env
NODE_ENV=production
FRONTEND_URL=https://tu-frontend-en-produccion.com
# ... otras variables existentes
```

## 🔒 Seguridad CORS

La configuración CORS implementada:

- ✅ **Desarrollo**: Permite `localhost:3000` y `127.0.0.1:3000`
- ✅ **Producción**: Solo permite la URL especificada en `FRONTEND_URL`
- ✅ **Credenciales**: Soporta cookies y headers de autenticación
- ✅ **Métodos**: GET, POST, PUT, DELETE, OPTIONS, PATCH
- ✅ **Headers**: Content-Type, Authorization, etc.
- ✅ **Logging**: Muestra qué orígenes están permitidos y cuáles son rechazados

## 🧪 Cómo Probar

1. **Desarrollo local**:

   ```bash
   # Backend
   cd backend
   npm start

   # Frontend
   cd frontend
   npm run dev
   ```

2. **Verificar CORS**:

   - Abrir DevTools → Console
   - Deberías ver logs de configuración CORS en el backend
   - Las peticiones del frontend deberían funcionar sin errores CORS

3. **Probar con diferentes orígenes**:
   - El backend rechazará peticiones de orígenes no autorizados
   - Verás logs de error en la consola del backend si un origen no está permitido

## 🚨 Troubleshooting

### Error: "No permitido por la política CORS"

1. Verificar que `FRONTEND_URL` esté configurada correctamente
2. Revisar los logs del backend para ver qué orígenes están permitidos
3. Asegurarse de que las URLs no tengan barras al final

### Frontend no puede conectar con backend

1. Verificar que `NEXT_PUBLIC_API_URL` esté configurada
2. Verificar que el backend esté corriendo en la URL especificada
3. Revisar la consola del navegador para errores de red

### Variables de entorno no se cargan

1. Reiniciar tanto frontend como backend después de cambiar `.env`
2. Verificar que los archivos `.env` estén en los directorios correctos
3. Para Next.js, las variables deben empezar con `NEXT_PUBLIC_`

## 📝 Notas Importantes

- **Next.js**: Solo las variables que empiezan con `NEXT_PUBLIC_` están disponibles en el cliente
- **Reinicio**: Siempre reinicia los servidores después de cambiar variables de entorno
- **Seguridad**: Nunca pongas secretos en variables `NEXT_PUBLIC_`
- **Producción**: Asegúrate de configurar todas las variables en tu plataforma de hosting

## 🔄 Migración de URLs Hardcodeadas

Todas las instancias de `http://localhost:3001` han sido reemplazadas por la configuración centralizada:

- ✅ `/api/accounts`
- ✅ `/api/queue/add`
- ✅ `/api/queue/status`
- ✅ `/api/queue/cancel/{id}`
- ✅ `/api/tweets`
- ✅ `/api/account-limits`
- ✅ `/api/metrics/realtime`

Esto hace que tu aplicación sea fácil de desplegar en cualquier entorno sin cambios de código.
