# Script de Carga de Cuentas desde CSV

Este script permite cargar cuentas de Twitter/X masivamente desde un archivo CSV al backend del sistema Control-X.

## 🚀 Características

- ✅ Carga masiva de cuentas desde CSV
- ✅ Soporte para credenciales OAuth 1.0a y OAuth 2.0
- ✅ Validación de datos y detección de duplicados
- ✅ Creación automática de etiquetas basadas en metadata
- ✅ Conexión directa a MongoDB sin usar API
- ✅ Manejo de errores y reporte detallado

## 📋 Requisitos

- Node.js 18+
- MongoDB ejecutándose
- Archivo CSV con el formato correcto
- Variables de entorno configuradas

## ⚙️ Instalación

1. **Navegar a la carpeta de scripts:**

```bash
cd scripts
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Configurar variables de entorno:**

```bash
# Opcional: establecer URI de MongoDB
export MONGODB_URI="mongodb://localhost:27017/control-x"
```

## 📄 Formato del CSV

El script espera un CSV con las siguientes columnas:

### Columnas Requeridas:

- `Gmail creada` - TRUE/FALSE
- `Cuenta de X creada` - TRUE/FALSE
- `Cuenta de desarrollador` - TRUE/FALSE
- `Tag Twitter` - @username del usuario
- `Email` - Email de la cuenta

### Columnas de Credenciales OAuth 1.0a:

- `API Key` - API Key de la aplicación
- `API Key Secret` - API Secret de la aplicación
- `Bearer Token` - Bearer Token
- `Access Token` - Access Token del usuario
- `Access Token Secret` - Access Token Secret del usuario

### Columnas de Credenciales OAuth 2.0:

- `Client ID ` - Client ID de la aplicación
- `client secrect` - Client Secret de la aplicación

### Columnas de Metadata (Opcionales):

- `Edad` - Rango de edad
- `Género` - Género del usuario
- `Clase Social` - Clase social
- `Ideología` - Ideología política
- `Situación` - Situación laboral/educativa
- `Profesión` - Profesión
- `name-app` - Nombre de la aplicación

## 🔧 Uso

### Ejecución Básica:

```bash
npm start
```

### Ejecución con archivo específico:

El script busca automáticamente el archivo CSV en estas ubicaciones:

1. `../frontend/Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv`
2. `../Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv`
3. `./Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv`

### Variables de Entorno:

```bash
# URI de MongoDB (opcional)
MONGODB_URI=mongodb://localhost:27017/control-x
```

## 📊 Proceso de Carga

1. **Conexión a MongoDB** - Se conecta a la base de datos
2. **Lectura del CSV** - Parsea y valida el archivo CSV
3. **Procesamiento de Datos** - Limpia y valida cada registro
4. **Filtrado** - Solo procesa cuentas con `Cuenta de X creada = TRUE`
5. **Validación de Duplicados** - Verifica usernames existentes
6. **Creación de Etiquetas** - Genera etiquetas automáticas basadas en metadata
7. **Inserción en DB** - Crea las cuentas en MongoDB
8. **Reporte Final** - Muestra estadísticas de la carga

## 🏷️ Sistema de Etiquetas

El script genera etiquetas automáticamente basadas en:

- **Edad**: `edad-14-18`, `edad-25-65`, etc.
- **Género**: `genero-varón`, `genero-mujer`
- **Clase Social**: `clase-baja`, `clase-media`, etc.
- **Ideología**: `ideologia-kukardo`, `ideologia-peroncho-tradicional`, etc.
- **Situación**: `situacion-estudiante-secundaria`, `situacion-trabaja`, etc.
- **Profesión**: `profesion-docente`, `profesion-policia`, etc.
- **Credenciales**: `oauth1`, `oauth2`, `cuenta-desarrollador`

## 📈 Ejemplo de Salida

```
🚀 Iniciando carga de cuentas desde CSV...

✅ Conectado a MongoDB
📊 CSV leído correctamente. 50 registros encontrados.

📋 Procesando registros...
📊 Resumen del procesamiento:
   ✅ Cuentas válidas: 45
   ⚠️ Cuentas saltadas: 5

🔐 Estadísticas de credenciales:
   🔑 Con OAuth 1.0a: 30
   🆕 Con OAuth 2.0: 10
   ❌ Sin credenciales: 5

🚀 Creando cuentas en MongoDB...

[1/45] Procesando @usuario1...
✅ Cuenta @usuario1 creada con ID: 507f1f77bcf86cd799439011 (OAuth 1.0a)

[2/45] Procesando @usuario2...
✅ Cuenta @usuario2 creada con ID: 507f1f77bcf86cd799439012 (OAuth 2.0)

============================================================
📋 RESUMEN FINAL
============================================================
✅ Cuentas creadas exitosamente: 43
🔄 Cuentas ya existentes: 2
❌ Cuentas con errores: 0

🎉 Proceso completado!
🔌 Desconectado de MongoDB
```

## ⚠️ Consideraciones

- **Duplicados**: Las cuentas con usernames ya existentes se saltan automáticamente
- **Credenciales**: Solo se cargan cuentas con `Cuenta de X creada = TRUE`
- **Validación**: Se valida que tengan username válido extraído de `Tag Twitter`
- **Performance**: Incluye pausas pequeñas entre inserciones para evitar sobrecarga
- **Rollback**: No hay rollback automático, las cuentas creadas permanecen en la DB

## 🐛 Troubleshooting

### Error de Conexión a MongoDB:

```bash
❌ Error conectando a MongoDB: connect ECONNREFUSED
```

**Solución**: Verificar que MongoDB esté ejecutándose y la URI sea correcta.

### Error de Archivo CSV:

```bash
❌ Archivo CSV no encontrado
```

**Solución**: Verificar que el archivo CSV esté en una de las rutas esperadas.

### Error de Formato CSV:

```bash
❌ Error leyendo el CSV: Invalid Record Length
```

**Solución**: Verificar que el CSV tenga el formato correcto y todas las columnas.

### Cuentas Duplicadas:

```bash
⚠️ La cuenta @usuario ya existe, saltando...
```

**Solución**: Normal, las cuentas duplicadas se saltan automáticamente.

## 📝 Notas

- El script es **idempotente**: puede ejecutarse múltiples veces sin crear duplicados
- Las credenciales se almacenan tal como vienen en el CSV (sin encriptación adicional)
- Se crean límites diarios por defecto para todas las cuentas
- Las métricas se inicializan en 0 para todas las cuentas nuevas
