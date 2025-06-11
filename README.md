# Control-X Bot de Twitter

Bot automatizado para gestionar múltiples cuentas de Twitter/X con funcionalidades avanzadas.

## 🆕 Nuevas Funcionalidades

### Seguir y Dejar de Seguir Usuarios

El bot ahora incluye la capacidad de seguir y dejar de seguir usuarios automáticamente:

#### Características:

- ✅ **Seguir usuarios**: Automatiza el proceso de seguir cuentas
- ✅ **Dejar de seguir**: Automatiza el proceso de unfollow
- ✅ **Múltiples formatos de entrada**:
  - Username: `@username` o `username`
  - ID numérico: `123456789`
  - URL completa: `https://twitter.com/username` o `https://x.com/username`
- ✅ **Validación automática** de usuarios objetivos
- ✅ **Conversión automática** de username a ID cuando es necesario
- ✅ **Delays inteligentes** para respetar rate limits
- ✅ **Reintentos automáticos** con backoff exponencial

#### Límites de la API de X:

- **Follows/Unfollows**: 400 acciones por día por cuenta
- **Delay recomendado**: 5+ segundos entre acciones
- **Rate limit**: Más estricto que likes/retweets

### Mejoras en Funcionalidades Existentes

#### Likes Mejorados:

- ✅ **Mejor manejo de errores** con reintentos inteligentes
- ✅ **Rate limiting mejorado** con jitter aleatorio
- ✅ **Más tipos de errores recuperables**
- ✅ **Feedback visual mejorado**

#### Sistema de Reintentos:

- ✅ **Backoff exponencial** con variabilidad aleatoria
- ✅ **Detección inteligente** de errores recuperables:
  - 429 (Too Many Requests)
  - 500 (Internal Server Error)
  - 502 (Bad Gateway)
  - 503 (Service Unavailable)
  - 504 (Gateway Timeout)
  - Timeouts de conexión

#### Interfaz de Usuario:

- ✅ **Campo dedicado** para usuario objetivo
- ✅ **Validación en tiempo real**
- ✅ **Botones específicos** para follow/unfollow
- ✅ **Consejos y límites** visibles en la UI
- ✅ **Limpieza automática** de campos tras éxito
- ✅ **Notificaciones informativas** por tipo de acción

## 🚀 Uso

1. **Selecciona las cuentas** que realizarán la acción
2. **Para seguir/dejar de seguir**:
   - Introduce el usuario objetivo en el campo correspondiente
   - Formats válidos: `@username`, `username`, `123456789`, o URL completa
   - Haz clic en "Seguir" o "Dejar de Seguir"
3. **Configura delays apropiados**:
   - Follow/Unfollow: 5+ segundos recomendados
   - Likes/Retweets: 2+ segundos

## ⚠️ Consideraciones Importantes

- **Rate Limits**: X tiene límites estrictos. Respeta los delays recomendados
- **Credenciales**: Las acciones de escritura requieren credenciales propias verificadas
- **Monitoreo**: Revisa los resultados después de cada acción masiva
- **Suspensiones**: El uso excesivo puede resultar en suspensiones temporales

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **Frontend**: Next.js + TypeScript
- **Base de datos**: MongoDB
- **API**: Twitter API v2
- **Autenticación**: OAuth 1.0a + OAuth 2.0
