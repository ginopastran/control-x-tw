import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Chip,
  Input,
  Badge,
  Checkbox,
  Tooltip,
  Divider,
} from "@heroui/react";

interface XAccount {
  _id: string;
  username: string;
  labels: string[];
  isActive?: boolean;
  stats?: {
    tweets: number;
    followers: number;
    following: number;
  };
}

interface AccountSelectorProps {
  accounts: XAccount[];
  selectedAccounts: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  title?: string;
  maxSelection?: number;
  groupByLabels?: boolean;
  showStats?: boolean;
}

export default function AccountSelector({
  accounts,
  selectedAccounts,
  onSelectionChange,
  title = "👥 Seleccionar Cuentas",
  maxSelection,
  groupByLabels = false,
  showStats = false,
}: AccountSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Obtener todas las etiquetas únicas
  const availableLabels = useMemo(() => {
    const labels = new Set<string>();
    accounts.forEach((account) => {
      account.labels?.forEach((label) => labels.add(label));
    });
    return Array.from(labels).sort();
  }, [accounts]);

  // Filtrar cuentas basado en búsqueda y etiquetas
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      // Filtro por búsqueda
      const matchesSearch =
        account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.labels?.some((label) =>
          label.toLowerCase().includes(searchQuery.toLowerCase())
        );

      // Filtro por etiquetas seleccionadas
      const matchesLabels =
        selectedLabels.length === 0 ||
        selectedLabels.some((label) => account.labels?.includes(label));

      return matchesSearch && matchesLabels;
    });
  }, [accounts, searchQuery, selectedLabels]);

  // Agrupar cuentas por etiquetas si está habilitado
  const groupedAccounts = useMemo(() => {
    if (!groupByLabels) {
      return { "": filteredAccounts };
    }

    const groups: { [key: string]: XAccount[] } = {};

    filteredAccounts.forEach((account) => {
      if (!account.labels || account.labels.length === 0) {
        if (!groups["Sin etiqueta"]) groups["Sin etiqueta"] = [];
        groups["Sin etiqueta"].push(account);
      } else {
        account.labels.forEach((label) => {
          if (!groups[label]) groups[label] = [];
          groups[label].push(account);
        });
      }
    });

    return groups;
  }, [filteredAccounts, groupByLabels]);

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      onSelectionChange(selectedAccounts.filter((id) => id !== accountId));
    } else {
      if (maxSelection && selectedAccounts.length >= maxSelection) {
        return; // No permitir más selecciones
      }
      onSelectionChange([...selectedAccounts, accountId]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredAccounts.map((account) => account._id);
    const limitedSelection = maxSelection
      ? allFilteredIds.slice(0, maxSelection)
      : allFilteredIds;
    onSelectionChange(limitedSelection);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const handleLabelToggle = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter((l) => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const selectAccountsByLabel = (label: string) => {
    const accountsWithLabel = accounts
      .filter((account) => account.labels?.includes(label))
      .map((account) => account._id);

    const uniqueSelection = new Set([
      ...selectedAccounts,
      ...accountsWithLabel,
    ]);
    const newSelection = Array.from(uniqueSelection);
    const limitedSelection = maxSelection
      ? newSelection.slice(0, maxSelection)
      : newSelection;

    onSelectionChange(limitedSelection);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col space-y-4">
        <div className="flex justify-between items-center w-full">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center space-x-2">
            <Badge content={selectedAccounts.length} color="primary">
              <Chip variant="flat" color="primary">
                Seleccionadas
              </Chip>
            </Badge>
            {maxSelection && (
              <Chip variant="flat" color="warning" size="sm">
                Máx: {maxSelection}
              </Chip>
            )}
          </div>
        </div>

        {/* Barra de búsqueda */}
        <Input
          placeholder="🔍 Buscar por nombre o etiqueta..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          isClearable
          className="w-full"
        />

        {/* Filtros por etiquetas */}
        {availableLabels.length > 0 && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                🏷️ Filtrar por etiquetas:
              </span>
              <Button
                size="sm"
                variant="light"
                onClick={() => setSelectedLabels([])}
                disabled={selectedLabels.length === 0}
              >
                Limpiar filtros
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableLabels.map((label) => (
                <div key={label} className="flex items-center space-x-1">
                  <Chip
                    variant={selectedLabels.includes(label) ? "solid" : "flat"}
                    color={
                      selectedLabels.includes(label) ? "primary" : "default"
                    }
                    className="cursor-pointer"
                    onClick={() => handleLabelToggle(label)}
                  >
                    {label}
                  </Chip>
                  <Tooltip
                    content={`Seleccionar todas las cuentas con "${label}"`}
                  >
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      onClick={() => selectAccountsByLabel(label)}
                      className="min-w-6 w-6 h-6"
                    >
                      +
                    </Button>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones de selección masiva */}
        <div className="flex justify-between items-center w-full">
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="flat"
              onClick={handleSelectAll}
              disabled={filteredAccounts.length === 0}
            >
              Seleccionar todas ({filteredAccounts.length})
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="warning"
              onClick={handleDeselectAll}
              disabled={selectedAccounts.length === 0}
            >
              Deseleccionar todas
            </Button>
          </div>
          <span className="text-sm text-gray-600">
            {filteredAccounts.length} de {accounts.length} cuentas
          </span>
        </div>
      </CardHeader>

      <CardBody className="max-h-80 overflow-y-auto">
        {Object.keys(groupedAccounts).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No se encontraron cuentas que coincidan con los filtros
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedAccounts).map(
              ([groupName, groupAccounts]) => (
                <div key={groupName}>
                  {groupByLabels && groupName && (
                    <>
                      <div className="flex items-center space-x-2 mb-2">
                        <Chip variant="flat" color="secondary" size="sm">
                          {groupName}
                        </Chip>
                        <Badge content={groupAccounts.length} color="secondary">
                          <span className="text-xs text-gray-500">cuentas</span>
                        </Badge>
                      </div>
                      <Divider className="mb-3" />
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupAccounts.map((account) => {
                      const isSelected = selectedAccounts.includes(account._id);
                      const isDisabled = Boolean(
                        maxSelection &&
                          !isSelected &&
                          selectedAccounts.length >= maxSelection
                      );

                      return (
                        <div
                          key={account._id}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary-50 dark:bg-primary-950"
                              : isDisabled
                              ? "border-gray-200 bg-gray-50 dark:bg-gray-800 opacity-50"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                          }`}
                          onClick={() =>
                            !isDisabled && handleAccountToggle(account._id)
                          }
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  isSelected={isSelected}
                                  isDisabled={isDisabled}
                                  size="sm"
                                />
                                <span className="font-medium">
                                  @{account.username}
                                </span>
                                {account.isActive === false && (
                                  <Chip size="sm" color="danger" variant="flat">
                                    Inactiva
                                  </Chip>
                                )}
                              </div>

                              {account.labels && account.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {account.labels.slice(0, 3).map((label) => (
                                    <Chip key={label} size="sm" variant="flat">
                                      {label}
                                    </Chip>
                                  ))}
                                  {account.labels.length > 3 && (
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color="default"
                                    >
                                      +{account.labels.length - 3}
                                    </Chip>
                                  )}
                                </div>
                              )}

                              {showStats && account.stats && (
                                <div className="text-xs text-gray-500 mt-2">
                                  <div>📝 {account.stats.tweets} tweets</div>
                                  <div>
                                    👥 {account.stats.followers} seguidores
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
