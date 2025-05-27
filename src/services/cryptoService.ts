import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const SECRET_KEY =
  process.env.ENCRYPTION_SECRET ||
  "default-secret-key-change-this-in-production";

// Generar clave de 32 bytes a partir del secret
const getKey = () => {
  return crypto.scryptSync(SECRET_KEY, "salt", 32);
};

export const encrypt = (text: string): string => {
  try {
    if (!text) return "";

    const key = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Combinar IV + encrypted
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Error al encriptar:", error);
    throw new Error("Error en encriptación");
  }
};

export const decrypt = (encryptedData: string): string => {
  try {
    if (!encryptedData) return "";

    const key = getKey();
    const [ivHex, encrypted] = encryptedData.split(":");

    if (!ivHex || !encrypted) {
      throw new Error("Formato de datos encriptados inválido");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Error al desencriptar:", error);
    throw new Error("Error en desencriptación");
  }
};

// Funciones específicas para credenciales
export const encryptCredentials = (credentials: {
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  accessToken?: string;
  accessTokenSecret?: string;
}) => {
  return {
    apiKey: credentials.apiKey ? encrypt(credentials.apiKey) : undefined,
    apiSecret: credentials.apiSecret
      ? encrypt(credentials.apiSecret)
      : undefined,
    bearerToken: credentials.bearerToken
      ? encrypt(credentials.bearerToken)
      : undefined,
    accessToken: credentials.accessToken
      ? encrypt(credentials.accessToken)
      : undefined,
    accessTokenSecret: credentials.accessTokenSecret
      ? encrypt(credentials.accessTokenSecret)
      : undefined,
  };
};

export const decryptCredentials = (encryptedCredentials: {
  ownApiKey?: string;
  ownApiSecret?: string;
  ownBearerToken?: string;
  ownAccessToken?: string;
  ownAccessTokenSecret?: string;
}) => {
  return {
    apiKey: encryptedCredentials.ownApiKey
      ? decrypt(encryptedCredentials.ownApiKey)
      : undefined,
    apiSecret: encryptedCredentials.ownApiSecret
      ? decrypt(encryptedCredentials.ownApiSecret)
      : undefined,
    bearerToken: encryptedCredentials.ownBearerToken
      ? decrypt(encryptedCredentials.ownBearerToken)
      : undefined,
    accessToken: encryptedCredentials.ownAccessToken
      ? decrypt(encryptedCredentials.ownAccessToken)
      : undefined,
    accessTokenSecret: encryptedCredentials.ownAccessTokenSecret
      ? decrypt(encryptedCredentials.ownAccessTokenSecret)
      : undefined,
  };
};
