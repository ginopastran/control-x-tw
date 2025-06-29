import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default_dev_key_32_chars_long_here";

// Función para verificar si un texto está encriptado
const isEncrypted = (text: string | null | undefined): boolean => {
  if (!text) return false;
  // Los datos encriptados tienen formato "iv:encryptedData"
  return text.includes(":") && text.split(":").length === 2;
};

// Función para desencriptar texto (compatible con backend)
export const decrypt = (encryptedText: string | null | undefined): string => {
  if (!encryptedText) {
    console.log("🔐 decrypt: texto vacío, retornando vacío");
    return "";
  }

  // Si no está encriptado, devolver tal como está
  if (!isEncrypted(encryptedText)) {
    console.log(
      "🔐 decrypt: texto no encriptado, retornando original:",
      encryptedText.substring(0, 10) + "..."
    );
    return encryptedText;
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    console.log("🔐 decrypt: formato inválido, retornando original");
    return encryptedText;
  }

  try {
    const iv = Buffer.from(parts[0], "hex");
    const encryptedData = parts[1];

    const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_KEY);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    console.log(
      "🔐 decrypt: desencriptación exitosa para:",
      encryptedText.substring(0, 10) + "..."
    );
    return decrypted;
  } catch (error) {
    console.error("🔐 decrypt: Error al desencriptar:", error);
    console.log("🔐 decrypt: retornando texto original");
    return encryptedText; // Si falla, devolver el valor original
  }
};

// Función para encriptar texto
export const encrypt = (text: string): string => {
  if (!text) return "";

  try {
    const cipher = crypto.createCipher("aes-256-cbc", ENCRYPTION_KEY);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Generar IV aleatorio para compatibilidad
    const iv = crypto.randomBytes(16).toString("hex");

    return `${iv}:${encrypted}`;
  } catch (error) {
    console.error("🔐 encrypt: Error al encriptar:", error);
    return text;
  }
};

// Función para desencriptar múltiples credenciales
export const decryptCredentials = (credentials: {
  ownApiKey?: string | null;
  ownApiSecret?: string | null;
  ownBearerToken?: string | null;
  ownAccessToken?: string | null;
  ownAccessTokenSecret?: string | null;
  ownClientId?: string | null;
  ownClientSecret?: string | null;
  ownOAuth2AccessToken?: string | null;
  ownOAuth2RefreshToken?: string | null;
}) => {
  console.log("🔐 decryptCredentials: Procesando credenciales...");

  const result = {
    apiKey: decrypt(credentials.ownApiKey),
    apiSecret: decrypt(credentials.ownApiSecret),
    bearerToken: decrypt(credentials.ownBearerToken),
    accessToken: decrypt(credentials.ownAccessToken),
    accessTokenSecret: decrypt(credentials.ownAccessTokenSecret),
    clientId: decrypt(credentials.ownClientId),
    clientSecret: decrypt(credentials.ownClientSecret),
    oauth2AccessToken: decrypt(credentials.ownOAuth2AccessToken),
    oauth2RefreshToken: decrypt(credentials.ownOAuth2RefreshToken),
  };

  console.log("🔐 decryptCredentials: Resultado:", {
    hasApiKey: !!result.apiKey,
    hasApiSecret: !!result.apiSecret,
    hasBearerToken: !!result.bearerToken,
    hasClientId: !!result.clientId,
    hasClientSecret: !!result.clientSecret,
    hasOAuth2AccessToken: !!result.oauth2AccessToken,
  });

  return result;
};
