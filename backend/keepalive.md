# 🚀 Keep-Alive Endpoint

## 📝 Descripción

El endpoint `/api/keepalive` está diseñado para mantener activo el backend y evitar que se duerma en plataformas de hosting gratuito como Render.

## 🔧 Endpoint

```
GET /api/keepalive
```

## 📊 Respuesta

```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "message": "Backend activo y funcionando"
}
```

### Campos de respuesta:

- `status`: Estado del servidor (siempre "alive")
- `timestamp`: Marca temporal ISO 8601 del momento de la respuesta
- `uptime`: Tiempo que lleva ejecutándose el proceso en segundos
- `message`: Mensaje descriptivo

## 🕒 Uso con Cron Jobs

### Opción 1: UptimeRobot (Recomendado)

1. Regístrate en [UptimeRobot](https://uptimerobot.com)
2. Crea un nuevo monitor HTTP/HTTPS
3. URL: `https://tu-backend.onrender.com/api/keepalive`
4. Intervalo: 5 minutos (gratuito)

### Opción 2: Cron-job.org

1. Ve a [Cron-job.org](https://cron-job.org)
2. Crea una nueva tarea cron
3. URL: `https://tu-backend.onrender.com/api/keepalive`
4. Horario: `*/5 * * * *` (cada 5 minutos)

### Opción 3: GitHub Actions (Gratuito)

Crea `.github/workflows/keepalive.yml` en tu repositorio:

```yaml
name: Keep Backend Alive
on:
  schedule:
    - cron: "*/5 * * * *" # Cada 5 minutos
  workflow_dispatch: # Manual trigger

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Keep backend alive
        run: |
          curl -f https://tu-backend.onrender.com/api/keepalive || exit 1
```

## 🚨 Consideraciones

1. **Límites de Render**: Los servicios gratuitos tienen límite de 750 horas/mes
2. **Frecuencia recomendada**: 5-10 minutos para optimizar recursos
3. **Monitoreo**: Este endpoint también sirve para monitorear el estado del servidor
4. **Logs**: Cada llamada se registra automáticamente en los logs de Express

## 🔍 Ejemplo de uso con curl

```bash
# Llamada simple
curl https://tu-backend.onrender.com/api/keepalive

# Con headers verbose
curl -v https://tu-backend.onrender.com/api/keepalive

# Script de bash para monitoreo
#!/bin/bash
response=$(curl -s https://tu-backend.onrender.com/api/keepalive)
status=$(echo $response | jq -r '.status')
if [ "$status" = "alive" ]; then
  echo "✅ Backend está activo"
else
  echo "❌ Backend no responde correctamente"
fi
```

## 📈 Ventajas

- ✅ Respuesta ultra-rápida (< 10ms)
- ✅ Mínimo uso de recursos
- ✅ Compatible con cualquier servicio de monitoreo
- ✅ Información útil del estado del servidor
- ✅ No requiere autenticación
- ✅ Protocolo HTTP estándar
