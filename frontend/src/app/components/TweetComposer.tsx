"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface XAccount {
  _id: string;
  username: string;
  userId: string;
  developerTag: string;
  labels: string[];
}

interface TweetComposerProps {
  accounts: XAccount[];
  inReplyToTweetId?: string;
  replyToUsername?: string;
  onSuccess?: (tweet: any) => void;
  onCancel?: () => void;
}

export default function TweetComposer({ 
  accounts, 
  inReplyToTweetId, 
  replyToUsername,
  onSuccess,
  onCancel
}: TweetComposerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [tweetText, setTweetText] = useState<string>(replyToUsername ? `@${replyToUsername} ` : "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const characterLimit = 280;
  const remainingChars = characterLimit - tweetText.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccountId) {
      setError("Por favor selecciona una cuenta");
      return;
    }
    
    if (tweetText.trim().length === 0) {
      setError("El tweet no puede estar vacío");
      return;
    }
    
    if (tweetText.length > characterLimit) {
      setError(`El tweet supera el límite de ${characterLimit} caracteres`);
      return;
    }
    
    setIsSubmitting(true);
    setError("");
    
    try {
      // Determinar si es un tweet nuevo o una respuesta
      const endpoint = inReplyToTweetId 
        ? "/api/actions/reply" 
        : "/api/actions/tweet";
      
      // Preparar los datos
      const postData: any = {
        accountId: selectedAccountId,
        text: tweetText
      };
      
      if (inReplyToTweetId) {
        postData.inReplyToTweetId = inReplyToTweetId;
      }
      
      // Si hay archivos de media (simplificado)
      // Nota: En una implementación real, primero subirías los archivos
      // a la API de medios de X y obtendrías media_ids
      if (mediaFiles.length > 0) {
        // Simulado: normalmente cargarías los archivos y obtendrías IDs
        postData.media = ["media_id_1", "media_id_2"];
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Error al publicar tweet");
      }
      
      // Éxito
      setTweetText("");
      setMediaFiles([]);
      onSuccess?.(data.tweet);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al publicar el tweet");
      console.error("Error en TweetComposer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    setTweetText("");
    setMediaFiles([]);
    setError("");
    onCancel?.();
  };
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setMediaFiles(prev => [...prev, ...Array.from(files)]);
    }
  };
  
  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seleccionar cuenta
          </label>
          <select
            id="account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          >
            <option value="">Selecciona una cuenta</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                @{account.username}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label htmlFor="tweetText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {inReplyToTweetId ? "Tu respuesta" : "¿Qué está pasando?"}
          </label>
          <textarea
            id="tweetText"
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            rows={4}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={inReplyToTweetId ? "Escribe tu respuesta..." : "¿Qué está pasando?"}
            required
          />
          <div className="flex justify-between items-center mt-2">
            <div>
              <span className={`text-sm ${remainingChars < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {remainingChars}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFileSelect}
              className="text-blue-500 hover:text-blue-700"
            >
              📎 Adjuntar
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
              multiple
            />
          </div>
        </div>
        
        {mediaFiles.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Archivos adjuntos:
            </p>
            <div className="flex flex-wrap gap-2">
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative">
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md p-2 flex items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">
                      {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Eliminar archivo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publicando...' : inReplyToTweetId ? 'Responder' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
} 