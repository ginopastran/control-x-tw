# Control-X: Gestor Centralizado de Cuentas de X (Twitter)

## Descripción
Control-X es una aplicación web que permite administrar múltiples cuentas de X (anteriormente Twitter) de manera centralizada. Diseñada para gestionar eficientemente la interacción en la plataforma X a través de su API oficial.

## Características Principales

### 1. Gestión de Cuentas
- Administración centralizada de múltiples cuentas de X
- Organización de cuentas mediante etiquetas personalizables
- Vista unificada de todas las cuentas conectadas

### 2. Programador de Acciones
- Programación de tweets, respuestas, likes y retweets
- Configuración de retrasos personalizados entre acciones
- Ejecución automática de acciones programadas
- Selección múltiple de cuentas para acciones en masa

### 3. Características de Automatización
- Retrasos configurables para cada acción
- Retrasos incrementales entre acciones
- Monitoreo en tiempo real del estado de las acciones
- Sistema de gestión de errores y notificaciones

## Requisitos Técnicos

### Dependencias Principales
- Next.js
- React
- Twitter API v2
- MongoDB (para almacenamiento de datos)

### Configuración Necesaria
1. Credenciales de la API de X (Twitter)
2. Base de datos MongoDB
3. Variables de entorno configuradas

## Configuración del Proyecto

1. Clonar el repositorio:
```bash
git clone [URL_DEL_REPOSITORIO]
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
Crear un archivo `.env.local` con:
```
MONGODB_URI=tu_uri_de_mongodb
TWITTER_API_KEY=tu_api_key
TWITTER_API_SECRET=tu_api_secret
```

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

## Uso

### Gestión de Cuentas
1. Agregar nuevas cuentas desde el panel de administración
2. Asignar etiquetas para organización
3. Verificar el estado de autenticación de cada cuenta

### Programación de Acciones
1. Seleccionar el tipo de acción (tweet, respuesta, like, retweet)
2. Elegir las cuentas objetivo
3. Configurar los retrasos deseados
4. Programar y ejecutar las acciones

## Consideraciones de Seguridad
- Todas las credenciales se almacenan de forma segura
- Implementación de límites de tasa para cumplir con las políticas de X
- Sistema de manejo de errores robusto

## Soporte

Para reportar problemas o solicitar nuevas características, por favor crear un issue en el repositorio.

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.
