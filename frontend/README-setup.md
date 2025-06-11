# Control-X: Programador de Interacciones para Twitter/X

Este proyecto permite programar interacciones con la plataforma X (antes Twitter) como respuestas, likes y retweets para que se ejecuten automáticamente en el momento especificado.

## Características

- Programar respuestas a tweets específicos a través de su URL
- Programar likes a tweets específicos a través de su URL
- Programar retweets específicos a través de su URL
- Panel de administración para gestionar las acciones programadas
- Soporte para múltiples cuentas de X
- Worker para ejecutar automáticamente las acciones programadas

## Requisitos previos

- Node.js 16.x o superior
- MongoDB (puede ser local o MongoDB Atlas)
- Cuentas de desarrollador de X con acceso a la API v2

## Configuración

1. Clona el repositorio:

```bash
git clone https://github.com/tuusuario/control-x.git
cd control-x
```

2. Instala las dependencias:

```bash
npm install
```

3. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
# MongoDB Connection String
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/database

# API Key para el worker que ejecuta las acciones programadas
WORKER_API_KEY=clave_secreta_para_el_worker

# Configuración de Twitter API
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# Configuración de seguridad
JWT_SECRET=una_clave_secreta_para_jwt
```

## Ejecución

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## Configuración del Worker

Para que las acciones programadas se ejecuten, necesitas configurar un proceso que llame regularmente al endpoint del worker. Puedes usar una herramienta como cron en Linux o el Programador de Tareas en Windows.

### Ejemplo de configuración de cron (Linux/Mac)

Edita tu archivo crontab:

```bash
crontab -e
```

Agrega la siguiente línea para ejecutar el worker cada minuto:

```
* * * * * curl -X POST -H "x-api-key: tu_worker_api_key" https://tu-dominio.com/api/worker/execute
```

## Estructura del proyecto

- `/src/app/tweets/scheduler` - Página principal para programar interacciones con tweets específicos
- `/src/app/tweets/scheduler/pending` - Página para ver y gestionar acciones programadas pendientes
- `/src/app/api/scheduler` - APIs para programar acciones (respuestas, likes y retweets)
- `/src/app/api/worker` - API del worker que ejecuta las acciones programadas
- `/src/models` - Modelos de datos

## Licencia

Este proyecto está bajo la licencia MIT. 