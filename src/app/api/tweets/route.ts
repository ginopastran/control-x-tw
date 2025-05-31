import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { getValidToken } from "@/services/tokenService";
import { decryptCredentials } from "@/services/cryptoService";
import { logError, logAction } from "@/lib/log-action";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Función para extraer y validar tweet ID de URL o ID directo
const extractAndValidateTweetId = (input: string): string | undefined => {
  if (!input?.trim()) return undefined;

  // Si es solo un número, devolverlo
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }

  // Si es una URL, extraer el ID
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split("/");
    const statusIndex = pathParts.indexOf("status");

    if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
      const tweetId = pathParts[statusIndex + 1].split("?")[0]; // Remover query params

      // Validar que sea numérico
      if (/^\d+$/.test(tweetId)) {
        return tweetId;
      }
    }
  } catch {
    // No es una URL válida, intentar como ID directo
  }

  return undefined;
};

// Función para generar OAuth 1.0a signature
const generateOAuth1Signature = (
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string => {
  // Ordenar parámetros
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  // Crear signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  // Crear signing key
  const signingKey = `${encodeURIComponent(
    consumerSecret
  )}&${encodeURIComponent(tokenSecret)}`;

  // Generar signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  return signature;
};

// Función para generar headers OAuth 1.0a
const generateOAuth1Headers = async (
  method: string,
  url: string,
  body: any,
  account: any,
  accessToken: string,
  accessTokenSecret: string
): Promise<Record<string, string>> => {
  // Obtener API keys encriptadas
  const decryptedCreds = decryptCredentials({
    ownApiKey: account.ownApiKey,
    ownApiSecret: account.ownApiSecret,
  });

  if (!decryptedCreds.apiKey || !decryptedCreds.apiSecret) {
    throw new Error("No se encontraron API Key y API Secret");
  }

  const consumerKey = decryptedCreds.apiKey;
  const consumerSecret = decryptedCreds.apiSecret;

  // Parámetros OAuth
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  // Generar signature
  const signature = generateOAuth1Signature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  // Agregar signature a parámetros
  const finalParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  // Crear header de autorización
  const authHeader =
    "OAuth " +
    Object.keys(finalParams)
      .map(
        (key) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(
            finalParams[key as keyof typeof finalParams]
          )}"`
      )
      .join(", ");

  return {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };
};

export async function POST(req: NextRequest) {
  try {
    // Validar que el request tenga body
    const body = await req.text();
    if (!body || body.trim() === "") {
      return NextResponse.json(
        { error: "Request body vacío" },
        { status: 400 }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return NextResponse.json(
        { error: "JSON inválido en request body" },
        { status: 400 }
      );
    }

    const { accountId, action, text, tweetId } = parsedBody;

    // Validar parámetros requeridos
    if (!accountId) {
      return NextResponse.json(
        { error: "accountId es requerido" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "action es requerido" },
        { status: 400 }
      );
    }

    // Validar cuenta
    await connectDB();
    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Validar que las acciones que requieren userId tengan este campo
    const actionsRequiringUserId = ["like", "retweet"];
    if (actionsRequiringUserId.includes(action) && !account.userId) {
      return NextResponse.json(
        {
          error: `La cuenta @${account.username} no tiene userId configurado. Este campo es requerido para la acción ${action}`,
        },
        { status: 400 }
      );
    }

    // Validar y procesar tweetId
    let validatedTweetId: string | undefined;
    const actionsRequiringTweetId = ["like", "retweet", "reply"];
    if (actionsRequiringTweetId.includes(action)) {
      if (!tweetId) {
        return NextResponse.json(
          { error: `tweetId es requerido para la acción ${action}` },
          { status: 400 }
        );
      }

      // Validar que el tweetId sea válido
      validatedTweetId = extractAndValidateTweetId(tweetId);
      if (!validatedTweetId) {
        return NextResponse.json(
          {
            error: `tweetId inválido: "${tweetId}". Debe ser un ID numérico o una URL válida de Twitter.`,
          },
          { status: 400 }
        );
      }
    }

    // Validar que las acciones que requieren texto lo tengan
    const actionsRequiringText = ["tweet", "reply"];
    if (actionsRequiringText.includes(action) && !text?.trim()) {
      return NextResponse.json(
        { error: `text es requerido para la acción ${action}` },
        { status: 400 }
      );
    }

    // Determinar qué credenciales usar
    let accessToken: string;
    let accessTokenSecret: string | undefined;
    let useOwnCredentials = false;
    let authMethod: "bearer" | "oauth1" = "bearer";

    if (
      account.useOwnCredentials &&
      account.credentialsVerified &&
      (account.ownAccessToken || account.ownBearerToken)
    ) {
      // Usar credenciales propias del usuario
      try {
        const decryptedCreds = decryptCredentials({
          ownBearerToken: account.ownBearerToken,
          ownApiKey: account.ownApiKey,
          ownApiSecret: account.ownApiSecret,
          ownAccessToken: account.ownAccessToken,
          ownAccessTokenSecret: account.ownAccessTokenSecret,
        });

        // Para acciones de escritura (tweet, like, retweet, reply) usar OAuth 1.0a
        // Para acciones de lectura usar Bearer Token
        const needsWriteAccess = ["tweet", "like", "retweet", "reply"].includes(
          action
        );

        if (
          needsWriteAccess &&
          decryptedCreds.accessToken &&
          decryptedCreds.accessTokenSecret
        ) {
          // Usar OAuth 1.0a para escritura
          accessToken = decryptedCreds.accessToken;
          accessTokenSecret = decryptedCreds.accessTokenSecret;
          authMethod = "oauth1";
          useOwnCredentials = true;
        } else if (!needsWriteAccess && decryptedCreds.bearerToken) {
          // Usar Bearer Token para lectura
          accessToken = decryptedCreds.bearerToken;
          authMethod = "bearer";
          useOwnCredentials = true;
        } else {
          throw new Error(
            needsWriteAccess
              ? "No se encontraron Access Token y Access Token Secret para acciones de escritura"
              : "No se encontró Bearer Token para acciones de lectura"
          );
        }
      } catch (error) {
        logError("decrypt_own_credentials_failed", {
          accountId: account._id,
          username: account.username,
          error: error instanceof Error ? error.message : String(error),
        });

        // Fallback a credenciales compartidas
        accessToken = await getValidToken(accountId);
        authMethod = "bearer";
        useOwnCredentials = false;
      }
    } else {
      // Usar credenciales compartidas (legacy)
      accessToken = await getValidToken(accountId);
      authMethod = "bearer";
      useOwnCredentials = false;
    }

    // Función para realizar la acción en Twitter con timeout
    const performTwitterAction = async () => {
      let endpoint = "";
      let method = "POST";
      let body: any = {};

      switch (action) {
        case "tweet":
          endpoint = "https://api.twitter.com/2/tweets";
          body = { text };
          break;
        case "like":
          endpoint = `https://api.twitter.com/2/users/${account.userId}/likes`;
          body = { tweet_id: validatedTweetId };
          break;
        case "retweet":
          endpoint = `https://api.twitter.com/2/users/${account.userId}/retweets`;
          body = { tweet_id: validatedTweetId };
          break;
        case "reply":
          endpoint = "https://api.twitter.com/2/tweets";
          body = {
            text,
            reply: { in_reply_to_tweet_id: validatedTweetId },
          };
          break;
        default:
          throw new Error("Acción no válida");
      }

      // Crear AbortController para timeout de 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        if (authMethod === "oauth1") {
          if (!accessTokenSecret) {
            throw new Error("Access Token Secret requerido para OAuth 1.0a");
          }

          const headers = await generateOAuth1Headers(
            method,
            endpoint,
            body,
            account,
            accessToken,
            accessTokenSecret
          );

          const response = await fetch(endpoint, {
            method,
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Obtener headers de rate limit para debugging
          const rateLimitHeaders = {
            limit: response.headers.get("x-rate-limit-limit"),
            remaining: response.headers.get("x-rate-limit-remaining"),
            reset: response.headers.get("x-rate-limit-reset"),
          };

          if (!response.ok) {
            const error = await response.json();

            // Log detallado para rate limits
            if (response.status === 429) {
              logError("twitter_rate_limit_exceeded", {
                accountId: account._id,
                username: account.username,
                action,
                rateLimitHeaders,
                error,
                endpoint,
                useOwnCredentials,
                userAppName: account.userAppName,
              });

              // Determinar el tiempo de espera basado en headers
              let resetTime = "unos minutos";
              if (rateLimitHeaders.reset) {
                const resetTimestamp = parseInt(rateLimitHeaders.reset) * 1000;
                const now = Date.now();
                const waitTime = Math.max(0, resetTimestamp - now);
                const waitMinutes = Math.ceil(waitTime / (1000 * 60));
                if (waitMinutes > 0) {
                  resetTime = `${waitMinutes} minuto${
                    waitMinutes !== 1 ? "s" : ""
                  }`;
                }
              }

              // Crear mensaje más informativo
              let errorMessage = `🕐 Rate limit de Twitter excedido.`;

              // Agregar información específica según el tipo de plan y credenciales
              if (rateLimitHeaders.remaining === "0") {
                errorMessage += ` Has alcanzado el límite de ${
                  rateLimitHeaders.limit || "solicitudes"
                } para esta acción.`;
              }

              errorMessage += ` Espera ${resetTime} antes de intentar de nuevo.`;

              // Información específica según tipo de credenciales
              if (useOwnCredentials) {
                errorMessage += ` (Usando credenciales propias`;
                if (account.userAppName) {
                  errorMessage += ` - App: ${account.userAppName}`;
                }
                errorMessage += `)`;

                // Si es plan Free con credenciales propias
                if (action === "tweet" && rateLimitHeaders.limit === "17") {
                  errorMessage += ` - Plan Free: 17 tweets por día por tu app`;
                }
              } else {
                errorMessage += ` (Usando credenciales compartidas)`;

                // Si es plan Free compartido
                if (action === "tweet" && rateLimitHeaders.limit === "17") {
                  errorMessage += ` - Plan Free compartido: considera usar tus propias API keys`;
                }
              }

              const errorObj = new Error(errorMessage);
              (errorObj as any).status = 429;
              (errorObj as any).rateLimitHeaders = rateLimitHeaders;
              throw errorObj;
            }

            // Log otros errores con más detalle
            logError("twitter_api_error", {
              accountId: account._id,
              username: account.username,
              action,
              status: response.status,
              error,
              endpoint,
              requestBody: body,
              useOwnCredentials,
              headers: Object.fromEntries(response.headers.entries()),
            });

            // Crear mensaje de error más específico
            let errorMessage = "";

            if (error.detail) {
              errorMessage = error.detail;
            } else if (error.title && error.detail) {
              errorMessage = `${error.title}: ${error.detail}`;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (response.status === 400) {
              if (action === "like" || action === "retweet") {
                errorMessage = `Parámetros inválidos para ${action}. Verifica que el userId (${account.userId}) y tweetId (${validatedTweetId}) sean correctos.`;
              } else {
                errorMessage =
                  "Uno o más parámetros de la solicitud son inválidos.";
              }
            } else {
              errorMessage = `Error ${response.status} de Twitter API`;
            }

            const errorObj = new Error(errorMessage);
            (errorObj as any).status = response.status;
            throw errorObj;
          }

          // Log exitoso con headers para monitoreo
          logAction("twitter_api_success", {
            accountId: account._id,
            username: account.username,
            action,
            rateLimitHeaders,
            endpoint,
            useOwnCredentials,
            userAppName: account.userAppName,
          });

          return response.json();
        } else {
          const response = await fetch(endpoint, {
            method,
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Obtener headers de rate limit para debugging
          const rateLimitHeaders = {
            limit: response.headers.get("x-rate-limit-limit"),
            remaining: response.headers.get("x-rate-limit-remaining"),
            reset: response.headers.get("x-rate-limit-reset"),
          };

          if (!response.ok) {
            const error = await response.json();

            // Log detallado para rate limits
            if (response.status === 429) {
              logError("twitter_rate_limit_exceeded", {
                accountId: account._id,
                username: account.username,
                action,
                rateLimitHeaders,
                error,
                endpoint,
                useOwnCredentials,
                userAppName: account.userAppName,
              });

              // Determinar el tiempo de espera basado en headers
              let resetTime = "unos minutos";
              if (rateLimitHeaders.reset) {
                const resetTimestamp = parseInt(rateLimitHeaders.reset) * 1000;
                const now = Date.now();
                const waitTime = Math.max(0, resetTimestamp - now);
                const waitMinutes = Math.ceil(waitTime / (1000 * 60));
                if (waitMinutes > 0) {
                  resetTime = `${waitMinutes} minuto${
                    waitMinutes !== 1 ? "s" : ""
                  }`;
                }
              }

              // Crear mensaje más informativo
              let errorMessage = `🕐 Rate limit de Twitter excedido.`;

              // Agregar información específica según el tipo de plan y credenciales
              if (rateLimitHeaders.remaining === "0") {
                errorMessage += ` Has alcanzado el límite de ${
                  rateLimitHeaders.limit || "solicitudes"
                } para esta acción.`;
              }

              errorMessage += ` Espera ${resetTime} antes de intentar de nuevo.`;

              // Información específica según tipo de credenciales
              if (useOwnCredentials) {
                errorMessage += ` (Usando credenciales propias`;
                if (account.userAppName) {
                  errorMessage += ` - App: ${account.userAppName}`;
                }
                errorMessage += `)`;

                // Si es plan Free con credenciales propias
                if (action === "tweet" && rateLimitHeaders.limit === "17") {
                  errorMessage += ` - Plan Free: 17 tweets por día por tu app`;
                }
              } else {
                errorMessage += ` (Usando credenciales compartidas)`;

                // Si es plan Free compartido
                if (action === "tweet" && rateLimitHeaders.limit === "17") {
                  errorMessage += ` - Plan Free compartido: considera usar tus propias API keys`;
                }
              }

              const errorObj = new Error(errorMessage);
              (errorObj as any).status = 429;
              (errorObj as any).rateLimitHeaders = rateLimitHeaders;
              throw errorObj;
            }

            // Log otros errores con más detalle
            logError("twitter_api_error", {
              accountId: account._id,
              username: account.username,
              action,
              status: response.status,
              error,
              endpoint,
              requestBody: body,
              useOwnCredentials,
              headers: Object.fromEntries(response.headers.entries()),
            });

            // Crear mensaje de error más específico
            let errorMessage = "";

            if (error.detail) {
              errorMessage = error.detail;
            } else if (error.title && error.detail) {
              errorMessage = `${error.title}: ${error.detail}`;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (response.status === 400) {
              if (action === "like" || action === "retweet") {
                errorMessage = `Parámetros inválidos para ${action}. Verifica que el userId (${account.userId}) y tweetId (${validatedTweetId}) sean correctos.`;
              } else {
                errorMessage =
                  "Uno o más parámetros de la solicitud son inválidos.";
              }
            } else {
              errorMessage = `Error ${response.status} de Twitter API`;
            }

            const errorObj = new Error(errorMessage);
            (errorObj as any).status = response.status;
            throw errorObj;
          }

          // Log exitoso con headers para monitoreo
          logAction("twitter_api_success", {
            accountId: account._id,
            username: account.username,
            action,
            rateLimitHeaders,
            endpoint,
            useOwnCredentials,
            userAppName: account.userAppName,
          });

          return response.json();
        }
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
          throw new Error(`Timeout: ${action} tardó más de 30 segundos`);
        }

        throw error;
      }
    };

    // Ejecutar la acción
    const result = await performTwitterAction();

    logAction("twitter_action_success", {
      action,
      accountId: account._id,
      username: account.username,
      useOwnCredentials,
    });

    return NextResponse.json({
      ...result,
      _meta: {
        useOwnCredentials,
        userAppName: useOwnCredentials ? account.userAppName : undefined,
      },
    });
  } catch (error: any) {
    logError("twitter_action_failed", error);

    // Preservar el status code de Twitter API si está disponible
    const statusCode = error.status || 500;

    return NextResponse.json(
      { error: error.message || "Error al procesar la acción" },
      { status: statusCode }
    );
  }
}
