"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Spinner,
  Avatar,
  Divider,
  Link,
  Breadcrumbs,
  BreadcrumbItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip,
  Badge,
} from "@heroui/react";

interface XAccount {
  _id: string;
  username: string;
  userId: string;
  developerTag: string;
  labels: string[];
  createdAt: string;
  useOwnCredentials: boolean;
  credentialsVerified: boolean;
  preferOAuth2: boolean;
  userAppName?: string;
  userDeveloperEmail?: string;
  appCreatedAt?: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;

  // Indicadores de credenciales OAuth 1.0a
  hasOwnApiKey: boolean;
  hasOwnApiSecret: boolean;
  hasOwnBearerToken: boolean;
  hasOwnAccessToken: boolean;
  hasOwnAccessTokenSecret: boolean;

  // Indicadores de credenciales OAuth 2.0
  hasOwnClientId: boolean;
  hasOwnClientSecret: boolean;
  hasOwnOAuth2AccessToken: boolean;
  hasOwnOAuth2RefreshToken: boolean;
  oauth2TokenExpiresAt?: string;
  oauth2Scopes: string[];
}

export default function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Usar React.use() para unwrap la Promise
  const { id } = use(params);

  const [account, setAccount] = useState<XAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [developerTag, setDeveloperTag] = useState("");
  const [saving, setSaving] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await fetch(`/api/accounts/${id}`);
        if (!response.ok) {
          throw new Error("Error al cargar la cuenta");
        }
        const data = await response.json();
        setAccount(data.account);
        setLabels(data.account.labels || []);
        setDeveloperTag(data.account.developerTag || "");
      } catch (err) {
        setError("Error al cargar la cuenta. Intente nuevamente.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [id]);

  const handleAddLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()]);
      setNewLabel("");
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setLabels(labels.filter((label) => label !== labelToRemove));
  };

  const handleSave = async () => {
    if (!account) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labels,
          developerTag,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar los cambios");
      }

      router.push("/accounts");
    } catch (err) {
      setError("Error al guardar los cambios. Intente nuevamente.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la cuenta");
      }

      router.push("/accounts");
    } catch (err) {
      setError("Error al eliminar la cuenta. Intente nuevamente.");
      console.error(err);
    }
  };

  const getCredentialStatus = () => {
    if (!account) return { type: "none", count: 0, status: "Sin configurar" };

    if (account.useOwnCredentials) {
      if (account.preferOAuth2) {
        const oauth2Count = [
          account.hasOwnClientId,
          account.hasOwnClientSecret,
          account.hasOwnOAuth2AccessToken,
          account.hasOwnOAuth2RefreshToken,
        ].filter(Boolean).length;

        return {
          type: "oauth2",
          count: oauth2Count,
          status:
            oauth2Count > 0
              ? `OAuth 2.0 (${oauth2Count} credenciales)`
              : "OAuth 2.0 - Sin configurar",
        };
      } else {
        const oauth1Count = [
          account.hasOwnApiKey,
          account.hasOwnApiSecret,
          account.hasOwnBearerToken,
          account.hasOwnAccessToken,
          account.hasOwnAccessTokenSecret,
        ].filter(Boolean).length;

        return {
          type: "oauth1",
          count: oauth1Count,
          status:
            oauth1Count > 0
              ? `OAuth 1.0a (${oauth1Count} credenciales)`
              : "OAuth 1.0a - Sin configurar",
        };
      }
    }

    return {
      type: "shared",
      count: 0,
      status: "Credenciales compartidas",
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Cargando cuenta..." />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="text-lg font-medium mb-2">Cuenta no encontrada</h3>
            <p className="text-default-500 mb-6">
              La cuenta que buscas no existe o fue eliminada.
            </p>
            <Button
              color="primary"
              onPress={() => router.push("/accounts")}
              startContent={
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              }
            >
              Volver a Cuentas
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const credentialStatus = getCredentialStatus();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs className="mb-6">
        <BreadcrumbItem onPress={() => router.push("/accounts")}>
          Cuentas
        </BreadcrumbItem>
        <BreadcrumbItem>@{account.username}</BreadcrumbItem>
      </Breadcrumbs>

      {error && (
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center text-danger">
              <svg
                className="h-5 w-5 mr-3"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Header de la cuenta */}
      <Card className="mb-6">
        <CardHeader className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Avatar
              name={account.username[0].toUpperCase()}
              size="lg"
              className="text-large"
            />
            <div>
              <h1 className="text-2xl font-bold">@{account.username}</h1>
              <p className="text-default-500">
                Editar información de la cuenta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Ver tweets programados">
              <Button
                variant="flat"
                color="secondary"
                startContent={
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                }
                onPress={() => router.push(`/tweets?accountId=${id}`)}
              >
                Tweets
              </Button>
            </Tooltip>
            <Button
              variant="flat"
              startContent={
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              }
              onPress={() => router.push("/accounts")}
            >
              Volver
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Información de la cuenta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {account.userId}
              </div>
              <div className="text-small text-default-500">ID de Usuario</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {labels.length}
              </div>
              <div className="text-small text-default-500">Etiquetas</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">
                {new Date(account.createdAt).toLocaleDateString()}
              </div>
              <div className="text-small text-default-500">Conectado</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Estado de credenciales */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <h2 className="text-xl font-semibold">🔐 Credenciales de API</h2>
            <Button
              color="primary"
              variant="flat"
              onPress={() => router.push(`/accounts/${id}/api-keys`)}
              startContent={
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              }
            >
              Configurar Credenciales
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {/* Estado general */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Tipo de Autenticación</h3>
                <p className="text-small text-default-500">
                  {credentialStatus.status}
                </p>
              </div>
              <Chip
                color={
                  credentialStatus.type === "oauth2"
                    ? "success"
                    : credentialStatus.type === "oauth1"
                    ? "warning"
                    : "default"
                }
                variant="flat"
              >
                {credentialStatus.type === "oauth2"
                  ? "OAuth 2.0"
                  : credentialStatus.type === "oauth1"
                  ? "OAuth 1.0a"
                  : "Compartidas"}
              </Chip>
            </div>

            {account.useOwnCredentials && (
              <>
                <Divider />

                {/* Información de la app */}
                {account.userAppName && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-default-700">
                        Nombre de la App
                      </h4>
                      <p className="text-sm text-default-500">
                        {account.userAppName}
                      </p>
                    </div>
                    {account.userDeveloperEmail && (
                      <div>
                        <h4 className="text-sm font-medium text-default-700">
                          Email de Desarrollador
                        </h4>
                        <p className="text-sm text-default-500">
                          {account.userDeveloperEmail}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Divider />

                {/* Detalle de credenciales */}
                <div>
                  <h4 className="text-sm font-medium text-default-700 mb-3">
                    Estado de Credenciales
                  </h4>

                  {account.preferOAuth2 ? (
                    // OAuth 2.0 credentials
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnClientId
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Client ID</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnClientSecret
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Client Secret</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnOAuth2AccessToken
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Access Token</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnOAuth2RefreshToken
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Refresh Token</span>
                      </div>
                    </div>
                  ) : (
                    // OAuth 1.0a credentials
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnApiKey
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">API Key</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnApiSecret
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">API Secret</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnBearerToken
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Bearer Token</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnAccessToken
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Access Token</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.hasOwnAccessTokenSecret
                              ? "bg-success"
                              : "bg-default-300"
                          }`}
                        />
                        <span className="text-xs">Access Secret</span>
                      </div>
                    </div>
                  )}

                  {/* OAuth 2.0 scopes */}
                  {account.preferOAuth2 && account.oauth2Scopes.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-medium text-default-700 mb-2">
                        Scopes OAuth 2.0
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {account.oauth2Scopes.map((scope) => (
                          <Chip
                            key={scope}
                            size="sm"
                            variant="flat"
                            color="primary"
                          >
                            {scope}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Token expiration */}
                  {account.oauth2TokenExpiresAt && (
                    <div className="mt-4">
                      <h5 className="text-xs font-medium text-default-700">
                        Expiración del Token
                      </h5>
                      <p className="text-xs text-default-500">
                        {new Date(
                          account.oauth2TokenExpiresAt
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Formulario de edición */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Configuración de la Cuenta</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Campo de desarrollador */}
          <div>
            <Input
              label="Cuenta de Desarrollador"
              placeholder="Etiqueta de cuenta desarrollador"
              value={developerTag}
              onValueChange={setDeveloperTag}
              description="Identifica qué cuenta de desarrollador de Twitter se usa para esta cuenta"
              startContent={
                <svg
                  className="w-4 h-4 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              }
            />
          </div>

          <Divider />

          {/* Gestión de etiquetas */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Etiquetas</h3>
              <p className="text-small text-default-500">
                Organiza tus cuentas con etiquetas personalizadas
              </p>
            </div>

            {/* Etiquetas existentes */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {labels.map((label, index) => (
                  <Chip
                    key={index}
                    size="md"
                    variant="flat"
                    color="primary"
                    onClose={() => handleRemoveLabel(label)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            )}

            {/* Agregar nueva etiqueta */}
            <div className="flex gap-2">
              <Input
                placeholder="Nueva etiqueta"
                value={newLabel}
                onValueChange={setNewLabel}
                onKeyPress={(e) => e.key === "Enter" && handleAddLabel()}
                className="flex-1"
              />
              <Button
                color="primary"
                onPress={handleAddLabel}
                isDisabled={
                  !newLabel.trim() || labels.includes(newLabel.trim())
                }
                startContent={
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Añadir
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Zona de peligro */}
      <Card className="border-danger-200">
        <CardHeader>
          <h2 className="text-xl font-semibold text-danger">Zona de Peligro</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-danger">Eliminar cuenta</h3>
              <p className="text-small text-default-500">
                Esta acción no se puede deshacer. Se eliminarán todos los datos
                asociados.
              </p>
            </div>
            <Button
              color="danger"
              variant="bordered"
              onPress={onOpen}
              startContent={
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
              }
            >
              Eliminar Cuenta
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3 mt-6">
        <Button
          variant="flat"
          onPress={() => router.push("/accounts")}
          startContent={
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        >
          Cancelar
        </Button>
        <Button
          color="primary"
          onPress={handleSave}
          isLoading={saving}
          startContent={
            !saving && (
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )
          }
        >
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      {/* Modal de confirmación de eliminación */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2 text-danger">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Confirmar eliminación
            </div>
          </ModalHeader>
          <ModalBody>
            <p>
              ¿Estás seguro que deseas eliminar la cuenta{" "}
              <span className="font-bold">@{account.username}</span>?
            </p>
            <p className="text-small text-default-500">
              Esta acción no se puede deshacer y se eliminarán todos los datos
              asociados incluyendo tweets programados y configuraciones.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancelar
            </Button>
            <Button color="danger" onPress={handleDeleteAccount}>
              Eliminar Cuenta
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
