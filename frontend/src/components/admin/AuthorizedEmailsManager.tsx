"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Tooltip,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody,
  Divider,
} from "@heroui/react";

interface AuthorizedEmail {
  id: string;
  email: string;
  authorizedBy: {
    name: string;
    email: string;
  };
  authorizedAt: string;
  used: boolean;
  usedBy?: {
    name: string;
    email: string;
  };
  usedAt?: string;
  createdAt: string;
}

interface AuthorizedEmailsResponse {
  success: boolean;
  authorizedEmails: AuthorizedEmail[];
}

export default function AuthorizedEmailsManager() {
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>(
    []
  );
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Cargar correos autorizados
  const fetchAuthorizedEmails = async () => {
    try {
      setIsLoadingData(true);
      const response = await fetch("/api/authorized-emails");
      const data: AuthorizedEmailsResponse = await response.json();

      if (data.success) {
        setAuthorizedEmails(data.authorizedEmails);
      } else {
        console.error("Error al cargar correos autorizados:", data);
      }
    } catch (error) {
      console.error("Error al cargar correos autorizados:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Agregar nuevo correo autorizado
  const handleAddEmail = async () => {
    if (!newEmail.trim()) return;

    try {
      setIsLoading(true);
      const response = await fetch("/api/authorized-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setNewEmail("");
        onClose();
        await fetchAuthorizedEmails(); // Recargar la lista
        alert("Email autorizado exitosamente");
      } else {
        alert(data.error || "Error al autorizar email");
      }
    } catch (error) {
      console.error("Error al autorizar email:", error);
      alert("Error al autorizar email");
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar correo autorizado
  const handleDeleteEmail = async (id: string, email: string) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar la autorización para ${email}?`
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/authorized-emails/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        await fetchAuthorizedEmails(); // Recargar la lista
        alert("Autorización eliminada exitosamente");
      } else {
        alert(data.error || "Error al eliminar autorización");
      }
    } catch (error) {
      console.error("Error al eliminar autorización:", error);
      alert("Error al eliminar autorización");
    } finally {
      setDeletingId(null);
    }
  };

  // Eliminar todos los correos no usados
  const handleDeleteAllUnused = async () => {
    if (unusedEmails.length === 0) {
      alert("No hay correos autorizados disponibles para eliminar");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar TODOS los ${unusedEmails.length} correos autorizados no usados?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/authorized-emails/batch", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        await fetchAuthorizedEmails(); // Recargar la lista
        alert(data.message);
      } else {
        alert(data.error || "Error al eliminar autorizaciones");
      }
    } catch (error) {
      console.error("Error al eliminar autorizaciones:", error);
      alert("Error al eliminar autorizaciones");
    } finally {
      setIsLoading(false);
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    fetchAuthorizedEmails();
  }, []);

  const unusedEmails = authorizedEmails.filter((email) => !email.used);
  const usedEmails = authorizedEmails.filter((email) => email.used);

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {unusedEmails.length}
            </p>
            <p className="text-sm text-default-500">Correos Disponibles</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {usedEmails.length}
            </p>
            <p className="text-sm text-default-500">Correos Usados</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {authorizedEmails.length}
            </p>
            <p className="text-sm text-default-500">Total Autorizados</p>
          </CardBody>
        </Card>
      </div>

      {/* Botón para agregar nuevo email */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Gestión de Correos Autorizados
        </h3>
        <div className="flex gap-2">
          {unusedEmails.length > 0 && (
            <Button
              color="danger"
              variant="light"
              onPress={handleDeleteAllUnused}
              isLoading={isLoading}
              size="sm"
            >
              Eliminar Todos No Usados ({unusedEmails.length})
            </Button>
          )}
          <Button color="primary" onPress={onOpen}>
            + Autorizar Nuevo Email
          </Button>
        </div>
      </div>

      <Divider />

      {/* Tabla de correos autorizados */}
      <Table aria-label="Tabla de correos autorizados" isStriped>
        <TableHeader>
          <TableColumn>EMAIL</TableColumn>
          <TableColumn>ESTADO</TableColumn>
          <TableColumn>AUTORIZADO POR</TableColumn>
          <TableColumn>FECHA AUTORIZACIÓN</TableColumn>
          <TableColumn>USADO POR</TableColumn>
          <TableColumn>FECHA USO</TableColumn>
          <TableColumn>ACCIONES</TableColumn>
        </TableHeader>
        <TableBody
          items={authorizedEmails}
          isLoading={isLoadingData}
          loadingContent="Cargando..."
        >
          {(email) => (
            <TableRow key={email.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{email.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  color={email.used ? "success" : "warning"}
                  variant="flat"
                  size="sm"
                >
                  {email.used ? "Usado" : "Disponible"}
                </Chip>
              </TableCell>
              <TableCell>
                <Tooltip content={email.authorizedBy.email}>
                  <span className="text-sm">{email.authorizedBy.name}</span>
                </Tooltip>
              </TableCell>
              <TableCell>
                <span className="text-sm text-default-500">
                  {formatDate(email.authorizedAt)}
                </span>
              </TableCell>
              <TableCell>
                {email.usedBy ? (
                  <Tooltip content={email.usedBy.email}>
                    <span className="text-sm">{email.usedBy.name}</span>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-default-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {email.usedAt ? (
                  <span className="text-sm text-default-500">
                    {formatDate(email.usedAt)}
                  </span>
                ) : (
                  <span className="text-sm text-default-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {!email.used ? (
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => handleDeleteEmail(email.id, email.email)}
                    isLoading={deletingId === email.id}
                    isDisabled={deletingId !== null}
                  >
                    {deletingId === email.id ? "..." : "Eliminar"}
                  </Button>
                ) : (
                  <Tooltip content="No se puede eliminar un correo ya utilizado">
                    <span className="text-sm text-default-300">
                      Sin acciones
                    </span>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Modal para agregar nuevo email */}
      <Modal isOpen={isOpen} onClose={onClose} placement="top-center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Autorizar Nuevo Email
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-4">
              Solo los correos autorizados podrán crear cuentas en el sistema.
            </p>
            <Input
              label="Correo Electrónico"
              placeholder="usuario@ejemplo.com"
              type="email"
              value={newEmail}
              onValueChange={setNewEmail}
              autoFocus
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleAddEmail}
              isLoading={isLoading}
              isDisabled={!newEmail.trim()}
            >
              Autorizar Email
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
