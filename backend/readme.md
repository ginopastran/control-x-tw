# Control X - Backend

Backend para el sistema de gestión automatizada de cuentas de Twitter/X.

## 🚀 Características

- ✅ Sistema de colas inteligente con rate limiting
- ✅ Soporte OAuth 1.0a y OAuth 2.0
- ✅ Delays progresivos para evitar límites de API
- ✅ Dashboard en tiempo real
- ✅ Encriptación segura de credenciales
- ✅ Métricas y monitoreo

## 📋 Requisitos

- Node.js 18+
- MongoDB
- Cuentas de Twitter con credenciales API

## ⚙️ Instalación

1. **Clonar y configurar:**

```bash
cd backend
npm install
```

2. **Configurar variables de entorno:**

```bash
cp env.example .env
```

3. **Editar `.env` con tus credenciales:**

```env
MONGODB_URI=mongodb://localhost:27017/control-x
PORT=3001
ENCRYPTION_KEY=genera_clave_con_crypto.randomBytes(32).toString('hex')
```

4. **Iniciar servidor:**

```bash
npm run dev  # Desarrollo
npm start    # Producción
```

## 🔧 API Endpoints

### Colas y Acciones

- `POST /api/tweets` - Añadir acción a la cola
- `GET /api/queue/status` - Estado de la cola
- `DELETE /api/queue/clear` - Limpiar cola

### Cuentas

- `GET /api/accounts` - Listar cuentas
- `GET /api/account-limits` - Límites por cuenta

### Métricas

- `GET /api/metrics/realtime` - Métricas en tiempo real

## 🔒 Seguridad

Las credenciales se encriptan usando AES-256-GCM antes de guardarse en MongoDB.

## 📊 Sistema de Colas

- Máximo 2 acciones concurrentes
- Rate limiting inteligente por cuenta y global
- Delays progresivos: 2-5 minutos entre acciones
- Auto-reintentos con backoff exponencial

## 🚨 Rate Limits Configurados

| Acción  | Delay entre cuentas | Delay global |
| ------- | ------------------- | ------------ |
| Like    | 2 minutos           | 30 segundos  |
| Retweet | 3 minutos           | 45 segundos  |
| Tweet   | 4 minutos           | 1 minuto     |
| Reply   | 3 minutos           | 45 segundos  |
| Follow  | 2 minutos           | 30 segundos  |
