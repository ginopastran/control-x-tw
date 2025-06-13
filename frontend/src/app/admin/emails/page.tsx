"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Spinner,
  Textarea,
  Tabs,
  Tab,
} from "@heroui/react";
import EmailSuggestions from "@/components/admin/EmailSuggestions";

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

export default function AuthorizedEmailsPage() {
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isBulkOpen,
    onOpen: onBulkOpen,
    onOpenChange: onBulkOpenChange,
  } = useDisclosure();
  const {
    isOpen: isDeleteAllOpen,
    onOpen: onDeleteAllOpen,
    onOpenChange: onDeleteAllOpenChange,
  } = useDisclosure();

  const router = useRouter();

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/authorized-emails");

      if (response.status === 403) {
        router.push("/dashboard");
        return;
      }

      if (!response.ok) {
        throw new Error("Error al cargar emails autorizados");
      }

      const data: AuthorizedEmailsResponse = await response.json();
      setEmails(data.authorizedEmails);
    } catch (err) {
      setError("Error al cargar emails autorizados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      setError("El email es obligatorio");
      return;
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError("Formato de email inválido");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch("/api/authorized-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al autorizar email");
      }

      setSuccess("Email autorizado exitosamente");
      setNewEmail("");
      onOpenChange();
      await fetchEmails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkEmails.trim()) {
      setError("Ingresa al menos un email");
      return;
    }

    const emailList = bulkEmails
      .split("\n")
      .map((email) => email.trim())
      .filter((email) => email);

    // Validar cada email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      setError(`Emails inválidos: ${invalidEmails.join(", ")}`);
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      let addedCount = 0;
      let errorCount = 0;
      let errors: string[] = [];

      for (const email of emailList) {
        try {
          const response = await fetch("/api/authorized-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          if (response.ok) {
            addedCount++;
          } else {
            const data = await response.json();
            errorCount++;
            errors.push(`${email}: ${data.error}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`${email}: Error de conexión`);
        }
      }

      if (addedCount > 0) {
        setSuccess(`${addedCount} email(s) autorizado(s) exitosamente`);
      }

      if (errorCount > 0) {
        setError(
          `${errorCount} error(es): ${errors.slice(0, 3).join(", ")}${
            errors.length > 3 ? "..." : ""
          }`
        );
      }

      setBulkEmails("");
      onBulkOpenChange();
      await fetchEmails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmail = async (id: string) => {
    if (!confirm("¿Estás seguro que deseas eliminar este email autorizado?")) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/authorized-emails/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar email");
      }

      setSuccess("Email eliminado exitosamente");
      await fetchEmails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllUnused = async () => {
    try {
      setSubmitting(true);
      const response = await fetch("/api/authorized-emails/batch", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar emails");
      }

      setSuccess(data.message);
      onDeleteAllOpenChange();
      await fetchEmails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const getStats = () => {
    const total = emails.length;
    const used = emails.filter((email) => email.used).length;
    const unused = total - used;
    return { total, used, unused };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Cargando emails autorizados..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Emails Autorizados</h1>
          <p className="text-default-500 mt-2">
            Gestiona los emails autorizados para registrarse en el sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button color="secondary" variant="flat" onPress={onBulkOpen}>
            Agregar Múltiples
          </Button>
          <Button color="primary" onPress={onOpen}>
            Autorizar Email
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-small text-default-500">Total Autorizados</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-success">{stats.used}</div>
            <div className="text-small text-default-500">Usados</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-warning">
              {stats.unused}
            </div>
            <div className="text-small text-default-500">Disponibles</div>
          </CardBody>
        </Card>
      </div>

      {/* Mensajes */}
      {error && (
        <Card className="mb-6 border-danger-200 bg-danger-50">
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-danger">
                <svg
                  className="h-5 w-5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={clearMessages}
              >
                ×
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {success && (
        <Card className="mb-6 border-success-200 bg-success-50">
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-success">
                <svg
                  className="h-5 w-5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {success}
              </div>
              <Button
                size="sm"
                variant="light"
                color="success"
                onPress={clearMessages}
              >
                ×
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Acciones en lote */}
      {stats.unused > 0 && (
        <div className="mb-6">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Acciones en Lote</h3>
                  <p className="text-small text-default-500">
                    Gestiona múltiples emails autorizados a la vez
                  </p>
                </div>
                <Button color="danger" variant="flat" onPress={onDeleteAllOpen}>
                  Eliminar Todos los No Usados
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Tabla de emails */}
      {emails.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-default-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-medium mb-2">
              No hay emails autorizados
            </h3>
            <p className="text-default-500 mb-6">
              Comienza autorizando el primer email para que los usuarios puedan
              registrarse.
            </p>
            <Button color="primary" onPress={onOpen}>
              Autorizar Primer Email
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Table aria-label="Emails autorizados">
          <TableHeader>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>AUTORIZADO POR</TableColumn>
            <TableColumn>FECHA</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn>USADO POR</TableColumn>
            <TableColumn>ACCIONES</TableColumn>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell>
                  <div className="font-medium">{email.email}</div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{email.authorizedBy.name}</div>
                    <div className="text-small text-default-500">
                      {email.authorizedBy.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-small">
                    {new Date(email.authorizedAt).toLocaleDateString()}
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
                  {email.used && email.usedBy ? (
                    <div>
                      <div className="font-medium">{email.usedBy.name}</div>
                      <div className="text-small text-default-500">
                        {email.usedAt &&
                          new Date(email.usedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <span className="text-default-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {!email.used && (
                      <Tooltip content="Eliminar email autorizado">
                        <Button
                          isIconOnly
                          size="sm"
                          color="danger"
                          variant="light"
                          onPress={() => handleDeleteEmail(email.id)}
                          isLoading={deletingId === email.id}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal para agregar email individual */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Autorizar Nuevo Email
              </ModalHeader>
              <ModalBody>
                <Tabs aria-label="Opciones de autorización">
                  <Tab key="manual" title="Manual">
                    <div className="space-y-4">
                      <Input
                        label="Email"
                        placeholder="usuario@ejemplo.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleAddEmail()
                        }
                        type="email"
                        isRequired
                      />
                      <p className="text-small text-default-500">
                        El usuario podrá registrarse usando este email.
                      </p>
                    </div>
                  </Tab>
                  <Tab key="suggestions" title="Sugerencias">
                    <EmailSuggestions
                      onSelectEmail={(email) => {
                        setNewEmail(email);
                      }}
                    />
                  </Tab>
                </Tabs>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={handleAddEmail}
                  isLoading={submitting}
                  isDisabled={!newEmail.trim()}
                >
                  Autorizar Email
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal para agregar múltiples emails */}
      <Modal isOpen={isBulkOpen} onOpenChange={onBulkOpenChange} size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Autorizar Múltiples Emails
              </ModalHeader>
              <ModalBody>
                <Textarea
                  label="Emails (uno por línea)"
                  placeholder={`usuario1@ejemplo.com\nusuario2@ejemplo.com\nusuario3@ejemplo.com`}
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  minRows={6}
                  maxRows={10}
                />
                <p className="text-small text-default-500">
                  Ingresa un email por línea. Todos los emails válidos serán
                  autorizados.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={handleBulkAdd}
                  isLoading={submitting}
                >
                  Autorizar Todos
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal para confirmar eliminación masiva */}
      <Modal isOpen={isDeleteAllOpen} onOpenChange={onDeleteAllOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-danger">
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Confirmar Eliminación
                </div>
              </ModalHeader>
              <ModalBody>
                <p>
                  ¿Estás seguro que deseas eliminar todos los emails autorizados
                  que <strong>no han sido usados</strong>?
                </p>
                <p className="text-small text-default-500">
                  Se eliminarán {stats.unused} email(s) no usado(s). Esta acción
                  no se puede deshacer.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="danger"
                  onPress={handleDeleteAllUnused}
                  isLoading={submitting}
                >
                  Eliminar Todos los No Usados
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
