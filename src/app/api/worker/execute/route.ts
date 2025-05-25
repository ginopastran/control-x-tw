import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import ScheduledAction from "@/models/ScheduledAction";
import { handleXAuthError, isXAuthError } from "@/app/utils/auth-error-handler";
import { logAction, logError } from "@/lib/log-action";

// Este endpoint está diseñado para ser llamado por un cron job
export async function POST(req: NextRequest) {
  // Verificar la clave secreta para este endpoint
  const apiKey = req.headers.get("x-api-key");
  
  if (!process.env.WORKER_API_KEY || apiKey !== process.env.WORKER_API_KEY) {
    return NextResponse.json(
      { error: "Acceso no autorizado" },
      { status: 401 }
    );
  }
  
  try {
    await connectDB();
    
    // Obtener acciones pendientes que deben ejecutarse ahora
    const now = new Date();
    const pendingActions = await ScheduledAction.find({
      status: "pending",
      scheduledFor: { $lte: now }
    }).limit(10).populate("accountId");

    // Si no hay acciones pendientes, terminar
    if (pendingActions.length === 0) {
      return NextResponse.json({ message: "No hay acciones pendientes para ejecutar" });
    }
    
    // Ejecutar cada acción
    const results = await Promise.all(
      pendingActions.map(async (action) => {
        // Marcar como procesando
        action.status = "processing";
        await action.save();
        
        try {
          // Obtener cuenta
          const account = action.accountId;
          
          if (!account || !account.accessToken) {
            throw new Error("Cuenta no disponible o token no válido");
          }
          
          const accountId = account._id.toString();
          
          // Crear función para ejecutar la acción que puede ser reintentada tras refrescar el token
          const performAction = async () => {
            let endpoint;
            let payload: any = {};
            let method = "POST";

            // Preparar la llamada a la API según el tipo de acción
            switch (action.type) {
              case "tweet":
                endpoint = "https://api.twitter.com/2/tweets";
                payload = {
                  text: action.text
                };
                break;

              case "reply":
                endpoint = "https://api.twitter.com/2/tweets";
                payload = {
                  text: action.text,
                  reply: {
                    in_reply_to_tweet_id: action.tweetId
                  }
                };
                break;

              case "like":
                endpoint = `https://api.twitter.com/2/users/${account.userId}/likes`;
                payload = {
                  tweet_id: action.tweetId
                };
                break;

              case "retweet":
                endpoint = `https://api.twitter.com/2/users/${account.userId}/retweets`;
                payload = {
                  tweet_id: action.tweetId
                };
                break;

              default:
                throw new Error(`Tipo de acción no soportado: ${action.type}`);
            }

            // Ejecutar la acción
            logAction('worker_execute_action', { 
              type: action.type, 
              accountId: accountId,
              actionId: action._id.toString() 
            });
            
            const response = await fetch(endpoint, {
              method: method,
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${account.accessToken}`
              },
              body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
              // Si es un error de autenticación, se manejará por handleXAuthError
              if (isXAuthError(data)) {
                throw data;
              }
              
              // Otro tipo de error
              logError('worker_action_error', data);
              throw new Error(JSON.stringify(data.errors || data));
            }

            return data;
          };
          
          // Ejecutar con manejo automático de errores de autenticación
          const data = await handleXAuthError(accountId, null, performAction);

          // Actualizar acción a completada
          action.status = "completed";
          action.result = data;
          action.executedAt = new Date();
          await action.save();

          return {
            id: action._id,
            type: action.type,
            status: "completed",
            result: data
          };
        } catch (error: any) {
          // En caso de error, marcar como fallido
          console.error(`Error ejecutando acción ${action._id}:`, error);
          logError('worker_action_failed', error, { 
            actionId: action._id.toString(),
            actionType: action.type
          });
          
          action.status = "failed";
          action.error = error.message || "Error desconocido";
          action.executedAt = new Date();
          await action.save();

          return {
            id: action._id,
            type: action.type,
            status: "failed",
            error: error.message
          };
        }
      })
    );

    return NextResponse.json({
      executed: results.length,
      results
    });
  } catch (error: any) {
    console.error("Error al procesar acciones programadas:", error);
    logError('worker_execute_general', error);
    
    return NextResponse.json(
      { error: "Error al procesar acciones programadas: " + error.message },
      { status: 500 }
    );
  }
} 