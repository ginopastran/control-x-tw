import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";
import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    // Obtener datos del cuerpo de la solicitud
    const { name, email, password } = await req.json();

    // Validar datos
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Verificar si el email ya está registrado
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Verificar si es el primer usuario (será SUPERADMIN)
    const usersCount = await prisma.user.count();
    let userRole: UserRole = UserRole.ADMIN;
    let authorizedEmail = null;

    if (usersCount === 0) {
      // Primera cuenta = SUPERADMIN (sin restricciones)
      userRole = UserRole.SUPERADMIN;
      console.log("🔐 Creando primera cuenta como SUPERADMIN:", email);
    } else {
      // A partir de la segunda cuenta, verificar que el email esté autorizado
      authorizedEmail = await prisma.authorizedEmail.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Verificar que el email exista y que no esté ya vinculado a una cuenta
      if (!authorizedEmail || authorizedEmail.accountId) {
        return NextResponse.json(
          {
            error:
              "Este correo electrónico no está autorizado o ya ha sido utilizado para registrar una cuenta. Contacta al administrador.",
          },
          { status: 403 }
        );
      }
      // El rol se mantiene como ADMIN por defecto
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    // Si se usó un email autorizado, vincularlo al usuario creado
    if (authorizedEmail) {
      await prisma.authorizedEmail.update({
        where: { id: authorizedEmail.id },
        data: {
          accountId: user.id,
        },
      });
    }

    // Generar token
    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Crear respuesta
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message:
          usersCount === 0
            ? "Cuenta de SUPERADMIN creada exitosamente"
            : "Cuenta de ADMIN creada exitosamente",
      },
      { status: 201 }
    );

    // Establecer cookie
    return setAuthCookieInResponse(response, token);
  } catch (error: any) {
    console.error("Error al registrar usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
