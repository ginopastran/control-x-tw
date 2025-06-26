"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  try {
    const text = formData.get("text") as string;
    const labels = formData.get("labels") as string;

    if (!text) {
      throw new Error("El texto es requerido");
    }

    // Convertir labels string a array
    const labelsArray = labels
      ? labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean)
      : [];

    // Crear mensaje usando Prisma
    const message = await prisma.message.create({
      data: {
        text,
        type: "tweet",
        labels: labelsArray,
      },
    });

    // Revalidar la página para mostrar el nuevo mensaje
    revalidatePath("/messages");

    return {
      success: true,
      message: "Mensaje creado exitosamente",
      data: message,
    };
  } catch (error: any) {
    console.error("Error creando mensaje:", error);
    return {
      success: false,
      error: error.message || "Error al crear el mensaje",
    };
  }
}

export async function deletePost(messageId: string) {
  try {
    if (!messageId) {
      throw new Error("ID del mensaje es requerido");
    }

    // Eliminar mensaje usando Prisma
    await prisma.message.delete({
      where: { id: messageId },
    });

    // Revalidar la página
    revalidatePath("/messages");

    return {
      success: true,
      message: "Mensaje eliminado exitosamente",
    };
  } catch (error: any) {
    console.error("Error eliminando mensaje:", error);
    return {
      success: false,
      error: error.message || "Error al eliminar el mensaje",
    };
  }
}

export async function updatePost(messageId: string, formData: FormData) {
  try {
    const text = formData.get("text") as string;
    const labels = formData.get("labels") as string;

    if (!messageId) {
      throw new Error("ID del mensaje es requerido");
    }

    if (!text) {
      throw new Error("El texto es requerido");
    }

    // Convertir labels string a array
    const labelsArray = labels
      ? labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean)
      : [];

    // Actualizar mensaje usando Prisma
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        text,
        labels: labelsArray,
      },
    });

    // Revalidar la página
    revalidatePath("/messages");

    return {
      success: true,
      message: "Mensaje actualizado exitosamente",
      data: message,
    };
  } catch (error: any) {
    console.error("Error actualizando mensaje:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar el mensaje",
    };
  }
}

// Función para obtener todos los mensajes
export async function getAllMessages() {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: messages,
    };
  } catch (error: any) {
    console.error("Error obteniendo mensajes:", error);
    return {
      success: false,
      error: error.message || "Error al obtener los mensajes",
      data: [],
    };
  }
}

// Función para obtener mensajes por etiquetas
export async function getMessagesByLabels(labels: string[]) {
  try {
    if (!labels || labels.length === 0) {
      return getAllMessages();
    }

    const messages = await prisma.message.findMany({
      where: {
        labels: {
          hasSome: labels,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: messages,
    };
  } catch (error: any) {
    console.error("Error obteniendo mensajes por etiquetas:", error);
    return {
      success: false,
      error: error.message || "Error al obtener los mensajes",
      data: [],
    };
  }
}
