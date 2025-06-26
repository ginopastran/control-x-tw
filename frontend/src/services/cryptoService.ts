import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Servicio de criptografía para operaciones seguras
 */
export class CryptoService {
  /**
   * Genera un hash SHA-256 de un string
   */
  static sha256(data: string): string {
    return createHash("sha256").update(data, "utf8").digest("hex");
  }

  /**
   * Genera un HMAC-SHA256
   */
  static hmacSha256(data: string, key: string): string {
    return createHmac("sha256", key).update(data, "utf8").digest("hex");
  }

  /**
   * Genera un HMAC-SHA1 (para OAuth 1.0a)
   */
  static hmacSha1(data: string, key: string): string {
    return createHmac("sha1", key).update(data, "utf8").digest("base64");
  }

  /**
   * Genera bytes aleatorios
   */
  static randomBytes(length: number): string {
    return randomBytes(length).toString("hex");
  }

  /**
   * Genera un nonce para OAuth
   */
  static generateNonce(): string {
    return this.randomBytes(16);
  }

  /**
   * Genera un timestamp para OAuth
   */
  static generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Codifica parámetros para OAuth
   */
  static encodeParameters(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
      )
      .join("&");
  }

  /**
   * Crea una signature base string para OAuth 1.0a
   */
  static createSignatureBaseString(
    method: string,
    url: string,
    parameters: Record<string, string>
  ): string {
    const encodedMethod = encodeURIComponent(method.toUpperCase());
    const encodedUrl = encodeURIComponent(url);
    const encodedParams = encodeURIComponent(this.encodeParameters(parameters));

    return `${encodedMethod}&${encodedUrl}&${encodedParams}`;
  }

  /**
   * Crea una signing key para OAuth 1.0a
   */
  static createSigningKey(
    consumerSecret: string,
    tokenSecret: string = ""
  ): string {
    return `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(
      tokenSecret
    )}`;
  }

  /**
   * Genera una signature OAuth 1.0a completa
   */
  static generateOAuthSignature(
    method: string,
    url: string,
    parameters: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string = ""
  ): string {
    const baseString = this.createSignatureBaseString(method, url, parameters);
    const signingKey = this.createSigningKey(consumerSecret, tokenSecret);

    return this.hmacSha1(baseString, signingKey);
  }

  /**
   * Crea un Authorization header para OAuth 1.0a
   */
  static createOAuthHeader(
    consumerKey: string,
    consumerSecret: string,
    token: string = "",
    tokenSecret: string = "",
    method: string = "POST",
    url: string,
    additionalParams: Record<string, string> = {}
  ): string {
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: this.generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: this.generateTimestamp(),
      oauth_version: "1.0",
      ...additionalParams,
    };

    if (token) {
      oauthParams.oauth_token = token;
    }

    const signature = this.generateOAuthSignature(
      method,
      url,
      oauthParams,
      consumerSecret,
      tokenSecret
    );

    oauthParams.oauth_signature = signature;

    const authHeader =
      "OAuth " +
      Object.keys(oauthParams)
        .map(
          (key) =>
            `${encodeURIComponent(key)}="${encodeURIComponent(
              oauthParams[key]
            )}"`
        )
        .join(", ");

    return authHeader;
  }

  /**
   * Valida un JWT secret
   */
  static validateJWTSecret(secret: string): boolean {
    if (!secret || typeof secret !== "string") {
      return false;
    }

    // Debe tener al menos 32 caracteres
    if (secret.length < 32) {
      return false;
    }

    return true;
  }

  /**
   * Genera un JWT secret seguro
   */
  static generateJWTSecret(): string {
    return this.randomBytes(32);
  }

  /**
   * Encripta datos sensibles (simple XOR para demo - usar algo más robusto en producción)
   */
  static encrypt(data: string, key: string): string {
    const keyHash = this.sha256(key);
    let result = "";

    for (let i = 0; i < data.length; i++) {
      const charCode =
        data.charCodeAt(i) ^ keyHash.charCodeAt(i % keyHash.length);
      result += String.fromCharCode(charCode);
    }

    return Buffer.from(result, "binary").toString("base64");
  }

  /**
   * Desencripta datos
   */
  static decrypt(encryptedData: string, key: string): string {
    try {
      const keyHash = this.sha256(key);
      const data = Buffer.from(encryptedData, "base64").toString("binary");
      let result = "";

      for (let i = 0; i < data.length; i++) {
        const charCode =
          data.charCodeAt(i) ^ keyHash.charCodeAt(i % keyHash.length);
        result += String.fromCharCode(charCode);
      }

      return result;
    } catch (error) {
      throw new Error("Error al desencriptar datos");
    }
  }
}

export default CryptoService;
