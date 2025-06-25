import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Textarea,
  Chip,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Divider,
  Input,
  Select,
  SelectItem,
  Switch,
  Tooltip,
} from "@heroui/react";

interface BatchMessage {
  id: string;
  text: string;
  assignedAccounts: string[];
  priority: "high" | "medium" | "low";
  category?: string;
}

interface XAccount {
  _id: string;
  username: string;
  labels: string[];
}

interface BatchManagerProps {
  accounts: XAccount[];
  selectedAccounts: string[];
  onExecute: (messages: BatchMessage[], mode: string) => void;
  isLoading?: boolean;
}

type DistributionMode = "sequential" | "round-robin" | "random" | "priority";

export default function BatchManager({
  accounts,
  selectedAccounts,
  onExecute,
  isLoading = false,
}: BatchManagerProps) {
  const [messages, setMessages] = useState<BatchMessage[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [currentPriority, setCurrentPriority] = useState<
    "high" | "medium" | "low"
  >("medium");
  const [currentCategory, setCurrentCategory] = useState("");
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("round-robin");
  const [enableCategoryBalance, setEnableCategoryBalance] = useState(false);
  const [enableSmartDistribution, setEnableSmartDistribution] = useState(true);

  const {
    isOpen: isPreviewOpen,
    onOpen: onPreviewOpen,
    onOpenChange: onPreviewOpenChange,
  } = useDisclosure();

  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onOpenChange: onImportOpenChange,
  } = useDisclosure();

  const [bulkText, setBulkText] = useState("");

  // Estadísticas de los mensajes
  const messageStats = useMemo(() => {
    const total = messages.length;
    const assigned = messages.filter(
      (m) => m.assignedAccounts.length > 0
    ).length;
    const unassigned = total - assigned;
    const categorySet = new Set(
      messages.map((m) => m.category).filter(Boolean)
    );
    const categories = Array.from(categorySet);

    return {
      total,
      assigned,
      unassigned,
      categories: categories.length,
      avgAccountsPerMessage:
        total > 0
          ? messages.reduce((acc, m) => acc + m.assignedAccounts.length, 0) /
            total
          : 0,
    };
  }, [messages]);

  const addMessage = () => {
    if (!currentText.trim()) return;

    const newMessage: BatchMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: currentText.trim(),
      assignedAccounts: [],
      priority: currentPriority,
      category: currentCategory.trim() || undefined,
    };

    setMessages([...messages, newMessage]);
    setCurrentText("");
    setCurrentCategory("");
  };

  const removeMessage = (id: string) => {
    setMessages(messages.filter((m) => m.id !== id));
  };

  const updateMessage = (id: string, updates: Partial<BatchMessage>) => {
    setMessages(messages.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const importBulkMessages = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const newMessages: BatchMessage[] = lines.map((line, index) => ({
      id: `bulk_${Date.now()}_${index}`,
      text: line,
      assignedAccounts: [],
      priority: "medium",
      category: currentCategory.trim() || undefined,
    }));

    setMessages([...messages, ...newMessages]);
    setBulkText("");
    setCurrentCategory("");
    onImportOpenChange();
  };

  const distributeMessages = () => {
    if (selectedAccounts.length === 0 || messages.length === 0) return;

    const selectedAccountsList = accounts.filter((acc) =>
      selectedAccounts.includes(acc._id)
    );

    let distributedMessages = [...messages];

    switch (distributionMode) {
      case "sequential":
        distributedMessages = distributeSequential(
          distributedMessages,
          selectedAccountsList
        );
        break;
      case "round-robin":
        distributedMessages = distributeRoundRobin(
          distributedMessages,
          selectedAccountsList
        );
        break;
      case "random":
        distributedMessages = distributeRandom(
          distributedMessages,
          selectedAccountsList
        );
        break;
      case "priority":
        distributedMessages = distributePriority(
          distributedMessages,
          selectedAccountsList
        );
        break;
    }

    if (enableSmartDistribution) {
      distributedMessages = optimizeDistribution(
        distributedMessages,
        selectedAccountsList
      );
    }

    setMessages(distributedMessages);
    onPreviewOpen();
  };

  const distributeSequential = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    const accountsPerMessage = Math.ceil(accs.length / msgs.length);

    return msgs.map((msg, index) => {
      const startIndex = index * accountsPerMessage;
      const endIndex = Math.min(startIndex + accountsPerMessage, accs.length);

      return {
        ...msg,
        assignedAccounts: accs
          .slice(startIndex, endIndex)
          .map((acc) => acc._id),
      };
    });
  };

  const distributeRoundRobin = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    const distribution: string[][] = msgs.map(() => []);

    accs.forEach((acc, index) => {
      const messageIndex = index % msgs.length;
      distribution[messageIndex].push(acc._id);
    });

    return msgs.map((msg, index) => ({
      ...msg,
      assignedAccounts: distribution[index],
    }));
  };

  const distributeRandom = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    const shuffledAccounts = [...accs].sort(() => Math.random() - 0.5);
    return distributeRoundRobin(msgs, shuffledAccounts);
  };

  const distributePriority = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const sortedMessages = [...msgs].sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    const accountsPerMessage = Math.ceil(accs.length / msgs.length);
    let accountIndex = 0;

    return sortedMessages.map((msg) => {
      const accountsToAssign = Math.min(
        accountsPerMessage,
        accs.length - accountIndex
      );
      const assignedAccounts = accs
        .slice(accountIndex, accountIndex + accountsToAssign)
        .map((acc) => acc._id);

      accountIndex += accountsToAssign;

      return {
        ...msg,
        assignedAccounts,
      };
    });
  };

  const optimizeDistribution = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    // Balancear por etiquetas si está habilitado
    if (enableCategoryBalance) {
      return balanceByLabels(msgs, accs);
    }

    return msgs;
  };

  const balanceByLabels = (
    msgs: BatchMessage[],
    accs: XAccount[]
  ): BatchMessage[] => {
    const labelGroups: { [key: string]: XAccount[] } = {};

    accs.forEach((acc) => {
      acc.labels.forEach((label) => {
        if (!labelGroups[label]) labelGroups[label] = [];
        labelGroups[label].push(acc);
      });
    });

    // Distribuir cuentas por etiquetas de manera equilibrada
    return msgs.map((msg) => {
      const assignedAccounts: string[] = [];
      const labelsUsed = new Set<string>();

      // Intentar asignar al menos una cuenta de cada etiqueta
      Object.keys(labelGroups).forEach((label) => {
        if (!labelsUsed.has(label) && labelGroups[label].length > 0) {
          const randomAccount =
            labelGroups[label][
              Math.floor(Math.random() * labelGroups[label].length)
            ];
          if (!assignedAccounts.includes(randomAccount._id)) {
            assignedAccounts.push(randomAccount._id);
            labelsUsed.add(label);
          }
        }
      });

      return {
        ...msg,
        assignedAccounts,
      };
    });
  };

  const clearAll = () => {
    setMessages([]);
    setCurrentText("");
    setCurrentCategory("");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return "🔥";
      case "medium":
        return "⚡";
      case "low":
        return "📝";
      default:
        return "📝";
    }
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">📊 Estadísticas del Lote</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {messageStats.total}
              </div>
              <div className="text-sm text-gray-600">Mensajes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {messageStats.assigned}
              </div>
              <div className="text-sm text-gray-600">Asignados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {messageStats.unassigned}
              </div>
              <div className="text-sm text-gray-600">Sin asignar</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {messageStats.categories}
              </div>
              <div className="text-sm text-gray-600">Categorías</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {messageStats.avgAccountsPerMessage.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Promedio/Msg</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Crear nuevo mensaje */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <h3 className="text-lg font-semibold">✍️ Crear Mensajes</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="flat"
              color="secondary"
              onClick={onImportOpen}
            >
              📥 Importar Lote
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onClick={clearAll}
              disabled={messages.length === 0}
            >
              🗑️ Limpiar Todo
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Categoría (opcional)"
              placeholder="ej: promociones, noticias..."
              value={currentCategory}
              onValueChange={setCurrentCategory}
            />
            <Select
              label="Prioridad"
              selectedKeys={[currentPriority]}
              onSelectionChange={(keys) => {
                const priority = Array.from(keys)[0] as
                  | "high"
                  | "medium"
                  | "low";
                setCurrentPriority(priority);
              }}
            >
              <SelectItem key="high" value="high">
                🔥 Alta
              </SelectItem>
              <SelectItem key="medium" value="medium">
                ⚡ Media
              </SelectItem>
              <SelectItem key="low" value="low">
                📝 Baja
              </SelectItem>
            </Select>
            <div className="flex items-end">
              <Button
                color="primary"
                onClick={addMessage}
                disabled={!currentText.trim()}
                className="w-full"
              >
                Añadir Mensaje
              </Button>
            </div>
          </div>

          <Textarea
            label="Texto del mensaje"
            placeholder="Escribe tu mensaje aquí..."
            value={currentText}
            onValueChange={setCurrentText}
            maxRows={4}
          />
        </CardBody>
      </Card>

      {/* Configuración de distribución */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">
              ⚙️ Configuración de Distribución
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Modo de distribución"
                selectedKeys={[distributionMode]}
                onSelectionChange={(keys) => {
                  const mode = Array.from(keys)[0] as DistributionMode;
                  setDistributionMode(mode);
                }}
              >
                <SelectItem key="round-robin" value="round-robin">
                  🔄 Round Robin (Equilibrado)
                </SelectItem>
                <SelectItem key="sequential" value="sequential">
                  📊 Secuencial (Bloques)
                </SelectItem>
                <SelectItem key="random" value="random">
                  🎲 Aleatorio
                </SelectItem>
                <SelectItem key="priority" value="priority">
                  🎯 Por Prioridad
                </SelectItem>
              </Select>

              <div className="space-y-3">
                <Switch
                  isSelected={enableSmartDistribution}
                  onValueChange={setEnableSmartDistribution}
                  size="sm"
                >
                  🧠 Distribución inteligente
                </Switch>
                <Switch
                  isSelected={enableCategoryBalance}
                  onValueChange={setEnableCategoryBalance}
                  size="sm"
                >
                  🏷️ Balance por etiquetas
                </Switch>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                color="success"
                variant="flat"
                onClick={distributeMessages}
                disabled={selectedAccounts.length === 0}
              >
                🎯 Distribuir Mensajes ({selectedAccounts.length} cuentas)
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Lista de mensajes */}
      {messages.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <h3 className="text-lg font-semibold">
              📝 Mensajes del Lote ({messages.length})
            </h3>
            <Button
              color="primary"
              onClick={() => onExecute(messages, distributionMode)}
              disabled={messages.length === 0 || isLoading}
              isLoading={isLoading}
            >
              🚀 Ejecutar Lote
            </Button>
          </CardHeader>
          <CardBody className="space-y-3 max-h-96 overflow-y-auto">
            {messages.map((message, index) => (
              <Card key={message.id} className="border">
                <CardBody className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Chip size="sm" variant="flat" color="primary">
                          #{index + 1}
                        </Chip>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={getPriorityColor(message.priority)}
                        >
                          {getPriorityIcon(message.priority)} {message.priority}
                        </Chip>
                        {message.category && (
                          <Chip size="sm" variant="flat" color="secondary">
                            {message.category}
                          </Chip>
                        )}
                        <Badge
                          content={message.assignedAccounts.length}
                          color="primary"
                        >
                          <Chip size="sm" variant="flat">
                            Cuentas
                          </Chip>
                        </Badge>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        {message.text}
                      </p>
                      {message.assignedAccounts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {message.assignedAccounts
                            .slice(0, 5)
                            .map((accountId) => {
                              const account = accounts.find(
                                (a) => a._id === accountId
                              );
                              return (
                                <Chip
                                  key={accountId}
                                  size="sm"
                                  variant="flat"
                                  color="default"
                                >
                                  @{account?.username || accountId}
                                </Chip>
                              );
                            })}
                          {message.assignedAccounts.length > 5 && (
                            <Chip size="sm" variant="flat" color="default">
                              +{message.assignedAccounts.length - 5} más
                            </Chip>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      isIconOnly
                      onClick={() => removeMessage(message.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Modal de vista previa */}
      <Modal
        isOpen={isPreviewOpen}
        onOpenChange={onPreviewOpenChange}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <h3 className="text-xl font-semibold">
                  📋 Vista Previa de Distribución
                </h3>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <h4 className="font-semibold mb-2">Resumen:</h4>
                    <p>• {messages.length} mensajes distribuidos</p>
                    <p>• {selectedAccounts.length} cuentas participantes</p>
                    <p>• Modo: {distributionMode}</p>
                    <p>
                      • Balance inteligente:{" "}
                      {enableSmartDistribution ? "Sí" : "No"}
                    </p>
                  </div>

                  {messages.map((message, index) => (
                    <Card key={message.id} className="border">
                      <CardBody className="p-4">
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <Chip color="primary" size="sm" variant="flat">
                              Mensaje #{index + 1}
                            </Chip>
                            <Chip
                              size="sm"
                              variant="flat"
                              color={getPriorityColor(message.priority)}
                            >
                              {getPriorityIcon(message.priority)}{" "}
                              {message.priority}
                            </Chip>
                            <Badge
                              content={message.assignedAccounts.length}
                              color="secondary"
                            >
                              <Chip color="secondary" size="sm" variant="flat">
                                Cuentas asignadas
                              </Chip>
                            </Badge>
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          {message.text}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {message.assignedAccounts.map((accountId) => {
                            const account = accounts.find(
                              (a) => a._id === accountId
                            );
                            return (
                              <Chip
                                key={accountId}
                                size="sm"
                                variant="flat"
                                color="primary"
                              >
                                @{account?.username || accountId}
                              </Chip>
                            );
                          })}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cerrar
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    onClose();
                    onExecute(messages, distributionMode);
                  }}
                  disabled={messages.length === 0}
                >
                  🚀 Ejecutar Lote
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal de importación */}
      <Modal isOpen={isImportOpen} onOpenChange={onImportOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <h3 className="text-xl font-semibold">
                  📥 Importar Mensajes en Lote
                </h3>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Pega múltiples mensajes, uno por línea. Cada línea se
                    convertirá en un mensaje separado.
                  </p>
                  <Input
                    label="Categoría para todos los mensajes (opcional)"
                    placeholder="ej: promociones, noticias..."
                    value={currentCategory}
                    onValueChange={setCurrentCategory}
                  />
                  <Textarea
                    label="Mensajes (uno por línea)"
                    placeholder={`Primer mensaje aquí
Segundo mensaje aquí
Tercer mensaje aquí...`}
                    value={bulkText}
                    onValueChange={setBulkText}
                    minRows={6}
                    maxRows={12}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={importBulkMessages}
                  disabled={!bulkText.trim()}
                >
                  Importar{" "}
                  {
                    bulkText
                      .split("\n")
                      .filter((line) => line.trim().length > 0).length
                  }{" "}
                  Mensajes
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
