const crypto = require("crypto");

/**
 * Genera una firma OAuth 1.0a
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @param {string} url - URL completa del endpoint
 * @param {Object} params - Parámetros OAuth y del cuerpo
 * @param {string} consumerSecret - Consumer Secret de la app
 * @param {string} tokenSecret - Token Secret del usuario (puede ser vacío)
 * @returns {string} - Firma OAuth 1.0a
 */
function generateOAuth1Signature(
  method,
  url,
  params,
  consumerSecret,
  tokenSecret = ""
) {
  // 1. Crear la cadena de parámetros
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  // 2. Crear la cadena base de la firma
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  // 3. Crear la clave de firma
  const signingKey = [
    encodeURIComponent(consumerSecret),
    encodeURIComponent(tokenSecret),
  ].join("&");

  // 4. Generar la firma HMAC-SHA1
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  return signature;
}

/**
 * Genera los headers completos de OAuth 1.0a
 * @param {string} method - Método HTTP
 * @param {string} url - URL completa del endpoint
 * @param {Object} bodyParams - Parámetros del cuerpo (para POST/PUT)
 * @param {Object} account - Objeto de cuenta con credenciales
 * @param {string} accessToken - Access Token del usuario
 * @param {string} accessTokenSecret - Access Token Secret del usuario
 * @returns {Object} - Headers de la petición con Authorization
 */
async function generateOAuth1Headers(
  method,
  url,
  bodyParams = {},
  account,
  accessToken,
  accessTokenSecret
) {
  try {
    // Usar credenciales directamente (sin desencriptar)
    const apiKey = account.ownApiKey;
    const apiSecret = account.ownApiSecret;

    if (!apiKey || !apiSecret) {
      throw new Error("API Key y API Secret son requeridos para OAuth 1.0a");
    }

    // Generar nonce y timestamp
    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000);

    // Parámetros OAuth base
    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    };

    // Añadir token si está disponible
    if (accessToken) {
      oauthParams.oauth_token = accessToken;
    }

    // Combinar parámetros OAuth con parámetros del cuerpo (solo para GET y parámetros de query)
    let allParams = { ...oauthParams };

    // Para métodos que incluyen parámetros en la firma
    if (method === "GET" || method === "DELETE") {
      // Extraer query parameters de la URL
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        allParams[key] = value;
      });
    }

    // Generar firma
    const signature = generateOAuth1Signature(
      method,
      url.split("?")[0], // URL sin query parameters
      allParams,
      apiSecret,
      accessTokenSecret || ""
    );

    // Añadir firma a los parámetros OAuth
    oauthParams.oauth_signature = signature;

    // Crear header Authorization
    const authHeader =
      "OAuth " +
      Object.keys(oauthParams)
        .sort()
        .map(
          (key) =>
            `${encodeURIComponent(key)}="${encodeURIComponent(
              oauthParams[key]
            )}"`
        )
        .join(", ");

    return {
      Authorization: authHeader,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("Error generando headers OAuth 1.0a:", error);
    throw new Error(`Error en autenticación OAuth 1.0a: ${error.message}`);
  }
}

/**
 * Valida que las credenciales OAuth 1.0a sean válidas
 * @param {Object} credentials - Credenciales a validar
 * @returns {boolean} - true si las credenciales son válidas
 */
function validateOAuth1Credentials(credentials) {
  const required = ["apiKey", "apiSecret"];
  const optional = ["accessToken", "accessTokenSecret"];

  // Verificar campos requeridos
  for (const field of required) {
    if (!credentials[field] || credentials[field].trim() === "") {
      return false;
    }
  }

  // Si hay access token, debe haber access token secret también
  if (credentials.accessToken && !credentials.accessTokenSecret) {
    return false;
  }

  return true;
}

module.exports = {
  generateOAuth1Signature,
  generateOAuth1Headers,
  validateOAuth1Credentials,
};
