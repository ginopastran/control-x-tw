import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// POST: Agregar múltiples correos autorizados en lote (solo SUPERADMIN)
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo SUPERADMIN puede autorizar correos." },
        { status: 403 }
      );
    }

    const { emails } = await req.json();

    // Validar entrada
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de emails" },
        { status: 400 }
      );
    }

    // Limpiar y validar emails
    const cleanEmails = emails
      .map((email) => email?.toString().toLowerCase().trim())
      .filter((email) => email && email.includes("@"));

    if (cleanEmails.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron emails válidos" },
        { status: 400 }
      );
    }

    // Verificar cuáles emails ya están autorizados o registrados
    const existingAuthorized = await prisma.authorizedEmail.findMany({
      where: { email: { in: cleanEmails } },
    });

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: cleanEmails } },
    });

    const alreadyAuthorized = existingAuthorized.map((e) => e.email);
    const alreadyRegistered = existingUsers.map((u) => u.email);

    // Filtrar emails que no están ya autorizados o registrados
    const emailsToAdd = cleanEmails.filter(
      (email) =>
        !alreadyAuthorized.includes(email) && !alreadyRegistered.includes(email)
    );

    const results = {
      total: cleanEmails.length,
      added: 0,
      skipped: 0,
      errors: 0,
      details: {
        added: [] as string[],
        alreadyAuthorized: alreadyAuthorized,
        alreadyRegistered: alreadyRegistered,
        errors: [] as { email: string; error: string }[],
      },
    };

    // Agregar emails nuevos
    if (emailsToAdd.length > 0) {
      try {
        await prisma.authorizedEmail.createMany({
          data: emailsToAdd.map((email) => ({ email })),
          skipDuplicates: true,
        });

        results.added = emailsToAdd.length;
        results.details.added = emailsToAdd;
      } catch (error: any) {
        console.error("Error al agregar emails en lote:", error);
        results.errors = emailsToAdd.length;
        results.details.errors = emailsToAdd.map((email) => ({
          email,
          error: "Error al agregar a la base de datos",
        }));
      }
    }

    results.skipped =
      alreadyAuthorized.length + alreadyRegistered.length + results.errors;

    const message = `Procesados ${results.total} emails: ${results.added} agregados, ${results.skipped} omitidos`;

    return NextResponse.json(
      {
        success: true,
        message,
        results,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en procesamiento en lote de emails:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar múltiples correos autorizados en lote (solo SUPERADMIN)
export async function DELETE(req: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Solo SUPERADMIN puede eliminar correos autorizados.",
        },
        { status: 403 }
      );
    }

    const { emails } = await req.json();

    // Validar entrada
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de emails" },
        { status: 400 }
      );
    }

    // Limpiar emails
    const cleanEmails = emails
      .map((email) => email?.toString().toLowerCase().trim())
      .filter((email) => email && email.includes("@"));

    if (cleanEmails.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron emails válidos" },
        { status: 400 }
      );
    }

    // Verificar cuáles están autorizados y cuáles han sido usados
    const authorizedEmails = await prisma.authorizedEmail.findMany({
      where: { email: { in: cleanEmails } },
    });

    const usedEmails = authorizedEmails.filter((e) => e.accountId !== null);
    const unusedEmails = authorizedEmails.filter((e) => e.accountId === null);

    // Solo eliminar los no usados
    const emailsToDelete = unusedEmails.map((e) => e.email);

    let deletedCount = 0;
    if (emailsToDelete.length > 0) {
      const deleteResult = await prisma.authorizedEmail.deleteMany({
        where: {
          email: { in: emailsToDelete },
          accountId: null, // Solo eliminar los no usados
        },
      });
      deletedCount = deleteResult.count;
    }

    const results = {
      total: cleanEmails.length,
      deleted: deletedCount,
      skipped: cleanEmails.length - deletedCount,
      details: {
        deleted: emailsToDelete,
        used: usedEmails.map((e) => e.email),
        notFound: cleanEmails.filter(
          (email) => !authorizedEmails.find((e) => e.email === email)
        ),
      },
    };

    const message = `Procesados ${results.total} emails: ${results.deleted} eliminados, ${results.skipped} omitidos`;

    return NextResponse.json({
      success: true,
      message,
      results,
    });
  } catch (error: any) {
    console.error("Error en eliminación en lote de emails:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
