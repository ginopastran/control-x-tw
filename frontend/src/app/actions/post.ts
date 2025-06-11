'use server';

import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { logAction, logError } from "@/lib/log-action";
import { handleXAuthError, isXAuthError } from "@/app/utils/auth-error-handler";

export async function postTweet(accountId: string, text: string): Promise<{
  success: boolean;
  message?: string;
  tweet?: any;
  error?: string;
}> {
  try {
    if (!accountId || !text) {
      throw new Error("Se requiere ID de cuenta y texto del tweet");
    }
    
    await connectDB();
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      throw new Error("Cuenta no encontrada");
    }
    
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${account.accessToken}`
      },
      body: JSON.stringify({ text }),
      cache: 'no-store'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (isXAuthError(data)) {
        return await handleXAuthError(accountId, data, () => postTweet(accountId, text));
      }
      throw new Error(data.detail || "Error al publicar tweet");
    }
    
    return {
      success: true,
      message: "Tweet publicado correctamente",
      tweet: data.data
    };
  } catch (error: any) {
    logError('postTweet', error);
    return {
      success: false,
      error: error.message || "Error al publicar tweet"
    };
  }
}

export async function postLike(accountId: string, tweetId: string): Promise<{
  success: boolean;
  message?: string;
  result?: any;
  error?: string;
}> {
  try {
    if (!accountId || !tweetId) {
      throw new Error("Se requiere ID de cuenta e ID del tweet");
    }
    
    await connectDB();
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      throw new Error("Cuenta no encontrada");
    }
    
    const response = await fetch(`https://api.twitter.com/2/users/${account.userId}/likes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${account.accessToken}`
      },
      body: JSON.stringify({ tweet_id: tweetId }),
      cache: 'no-store'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (isXAuthError(data)) {
        return await handleXAuthError(accountId, data, () => postLike(accountId, tweetId));
      }
      throw new Error(data.detail || "Error al dar like");
    }
    
    return {
      success: true,
      message: "Like dado correctamente",
      result: data.data
    };
  } catch (error: any) {
    logError('postLike', error);
    return {
      success: false,
      error: error.message || "Error al dar like"
    };
  }
}

export async function postRetweet(accountId: string, tweetId: string): Promise<{
  success: boolean;
  message?: string;
  result?: any;
  error?: string;
}> {
  try {
    if (!accountId || !tweetId) {
      throw new Error("Se requiere ID de cuenta e ID del tweet");
    }
    
    await connectDB();
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      throw new Error("Cuenta no encontrada");
    }
    
    const response = await fetch(`https://api.twitter.com/2/users/${account.userId}/retweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${account.accessToken}`
      },
      body: JSON.stringify({ tweet_id: tweetId }),
      cache: 'no-store'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (isXAuthError(data)) {
        return await handleXAuthError(accountId, data, () => postRetweet(accountId, tweetId));
      }
      throw new Error(data.detail || "Error al retweetear");
    }
    
    return {
      success: true,
      message: "Retweet realizado correctamente",
      result: data.data
    };
  } catch (error: any) {
    logError('postRetweet', error);
    return {
      success: false,
      error: error.message || "Error al retweetear"
    };
  }
}

  export async function postReply(accountId: string, tweetId: string, text: string): Promise<{
  success: boolean;
  message?: string;
  reply?: any;
  error?: string;
}> {
  try {
    if (!accountId || !tweetId || !text) {
      throw new Error("Se requiere ID de cuenta, ID del tweet y texto de respuesta");
    }
    
    await connectDB();
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      throw new Error("Cuenta no encontrada");
    }
    
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${account.accessToken}`
      },
      body: JSON.stringify({
        text,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      }),
      cache: 'no-store'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (isXAuthError(data)) {
        return await handleXAuthError(accountId, data, () => postReply(accountId, tweetId, text));
      }
      throw new Error(data.detail || "Error al responder tweet");
    }
    
    return {
      success: true,
      message: "Respuesta publicada correctamente",
      reply: data.data
    };
  } catch (error: any) {
    logError('postReply', error);
    return {
      success: false,
      error: error.message || "Error al responder tweet"
    };
  }
} 