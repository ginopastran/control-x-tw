"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  Spinner,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Badge,
  Tooltip,
  Input,
  Checkbox,
  CheckboxGroup,
  ScrollShadow,
  Progress,
} from "@heroui/react";

interface XAccount {
  _id: string;
  username: string;
  userId: string;
  developerTag: string;
  labels: string[];
  createdAt: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  needsReauth: boolean;
  useOwnCredentials?: boolean;
  credentialsVerified?: boolean;
  userAppName?: string;
  appCreatedAt?: string;
  tokenInfo?: {
    isValid: boolean;
    expiresAt: string;
    lastRefresh: string;
    hoursToExpiry: number | null;
    status: "VALID" | "NEEDS_REFRESH" | "EXPIRED" | "INVALID";
  };
}

interface DebugData {
  stats: {
    total: number;
    valid: number;
    needsRefresh: number;
    expired: number;
    invalid: number;
    needsReauth: number;
  };
  accounts: XAccount[];
}

interface RateLimitData {
  // Add appropriate properties for RateLimitData
}

interface TestResult {
  accountId: string;
  username: string;
  status: "success" | "error" | "warning";
  message: string;
  details: {
    hasTokens: boolean;
    tokenValid: boolean;
    apiAccess: boolean;
    rateLimitStatus?: string;
    lastError?: string;
  };
}

interface TestResponse {
  success: boolean;
  summary: {
    total: number;
    success: number;
    warnings: number;
    errors: number;
  };
  results: TestResult[];
  testedAt: string;
}

export default function AccountsPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<XAccount | null>(null);
  const [rateLimitData, setRateLimitData] = useState<RateLimitData | null>(
    null
  );
  const [loadingRateLimits, setLoadingRateLimits] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [labelsToDelete, setLabelsToDelete] = useState<string[]>([]);
  const [deletingLabels, setDeletingLabels] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [testingAccounts, setTestingAccounts] = useState(false);
  const [testProgress, setTestProgress] = useState(0);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isConnectionTypeOpen,
    onOpen: onConnectionTypeOpen,
    onClose: onConnectionTypeClose,
  } = useDisclosure();
  const {
    isOpen: isLabelsModalOpen,
    onOpen: onLabelsModalOpen,
    onClose: onLabelsModalClose,
  } = useDisclosure();
  const {
    isOpen: isTestModalOpen,
    onOpen: onTestModalOpen,
    onClose: onTestModalClose,
  } = useDisclosure();
  const router = useRouter();

  useEffect(() => {
    fetchAccountsData();
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (debugData) {
      // Extraer todas las etiquetas únicas
      const allLabels = new Set<string>();
      debugData.accounts.forEach((account) => {
        account.labels.forEach((label) => allLabels.add(label));
      });
      setAvailableLabels(Array.from(allLabels).sort());
    }
  }, [debugData]);

  const fetchAccountsData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/accounts");
      if (!response.ok) {
        throw new Error("Error al cargar las cuentas");
      }
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError("Error al cargar las cuentas. Intente nuevamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.user?.role || null);
      }
    } catch (err) {
      console.error("Error al obtener rol del usuario:", err);
    }
  };

  const handleAddAccount = () => {
    onConnectionTypeOpen();
  };

  const handleOAuthConnection = () => {
    onConnectionTypeClose();
    router.push("/api/auth/x/login");
  };

  const handleApiKeysConnection = () => {
    onConnectionTypeClose();
    router.push("/accounts/new/api-keys");
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm("¿Estás seguro que deseas eliminar esta cuenta?")) {
      try {
        const response = await fetch(`/api/accounts/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Error al eliminar la cuenta");
        }

        await fetchAccountsData();
      } catch (err) {
        setError("Error al eliminar la cuenta. Intente nuevamente.");
        console.error(err);
      }
    }
  };

  const handleInvalidateToken = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/invalidate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Error al invalidar el token");
      }

      await fetchAccountsData();
      onClose();
    } catch (err) {
      setError("Error al invalidar el token. Intente nuevamente.");
      console.error(err);
    }
  };

  const handleBulkDeleteLabels = async () => {
    if (labelsToDelete.length === 0) {
      setError("Selecciona al menos una etiqueta para eliminar");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro que deseas eliminar las etiquetas: ${labelsToDelete.join(
          ", "
        )}?`
      )
    ) {
      return;
    }

    try {
      setDeletingLabels(true);
      const response = await fetch("/api/accounts/bulk-delete-labels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ labels: labelsToDelete }),
      });

      if (!response.ok) {
        throw new Error("Error al eliminar las etiquetas");
      }

      await fetchAccountsData();
      setLabelsToDelete([]);
      onLabelsModalClose();
    } catch (err) {
      setError("Error al eliminar las etiquetas. Intente nuevamente.");
      console.error(err);
    } finally {
      setDeletingLabels(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VALID":
        return "success";
      case "NEEDS_REFRESH":
        return "warning";
      case "EXPIRED":
        return "danger";
      case "INVALID":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "VALID":
        return "Válido";
      case "NEEDS_REFRESH":
        return "Necesita Refresh";
      case "EXPIRED":
        return "Expirado";
      case "INVALID":
        return "Inválido";
      default:
        return "Desconocido";
    }
  };

  const checkRateLimits = async (accountId: string) => {
    try {
      setLoadingRateLimits(true);
      const response = await fetch(
        `/api/debug/rate-limits?accountId=${accountId}`
      );
      if (!response.ok) {
        throw new Error("Error al verificar rate limits");
      }
      const data = await response.json();
      setRateLimitData(data);
    } catch (err) {
      setError("Error al verificar rate limits. Intente nuevamente.");
      console.error(err);
    } finally {
      setLoadingRateLimits(false);
    }
  };

  const handleConfigureApiKeys = (account: XAccount) => {
    router.push(`/accounts/${account._id}/api-keys`);
  };

  const handleReconnectAccount = (accountId: string) => {
    router.push(`/api/auth/x/login?accountId=${accountId}`);
  };

  const handleTestAccounts = async (accountIds?: string[]) => {
    try {
      setTestingAccounts(true);
      setTestProgress(0);

      const response = await fetch("/api/accounts/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountIds }),
      });

      if (!response.ok) {
        throw new Error("Error al testear las cuentas");
      }

      const data = await response.json();
      setTestResults(data);
      setTestProgress(100);
    } catch (err) {
      setError("Error al testear las cuentas. Intente nuevamente.");
      console.error(err);
    } finally {
      setTestingAccounts(false);
    }
  };

  // Verificar si el usuario es ADMIN (no SUPERADMIN) y ocultar la página
  if (userRole === "ADMIN") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-warning mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
            <p className="text-default-500 mb-6">
              Esta página solo está disponible para usuarios SUPERADMIN.
            </p>
            <Button color="primary" onPress={() => router.push("/dashboard")}>
              Ir al Dashboard
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Cargando cuentas..." />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cuentas de X Conectadas</h1>
          <p className="text-default-500 mt-2">
            Gestiona tus cuentas conectadas y su estado de autenticación
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            color="secondary"
            variant="flat"
            onPress={onLabelsModalOpen}
            startContent={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            }
          >
            Gestionar Etiquetas
          </Button>
          {userRole === "SUPERADMIN" && (
            <Button
              color="warning"
              variant="flat"
              onPress={onTestModalOpen}
              isLoading={testingAccounts}
              startContent={
                !testingAccounts && (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )
              }
            >
              {testingAccounts ? "Testeando..." : "Testear Cuentas"}
            </Button>
          )}
          <Button
            color="primary"
            size="lg"
            onPress={handleAddAccount}
            startContent={
              <svg
                className="w-5 h-5"
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
            Conectar Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      {debugData && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-primary">
                {debugData.stats.total}
              </div>
              <div className="text-small text-default-500">Total</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-success">
                {debugData.stats.valid}
              </div>
              <div className="text-small text-default-500">Válidas</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-warning">
                {debugData.stats.needsRefresh}
              </div>
              <div className="text-small text-default-500">Refresh</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-danger">
                {debugData.stats.expired}
              </div>
              <div className="text-small text-default-500">Expiradas</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-danger">
                {debugData.stats.invalid}
              </div>
              <div className="text-small text-default-500">Inválidas</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-secondary">
                {debugData.stats.needsReauth}
              </div>
              <div className="text-small text-default-500">Re-auth</div>
            </CardBody>
          </Card>
        </div>
      )}

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

      {/* Tabla de cuentas */}
      {debugData && debugData.accounts.length === 0 ? (
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
            <h3 className="text-lg font-medium mb-2">
              No hay cuentas conectadas
            </h3>
            <p className="text-default-500 mb-6">
              Comienza conectando tu primera cuenta de X.
            </p>
            <Button color="primary" onPress={handleAddAccount}>
              Conectar Nueva Cuenta
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table
            aria-label="Cuentas de X conectadas"
            className="min-w-full"
            classNames={{
              wrapper: "shadow-lg",
              table: "min-w-[1200px]",
            }}
          >
            <TableHeader>
              <TableColumn className="w-[200px]">CUENTA</TableColumn>
              <TableColumn className="w-[120px]">DESARROLLADOR</TableColumn>
              <TableColumn className="w-[120px]">ESTADO TOKEN</TableColumn>
              <TableColumn className="w-[150px]">EXPIRACIÓN</TableColumn>
              <TableColumn className="w-[300px]">ETIQUETAS</TableColumn>
              <TableColumn className="w-[200px]">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody>
              {(debugData?.accounts || []).map((account) => (
                <TableRow key={account._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={account.username[0].toUpperCase()}
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          @{account.username}
                        </div>
                        <div className="text-small text-default-500 truncate">
                          {account.userId}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-small truncate">
                      {account.developerTag}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {account.tokenInfo ? (
                        <>
                          <Chip
                            color={getStatusColor(account.tokenInfo.status)}
                            size="sm"
                            variant="flat"
                          >
                            {getStatusText(account.tokenInfo.status)}
                          </Chip>
                          {account.needsReauth && (
                            <Chip color="danger" size="sm" variant="bordered">
                              Necesita Re-auth
                            </Chip>
                          )}
                        </>
                      ) : (
                        <Chip color="default" size="sm">
                          Sin info
                        </Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.tokenInfo ? (
                      <div className="text-small">
                        {account.tokenInfo.hoursToExpiry !== null ? (
                          <div>
                            <div
                              className={`font-medium ${
                                account.tokenInfo.hoursToExpiry < 1
                                  ? "text-danger"
                                  : account.tokenInfo.hoursToExpiry < 24
                                  ? "text-warning"
                                  : "text-success"
                              }`}
                            >
                              {account.tokenInfo.hoursToExpiry > 0
                                ? `${account.tokenInfo.hoursToExpiry}h restantes`
                                : "Expirado"}
                            </div>
                            <div className="text-tiny text-default-400 truncate">
                              {new Date(
                                account.tokenInfo.expiresAt
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-default-400">Sin fecha</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-default-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      {(account.labels || []).length > 0 ? (
                        <ScrollShadow
                          className="max-h-[80px] overflow-y-auto"
                          hideScrollBar
                        >
                          <div className="flex flex-wrap gap-1">
                            {account.labels.slice(0, 6).map((label, index) => (
                              <Chip
                                key={index}
                                size="sm"
                                variant="flat"
                                color="primary"
                                className="text-xs"
                              >
                                {label}
                              </Chip>
                            ))}
                            {account.labels.length > 6 && (
                              <Chip
                                size="sm"
                                variant="bordered"
                                className="text-xs"
                              >
                                +{account.labels.length - 6} más
                              </Chip>
                            )}
                          </div>
                        </ScrollShadow>
                      ) : (
                        <span className="text-default-400 text-small">
                          Sin etiquetas
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Tooltip content="Ver detalles">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setSelectedAccount(account);
                            onOpen();
                          }}
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip
                        content={
                          account.useOwnCredentials
                            ? "Configurar API Keys propias"
                            : "Usar API Keys propias"
                        }
                      >
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color={
                            account.useOwnCredentials &&
                            account.credentialsVerified
                              ? "success"
                              : "warning"
                          }
                          onPress={() => handleConfigureApiKeys(account)}
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
                              d="M15 7a2 2 0 012 2m2 0v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h4m4 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2m4 0h2m-6 4v2a2 2 0 002 2h2a2 2 0 002-2v-2m-6 0h6"
                            />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Verificar Rate Limits">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="secondary"
                          isLoading={loadingRateLimits}
                          onPress={() => checkRateLimits(account._id)}
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
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Editar cuenta">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() =>
                            router.push(`/accounts/${account._id}`)
                          }
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Eliminar cuenta">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => handleDeleteAccount(account._id)}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de gestión de etiquetas */}
      <Modal isOpen={isLabelsModalOpen} onClose={onLabelsModalClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">Gestionar Etiquetas</h3>
              <p className="text-small text-default-500 font-normal">
                Selecciona las etiquetas que deseas eliminar de todas las
                cuentas
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            {availableLabels.length > 0 ? (
              <div className="space-y-4">
                <div className="text-small text-default-600">
                  Etiquetas disponibles ({availableLabels.length}):
                </div>
                <ScrollShadow className="max-h-[400px]">
                  <CheckboxGroup
                    value={labelsToDelete}
                    onValueChange={setLabelsToDelete}
                    orientation="vertical"
                    className="gap-2"
                  >
                    {availableLabels.map((label) => {
                      // Contar cuántas cuentas tienen esta etiqueta
                      const accountCount =
                        debugData?.accounts.filter((account) =>
                          account.labels.includes(label)
                        ).length || 0;

                      return (
                        <Checkbox key={label} value={label}>
                          <div className="flex items-center justify-between w-full">
                            <span>{label}</span>
                            <Chip size="sm" variant="flat" color="default">
                              {accountCount} cuenta
                              {accountCount !== 1 ? "s" : ""}
                            </Chip>
                          </div>
                        </Checkbox>
                      );
                    })}
                  </CheckboxGroup>
                </ScrollShadow>
                {labelsToDelete.length > 0 && (
                  <div className="p-3 bg-warning-50 rounded-lg border border-warning-200">
                    <div className="text-small text-warning-800">
                      <strong>Advertencia:</strong> Se eliminarán{" "}
                      {labelsToDelete.length} etiqueta
                      {labelsToDelete.length !== 1 ? "s" : ""} de todas las
                      cuentas que las contengan.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
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
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <p className="text-default-500">No hay etiquetas disponibles</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onLabelsModalClose}>
              Cancelar
            </Button>
            {labelsToDelete.length > 0 && (
              <Button
                color="danger"
                onPress={handleBulkDeleteLabels}
                isLoading={deletingLabels}
              >
                Eliminar {labelsToDelete.length} etiqueta
                {labelsToDelete.length !== 1 ? "s" : ""}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal de detalles */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            Detalles de la cuenta @{selectedAccount?.username}
          </ModalHeader>
          <ModalBody>
            {selectedAccount && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Información básica</h4>
                  <div className="grid grid-cols-2 gap-4 text-small">
                    <div>
                      <span className="text-default-500">Usuario:</span>
                      <span className="ml-2">@{selectedAccount.username}</span>
                    </div>
                    <div>
                      <span className="text-default-500">ID:</span>
                      <span className="ml-2">{selectedAccount.userId}</span>
                    </div>
                    <div>
                      <span className="text-default-500">Desarrollador:</span>
                      <span className="ml-2">
                        {selectedAccount.developerTag}
                      </span>
                    </div>
                    <div>
                      <span className="text-default-500">Conectado:</span>
                      <span className="ml-2">
                        {new Date(
                          selectedAccount.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-medium mb-2">Estado de tokens</h4>
                  <div className="space-y-2 text-small">
                    <div className="flex justify-between">
                      <span>Access Token:</span>
                      <Chip
                        size="sm"
                        color={
                          selectedAccount.hasAccessToken ? "success" : "danger"
                        }
                      >
                        {selectedAccount.hasAccessToken
                          ? "Presente"
                          : "Ausente"}
                      </Chip>
                    </div>
                    <div className="flex justify-between">
                      <span>Refresh Token:</span>
                      <Chip
                        size="sm"
                        color={
                          selectedAccount.hasRefreshToken ? "success" : "danger"
                        }
                      >
                        {selectedAccount.hasRefreshToken
                          ? "Presente"
                          : "Ausente"}
                      </Chip>
                    </div>
                    {selectedAccount.tokenInfo && (
                      <>
                        <div className="flex justify-between">
                          <span>Estado:</span>
                          <Chip
                            size="sm"
                            color={getStatusColor(
                              selectedAccount.tokenInfo.status
                            )}
                          >
                            {getStatusText(selectedAccount.tokenInfo.status)}
                          </Chip>
                        </div>
                        <div className="flex justify-between">
                          <span>Último refresh:</span>
                          <span>
                            {new Date(
                              selectedAccount.tokenInfo.lastRefresh
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expira:</span>
                          <span>
                            {new Date(
                              selectedAccount.tokenInfo.expiresAt
                            ).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {selectedAccount.needsReauth && (
                  <>
                    <Divider />
                    <Card className="bg-danger-50 border-danger-200">
                      <CardBody>
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-danger mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div>
                            <div className="font-medium text-danger">
                              Re-autenticación requerida
                            </div>
                            <div className="text-small text-danger-600 mt-1">
                              Esta cuenta necesita ser reconectada para
                              funcionar correctamente.
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cerrar
            </Button>
            {selectedAccount?.needsReauth ? (
              <Button
                color="primary"
                onPress={() =>
                  selectedAccount && handleReconnectAccount(selectedAccount._id)
                }
              >
                Reconectar cuenta
              </Button>
            ) : selectedAccount?.tokenInfo &&
              !selectedAccount.tokenInfo.isValid ? (
              <Button
                color="warning"
                onPress={() =>
                  selectedAccount && handleInvalidateToken(selectedAccount._id)
                }
              >
                Invalidar token
              </Button>
            ) : null}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal de testing de cuentas */}
      <Modal isOpen={isTestModalOpen} onClose={onTestModalClose} size="4xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">Testear Cuentas de X</h3>
              <p className="text-small text-default-500 font-normal">
                Verifica el estado y funcionamiento de las cuentas conectadas
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Botones de acción */}
              <div className="flex gap-3">
                <Button
                  color="primary"
                  onPress={() => handleTestAccounts()}
                  isLoading={testingAccounts}
                  startContent={
                    !testingAccounts && (
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )
                  }
                >
                  {testingAccounts ? "Testeando..." : "Testear Todas"}
                </Button>
                {testResults && (
                  <Button
                    color="secondary"
                    variant="flat"
                    onPress={() => setTestResults(null)}
                  >
                    Limpiar Resultados
                  </Button>
                )}
              </div>

              {/* Progreso */}
              {testingAccounts && (
                <div className="space-y-2">
                  <div className="flex justify-between text-small">
                    <span>Testeando cuentas...</span>
                    <span>{testProgress}%</span>
                  </div>
                  <Progress value={testProgress} color="primary" />
                </div>
              )}

              {/* Resultados */}
              {testResults && (
                <div className="space-y-4">
                  {/* Resumen */}
                  <Card>
                    <CardBody>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {testResults.summary.total}
                          </div>
                          <div className="text-small text-default-500">
                            Total
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-success">
                            {testResults.summary.success}
                          </div>
                          <div className="text-small text-default-500">
                            Exitosas
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-warning">
                            {testResults.summary.warnings}
                          </div>
                          <div className="text-small text-default-500">
                            Advertencias
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-danger">
                            {testResults.summary.errors}
                          </div>
                          <div className="text-small text-default-500">
                            Errores
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Lista de resultados */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {testResults.results.map((result) => (
                      <Card
                        key={result.accountId}
                        className={`border-l-4 ${
                          result.status === "success"
                            ? "border-l-success"
                            : result.status === "warning"
                            ? "border-l-warning"
                            : "border-l-danger"
                        }`}
                      >
                        <CardBody className="py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  @{result.username}
                                </span>
                                <Chip
                                  size="sm"
                                  color={
                                    result.status === "success"
                                      ? "success"
                                      : result.status === "warning"
                                      ? "warning"
                                      : "danger"
                                  }
                                  variant="flat"
                                >
                                  {result.status === "success"
                                    ? "OK"
                                    : result.status === "warning"
                                    ? "Advertencia"
                                    : "Error"}
                                </Chip>
                              </div>
                              <p className="text-small text-default-600 mb-2">
                                {result.message}
                              </p>
                              <div className="flex gap-4 text-tiny">
                                <span
                                  className={
                                    result.details.hasTokens
                                      ? "text-success"
                                      : "text-danger"
                                  }
                                >
                                  Tokens: {result.details.hasTokens ? "✓" : "✗"}
                                </span>
                                <span
                                  className={
                                    result.details.tokenValid
                                      ? "text-success"
                                      : "text-danger"
                                  }
                                >
                                  Válido:{" "}
                                  {result.details.tokenValid ? "✓" : "✗"}
                                </span>
                                <span
                                  className={
                                    result.details.apiAccess
                                      ? "text-success"
                                      : "text-danger"
                                  }
                                >
                                  API: {result.details.apiAccess ? "✓" : "✗"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  <div className="text-tiny text-default-400 text-center">
                    Testeado el{" "}
                    {new Date(testResults.testedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onTestModalClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal de selección de tipo de conexión */}
      <Modal
        isOpen={isConnectionTypeOpen}
        onClose={onConnectionTypeClose}
        size="lg"
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-xl font-bold">Conectar Nueva Cuenta</h3>
            <p className="text-small text-default-500 font-normal">
              Elige cómo quieres agregar tu cuenta de X
            </p>
          </ModalHeader>
          <ModalBody className="gap-6">
            <div className="grid gap-4">
              {/* Opción OAuth */}
              <Card
                isPressable
                onPress={handleOAuthConnection}
                className="border-2 border-transparent hover:border-primary transition-colors"
              >
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-lg font-semibold mb-2">
                        OAuth 2.0 (Recomendado)
                      </h4>
                      <p className="text-default-600 text-sm mb-3">
                        Conecta tu cuenta de forma segura usando el flujo
                        oficial de X. No necesitas credenciales de
                        desarrollador.
                      </p>
                      <div className="flex items-center gap-2">
                        <Chip size="sm" color="success" variant="flat">
                          Fácil
                        </Chip>
                        <Chip size="sm" color="primary" variant="flat">
                          Seguro
                        </Chip>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Opción API Keys */}
              <Card
                isPressable
                onPress={handleApiKeysConnection}
                className="border-2 border-transparent hover:border-secondary transition-colors"
              >
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-secondary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-lg font-semibold mb-2">
                        Claves de Desarrollador
                      </h4>
                      <p className="text-default-600 text-sm mb-3">
                        Usa tus propias credenciales de la app de desarrollador
                        de X. Ideal para tener rate limits independientes (17
                        tweets/día).
                      </p>
                      <div className="flex items-center gap-2">
                        <Chip size="sm" color="secondary" variant="flat">
                          Rate Limits Propios
                        </Chip>
                        <Chip size="sm" color="warning" variant="flat">
                          Requiere Dev Account
                        </Chip>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onConnectionTypeClose}>
              Cancelar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
