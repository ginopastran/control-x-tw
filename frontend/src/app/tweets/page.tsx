"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  Send,
  Heart,
  Repeat,
  UserPlus,
  UserMinus,
  Zap,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Search,
  Filter,
  X,
  Plus,
  Minus,
  ChevronDown,
  Check,
  List,
  Grid,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface ActionResult {
  account: string;
  success: boolean;
  message: string;
  details?: string;
}

interface BatchTweet {
  id: string;
  text: string;
  assignedAccounts: string[];
}

// Filtros predefinidos basados en las etiquetas reales de las cuentas
const LABEL_FILTERS = {
  edad: ["14-18", "18-25", "25-65", "65+"],
  ideologia: [
    "anti todo pero afín",
    "kakardo",
    "lukardo",
    "kukarko",
    "peroncho tradicional",
  ],
  situacion: [
    "estudia y trabaja",
    "estudiante secundaria",
    "solo estudia",
    "solo trabaja",
    "trabaja",
    "jubilado",
  ],
};

export default function TweetsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionResults, setActionResults] = useState<ActionResult[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Estados para cada tipo de acción
  const [tweetText, setTweetText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTweetUrl, setReplyTweetUrl] = useState("");
  const [likeTweetUrl, setLikeTweetUrl] = useState("");
  const [retweetUrl, setRetweetUrl] = useState("");
  const [followUser, setFollowUser] = useState("");
  const [unfollowUser, setUnfollowUser] = useState("");

  // Estados para delays
  const [baseDelay, setBaseDelay] = useState(30);
  const [randomDelay, setRandomDelay] = useState(60);

  // Estados de animación
  const [isVisible, setIsVisible] = useState(false);

  // Nuevos estados para filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<{
    edad: string[];
    ideologia: string[];
    situacion: string[];
  }>({
    edad: [],
    ideologia: [],
    situacion: [],
  });

  // Estados para modo batch de tweets
  const [batchMode, setBatchMode] = useState(false);
  const [batchTweets, setBatchTweets] = useState<BatchTweet[]>([]);
  const [batchTweetText, setBatchTweetText] = useState("");

  // Estados para vista
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchAccounts();
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Error al cargar cuentas");
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      toast.error("Error al cargar las cuentas");
    }
  };

  // Función para calcular similitud de strings (Levenshtein distance)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - matrix[str2.length][str1.length]) / maxLength;
  };

  // Función para verificar si dos strings son similares
  const areStringsSimilar = (
    str1: string,
    str2: string,
    threshold: number = 0.7
  ): boolean => {
    const similarity = calculateSimilarity(
      str1.toLowerCase(),
      str2.toLowerCase()
    );
    return similarity >= threshold;
  };

  const filteredAccounts = accounts.filter((account) => {
    // Filtro por búsqueda
    const matchesSearch =
      searchQuery === "" ||
      account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.labels.some((label) =>
        label.toLowerCase().includes(searchQuery.toLowerCase())
      );

    // DEBUG: Log para entender las etiquetas
    if (selectedFilters.ideologia.length > 0 && account.labels.length > 0) {
      console.log(`🔍 DEBUG Account @${account.username}:`, {
        labels: account.labels,
        selectedFilters: selectedFilters.ideologia,
        normalizedLabels: account.labels.map((l) => l.toLowerCase().trim()),
      });
    }

    // Filtro por etiquetas - formato real: "Ideología: lukardo", "Situación: Estudiante secundaria"
    const matchesFilters = Object.entries(selectedFilters).every(
      ([category, values]) => {
        if (values.length === 0) return true;
        // Para cada filtro seleccionado, debe haber al menos una coincidencia
        return values.some((filterValue) =>
          account.labels.some((label) => {
            const normalizedLabel = label.toLowerCase().trim();
            const normalizedFilter = filterValue.toLowerCase().trim();

            // DEBUG: Log detallado de comparaciones
            if (category === "ideologia" && values.length > 0) {
              console.log(
                `  🔍 Comparing "${normalizedLabel}" with filter "${normalizedFilter}"`
              );
            }

            // Formato real: "ideología: lukardo" -> buscar por categoría y valor
            const categoryMappings = {
              edad: "edad:",
              ideologia: "ideología:",
              situacion: "situación:",
            };

            const categoryPrefix =
              categoryMappings[category as keyof typeof categoryMappings];

            if (categoryPrefix && normalizedLabel.startsWith(categoryPrefix)) {
              const labelValue = normalizedLabel
                .substring(categoryPrefix.length)
                .trim();

              // Coincidencia exacta
              if (labelValue === normalizedFilter) {
                if (category === "ideologia" && values.length > 0) {
                  console.log(
                    `    ✅ Exact match! "${labelValue}" === "${normalizedFilter}"`
                  );
                }
                return true;
              }

              // Coincidencia parcial
              if (
                labelValue.includes(normalizedFilter) ||
                normalizedFilter.includes(labelValue)
              ) {
                if (category === "ideologia" && values.length > 0) {
                  console.log(
                    `    ✅ Partial match! "${labelValue}" includes "${normalizedFilter}"`
                  );
                }
                return true;
              }

              // Coincidencia por similitud (para casos como "kukardo" vs "kukarko")
              const similarity = calculateSimilarity(
                labelValue,
                normalizedFilter
              );
              if (similarity >= 0.7) {
                if (category === "ideologia" && values.length > 0) {
                  console.log(
                    `    ✅ Similarity match! "${labelValue}" vs "${normalizedFilter}" (${(
                      similarity * 100
                    ).toFixed(1)}%)`
                  );
                }
                return true;
              }

              if (category === "ideologia" && values.length > 0) {
                console.log(
                  `    ❌ No match! "${labelValue}" vs "${normalizedFilter}" (${(
                    similarity * 100
                  ).toFixed(1)}%)`
                );
              }

              return false;
            }

            // También buscar coincidencias directas (para compatibilidad)
            const directMatch = normalizedLabel.includes(normalizedFilter);
            const similarityMatch = areStringsSimilar(
              normalizedLabel,
              normalizedFilter
            );

            if (category === "ideologia" && values.length > 0) {
              console.log(
                `    🔍 Direct match: "${normalizedLabel}" includes "${normalizedFilter}" = ${directMatch}`
              );
              if (similarityMatch) {
                console.log(
                  `    ✅ Similarity direct match! "${normalizedLabel}" vs "${normalizedFilter}"`
                );
              }
            }

            return directMatch || similarityMatch;
          })
        );
      }
    );

    const finalResult = matchesSearch && matchesFilters;

    if (selectedFilters.ideologia.length > 0) {
      console.log(`🎯 Account @${account.username} final result:`, {
        matchesSearch,
        matchesFilters,
        finalResult,
      });
    }

    return finalResult;
  });

  // Función para agregar tweets en lote
  const handleBatchTweetAdd = () => {
    if (!batchTweetText.trim()) return;

    const lines = batchTweetText.split("\n").filter((line) => line.trim());
    const newTweets: BatchTweet[] = lines.map((line, index) => ({
      id: `batch-${Date.now()}-${index}`,
      text: line.trim(),
      assignedAccounts: [],
    }));

    setBatchTweets((prev) => [...prev, ...newTweets]);
    setBatchTweetText("");
    toast.success(`${newTweets.length} tweets agregados al lote`);
  };

  // Función para asignar cuentas a un tweet específico
  const handleAssignAccountsToTweet = (
    tweetId: string,
    accountIds: string[]
  ) => {
    setBatchTweets((prev) =>
      prev.map((tweet) =>
        tweet.id === tweetId
          ? { ...tweet, assignedAccounts: accountIds }
          : tweet
      )
    );
  };

  // Función para ejecutar tweets en lote
  const handleBatchTweetExecute = async () => {
    const tweetsToExecute = batchTweets.filter(
      (tweet) => tweet.assignedAccounts.length > 0
    );

    if (tweetsToExecute.length === 0) {
      toast.error("Asigna al menos una cuenta a cada tweet");
      return;
    }

    setLoading(true);
    setActionResults([]);

    let successCount = 0;
    let errorCount = 0;
    let totalActionsAdded = 0;

    try {
      for (const tweet of tweetsToExecute) {
        try {
          // Preparar datos de la acción para el sistema de cola
          const actionData = {
            action: "tweet",
            accountIds: tweet.assignedAccounts,
            text: tweet.text,
            baseDelay: baseDelay * 1000, // Convertir a milliseconds
            randomDelay: randomDelay * 1000, // Convertir a milliseconds
          };

          // Enviar al sistema de colas usando el endpoint correcto
          const response = await fetch("http://localhost:3001/api/queue/add", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(actionData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
          }

          const result = await response.json();
          console.log(`✅ Lote tweet añadido a la cola:`, result);
          successCount++;
          totalActionsAdded +=
            result.actions?.length || tweet.assignedAccounts.length;

          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: true,
              message: `Lote "${tweet.text.substring(0, 50)}..." enviado a ${
                tweet.assignedAccounts.length
              } cuentas`,
            },
          ]);
        } catch (error: any) {
          console.error(`❌ Error enviando lote tweet:`, error.message);
          errorCount++;

          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: false,
              message: `Error en lote "${tweet.text.substring(0, 30)}...": ${
                error.message
              }`,
            },
          ]);
        }

        // Pequeño delay entre lotes para evitar saturar el sistema
        if (tweetsToExecute.indexOf(tweet) < tweetsToExecute.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `🎉 Proceso completado: ${successCount} lotes exitosos, ${errorCount} errores, ${totalActionsAdded} acciones totales`
      );

      if (successCount > 0) {
        toast.success(
          `${successCount} lotes enviados exitosamente al sistema de colas (${totalActionsAdded} acciones totales)`
        );
        // Limpiar tweets exitosos
        setBatchTweets([]);
      }

      if (errorCount > 0) {
        toast.error(
          `${errorCount} lotes fallaron. Revisa los resultados para más detalles.`
        );
      }
    } catch (error: any) {
      console.error("Error general ejecutando lotes:", error);
      toast.error(
        "Error ejecutando los lotes. Revisa la consola para más detalles."
      );
    } finally {
      setLoading(false);
    }
  };

  const extractTweetId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const statusIndex = pathParts.indexOf("status");
      return statusIndex !== -1 && pathParts[statusIndex + 1]
        ? pathParts[statusIndex + 1]
        : null;
    } catch {
      return null;
    }
  };

  const executeAction = async (actionType: string, data: any) => {
    if (selectedAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }

    setLoading(true);
    setActionResults([]);

    try {
      // Preparar datos de la acción para el sistema de cola
      const actionData = {
        action: actionType,
        accountIds: selectedAccounts,
        baseDelay: baseDelay * 1000, // Convertir a milliseconds
        randomDelay: randomDelay * 1000, // Convertir a milliseconds
        ...data,
      };

      // Enviar al sistema de colas usando el endpoint correcto
      const response = await fetch("http://localhost:3001/api/queue/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(actionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Acción ${actionType} añadida a la cola:`, result);

      setActionResults([
        {
          account: "Sistema",
          success: true,
          message: result.message,
          details: `${result.actions.length} acciones añadidas a la cola`,
        },
      ]);

      toast.success(
        `Acciones enviadas al sistema de colas: ${result.actions.length} acciones programadas`
      );

      // Limpiar formulario
      setTweetText("");
      setReplyText("");
      setReplyTweetUrl("");
      setLikeTweetUrl("");
      setRetweetUrl("");
      setFollowUser("");
      setUnfollowUser("");
    } catch (error: any) {
      console.error(`Error ejecutando ${actionType}:`, error);
      setActionResults([
        {
          account: "Sistema",
          success: false,
          message: "Error al añadir acciones a la cola",
          details: error.message,
        },
      ]);
      toast.error("Error enviando las acciones al sistema de colas");
    } finally {
      setLoading(false);
    }
  };

  const handleTweet = () => {
    if (!tweetText.trim()) {
      toast.error("El texto del tweet es obligatorio");
      return;
    }
    executeAction("tweet", { text: tweetText });
  };

  const handleReply = () => {
    if (!replyText.trim()) {
      toast.error("El texto de la respuesta es obligatorio");
      return;
    }
    if (!replyTweetUrl.trim()) {
      toast.error("La URL del tweet es obligatoria");
      return;
    }

    const tweetId = extractTweetId(replyTweetUrl);
    if (!tweetId) {
      toast.error("URL de tweet inválida");
      return;
    }

    executeAction("reply", { text: replyText, tweetId });
  };

  const handleLike = () => {
    if (!likeTweetUrl.trim()) {
      toast.error("La URL del tweet es obligatoria");
      return;
    }

    const tweetId = extractTweetId(likeTweetUrl);
    if (!tweetId) {
      toast.error("URL de tweet inválida");
      return;
    }

    executeAction("like", { tweetId });
  };

  const handleRetweet = () => {
    if (!retweetUrl.trim()) {
      toast.error("La URL del tweet es obligatoria");
      return;
    }

    const tweetId = extractTweetId(retweetUrl);
    if (!tweetId) {
      toast.error("URL de tweet inválida");
      return;
    }

    executeAction("retweet", { tweetId });
  };

  const handleFollow = () => {
    if (!followUser.trim()) {
      toast.error("El usuario es obligatorio");
      return;
    }
    executeAction("follow", { targetUserId: followUser });
  };

  const handleUnfollow = () => {
    if (!unfollowUser.trim()) {
      toast.error("El usuario es obligatorio");
      return;
    }
    executeAction("unfollow", { targetUserId: unfollowUser });
  };

  const selectAllAccounts = () => {
    setSelectedAccounts(filteredAccounts.map((acc) => acc._id));
  };

  const clearSelection = () => {
    setSelectedAccounts([]);
  };

  const selectAllFiltered = () => {
    setSelectedAccounts(filteredAccounts.map((acc) => acc._id));
  };

  // Función para agregar/remover filtros
  const toggleFilter = (
    category: keyof typeof selectedFilters,
    value: string
  ) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter((v) => v !== value)
        : [...prev[category], value],
    }));
  };

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSelectedFilters({
      edad: [],
      ideologia: [],
      situacion: [],
    });
    setSearchQuery("");
  };

  return (
    <div
      className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-3 mb-6 animate-pulse">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Panel de Acciones de Twitter
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Gestiona todas las acciones de Twitter desde un solo lugar
        </p>
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            <span>Tiempo real</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-blue-500" />
            <span>{accounts.length} cuentas disponibles</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Selección de cuentas con filtros mejorada */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    Seleccionar Cuentas para Acciones
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Filtra y elige las cuentas para ejecutar las acciones
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setViewMode(viewMode === "grid" ? "list" : "grid")
                  }
                  className="hover:scale-105 transition-transform"
                >
                  {viewMode === "grid" ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <Grid className="h-4 w-4" />
                  )}
                </Button>
                <Badge variant="secondary">
                  {filteredAccounts.length} de {accounts.length}
                </Badge>
              </div>
            </div>

            {/* Barra de búsqueda */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o etiqueta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Filtros por etiquetas */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtrar por etiquetas
                </Label>
                {(Object.values(selectedFilters).flat().length > 0 ||
                  searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(LABEL_FILTERS).map(([category, options]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {category}
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between text-sm"
                        >
                          {selectedFilters[
                            category as keyof typeof selectedFilters
                          ].length > 0
                            ? `${
                                selectedFilters[
                                  category as keyof typeof selectedFilters
                                ].length
                              } seleccionado${
                                selectedFilters[
                                  category as keyof typeof selectedFilters
                                ].length > 1
                                  ? "s"
                                  : ""
                              }`
                            : `Seleccionar ${category}`}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>
                          Filtros de {category}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {options.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option}
                            checked={selectedFilters[
                              category as keyof typeof selectedFilters
                            ].includes(option)}
                            onCheckedChange={() =>
                              toggleFilter(
                                category as keyof typeof selectedFilters,
                                option
                              )
                            }
                          >
                            {option}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>

              {/* Filtros activos */}
              {Object.values(selectedFilters).flat().length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedFilters).map(([category, values]) =>
                    values.map((value) => (
                      <Badge
                        key={`${category}-${value}`}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                        onClick={() =>
                          toggleFilter(
                            category as keyof typeof selectedFilters,
                            value
                          )
                        }
                      >
                        {value}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Acciones de selección */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllFiltered}
                  disabled={filteredAccounts.length === 0}
                  className="hover:scale-105 transition-transform"
                >
                  Seleccionar filtradas ({filteredAccounts.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedAccounts.length === 0}
                  className="hover:scale-105 transition-transform"
                >
                  Limpiar selección
                </Button>
              </div>
              {selectedAccounts.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {selectedAccounts.length} cuenta
                    {selectedAccounts.length > 1 ? "s" : ""} seleccionada
                    {selectedAccounts.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Lista de cuentas */}
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron cuentas con los filtros aplicados</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-2"
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div
                className={`
                max-h-96 overflow-y-auto overflow-x-hidden custom-scrollbar
                ${
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                    : "space-y-2"
                }
              `}
              >
                {filteredAccounts.map((account, index) => (
                  <label
                    key={account._id}
                    className={`
                      flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer 
                      transition-all duration-300 hover:shadow-md group
                      ${
                        selectedAccounts.includes(account._id)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }
                      ${viewMode === "list" ? "w-full max-w-full" : ""}
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAccounts([
                            ...selectedAccounts,
                            account._id,
                          ]);
                        } else {
                          setSelectedAccounts(
                            selectedAccounts.filter((id) => id !== account._id)
                          );
                        }
                      }}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {account.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">
                          @{account.username}
                        </p>
                        {viewMode === "list" && account.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-full overflow-hidden">
                            {account.labels.slice(0, 3).map((label, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs px-1 py-0 truncate max-w-24"
                              >
                                {label}
                              </Badge>
                            ))}
                            {account.labels.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1 py-0 flex-shrink-0"
                              >
                                +{account.labels.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Resumen de selección */}
            {selectedAccounts.length > 0 && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {selectedAccounts.length} cuenta
                        {selectedAccounts.length > 1 ? "s" : ""} lista
                        {selectedAccounts.length > 1 ? "s" : ""} para acciones
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Tiempo estimado:{" "}
                        {selectedAccounts.length *
                          (baseDelay + randomDelay / 2)}{" "}
                        segundos
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="default"
                    className="bg-blue-600 text-white animate-pulse"
                  >
                    Listas para usar
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración de delays mejorada */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Control de Timing</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configura los delays entre acciones para mayor seguridad
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Delay Base</Label>
                  <Badge variant="outline">{baseDelay}s</Badge>
                </div>
                <Input
                  type="range"
                  min="5"
                  max="120"
                  value={baseDelay}
                  onChange={(e) => setBaseDelay(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5s</span>
                  <span>Rápido</span>
                  <span>Seguro</span>
                  <span>120s</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Delay Aleatorio</Label>
                  <Badge variant="outline">±{randomDelay}s</Badge>
                </div>
                <Input
                  type="range"
                  min="0"
                  max="180"
                  value={randomDelay}
                  onChange={(e) => setRandomDelay(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0s</span>
                  <span>Predictible</span>
                  <span>Natural</span>
                  <span>180s</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Tiempo estimado por cuenta
                </span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {baseDelay} - {baseDelay + randomDelay} segundos entre acciones
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Acciones mejoradas */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-all duration-500 hover:shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Acciones Disponibles</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Selecciona y ejecuta acciones en las cuentas elegidas
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tweet" className="space-y-6">
              <TabsList className="grid w-full grid-cols-7 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger
                  value="tweet"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Tweet
                </TabsTrigger>
                <TabsTrigger
                  value="batch"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <List className="h-4 w-4 mr-1" />
                  Lote
                </TabsTrigger>
                <TabsTrigger
                  value="reply"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Reply
                </TabsTrigger>
                <TabsTrigger
                  value="like"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <Heart className="h-4 w-4 mr-1" />
                  Like
                </TabsTrigger>
                <TabsTrigger
                  value="retweet"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <Repeat className="h-4 w-4 mr-1" />
                  RT
                </TabsTrigger>
                <TabsTrigger
                  value="follow"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Follow
                </TabsTrigger>
                <TabsTrigger
                  value="unfollow"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <UserMinus className="h-4 w-4 mr-1" />
                  Unfollow
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tweet" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="h-5 w-5 text-blue-600" />
                      <Label className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        Crear Tweet
                      </Label>
                    </div>
                    <Textarea
                      placeholder="¿Qué está pasando?"
                      value={tweetText}
                      onChange={(e) => setTweetText(e.target.value)}
                      rows={4}
                      className="resize-none border-2 focus:border-blue-500 transition-colors duration-200"
                      maxLength={280}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`text-sm font-medium ${
                            tweetText.length > 250
                              ? "text-red-500"
                              : tweetText.length > 200
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {tweetText.length}/280
                        </div>
                        <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              tweetText.length > 250
                                ? "bg-red-500"
                                : tweetText.length > 200
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                            }`}
                            style={{
                              width: `${(tweetText.length / 280) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleTweet}
                        disabled={loading || !tweetText.trim()}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Publicar Tweet
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="batch" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <List className="h-5 w-5 text-purple-600" />
                        <Label className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                          Tweets en Lote
                        </Label>
                      </div>
                      <Badge variant="outline" className="text-purple-700">
                        {batchTweets.length} tweets preparados
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Agregar tweets (un tweet por línea)
                      </Label>
                      <Textarea
                        placeholder={`Primer tweet aquí...
Segundo tweet aquí...
Tercer tweet aquí...

Cada línea será un tweet separado`}
                        value={batchTweetText}
                        onChange={(e) => setBatchTweetText(e.target.value)}
                        rows={6}
                        className="resize-none border-2 focus:border-purple-500 transition-colors duration-200"
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {
                            batchTweetText
                              .split("\n")
                              .filter((line) => line.trim()).length
                          }{" "}
                          tweets detectados
                        </div>
                        <Button
                          onClick={handleBatchTweetAdd}
                          disabled={!batchTweetText.trim()}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar al Lote
                        </Button>
                      </div>
                    </div>

                    {/* Lista de tweets en el lote */}
                    {batchTweets.length > 0 && (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Tweets en el lote
                          </Label>
                          <Button
                            onClick={() => setBatchTweets([])}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Limpiar lote
                          </Button>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-3 border rounded-lg p-3 bg-white dark:bg-slate-800">
                          {batchTweets.map((tweet, index) => (
                            <div
                              key={tweet.id}
                              className="border rounded-lg p-3 space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Tweet #{index + 1}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {tweet.text.length}/280 caracteres
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                    {tweet.text}
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    setBatchTweets((prev) =>
                                      prev.filter((t) => t.id !== tweet.id)
                                    )
                                  }
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 ml-2"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Selector de cuentas para este tweet */}
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  Asignar a cuentas:
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                  {selectedAccounts.length === 0 ? (
                                    <span className="text-xs text-muted-foreground italic">
                                      Selecciona cuentas arriba para asignar a
                                      este tweet
                                    </span>
                                  ) : (
                                    selectedAccounts.map((accountId) => {
                                      const account = accounts.find(
                                        (a) => a._id === accountId
                                      );
                                      const isAssigned =
                                        tweet.assignedAccounts.includes(
                                          accountId
                                        );
                                      return (
                                        <Badge
                                          key={accountId}
                                          variant={
                                            isAssigned ? "default" : "outline"
                                          }
                                          className={`cursor-pointer text-xs transition-all duration-200 ${
                                            isAssigned
                                              ? "bg-purple-600 text-white"
                                              : "hover:bg-purple-100 dark:hover:bg-purple-900/20"
                                          }`}
                                          onClick={() => {
                                            const updatedAccounts = isAssigned
                                              ? tweet.assignedAccounts.filter(
                                                  (id) => id !== accountId
                                                )
                                              : [
                                                  ...tweet.assignedAccounts,
                                                  accountId,
                                                ];
                                            handleAssignAccountsToTweet(
                                              tweet.id,
                                              updatedAccounts
                                            );
                                          }}
                                        >
                                          @{account?.username}
                                          {isAssigned && (
                                            <Check className="h-3 w-3 ml-1" />
                                          )}
                                        </Badge>
                                      );
                                    })
                                  )}
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">
                                    {tweet.assignedAccounts.length} cuenta(s)
                                    asignada(s)
                                  </span>
                                  {selectedAccounts.length > 0 && (
                                    <div className="flex gap-1">
                                      <Button
                                        onClick={() =>
                                          handleAssignAccountsToTweet(
                                            tweet.id,
                                            selectedAccounts
                                          )
                                        }
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-6 px-2"
                                      >
                                        Todas
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          handleAssignAccountsToTweet(
                                            tweet.id,
                                            []
                                          )
                                        }
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-6 px-2"
                                      >
                                        Ninguna
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Botón para ejecutar lote */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">
                              {
                                batchTweets.filter(
                                  (t) => t.assignedAccounts.length > 0
                                ).length
                              }
                            </span>{" "}
                            de {batchTweets.length} tweets listos para enviar
                          </div>
                          <Button
                            onClick={handleBatchTweetExecute}
                            disabled={
                              loading ||
                              batchTweets.filter(
                                (t) => t.assignedAccounts.length > 0
                              ).length === 0
                            }
                            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Ejecutar Lote
                          </Button>
                        </div>
                      </div>
                    )}

                    {batchTweets.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-purple-200 dark:border-purple-800 rounded-lg">
                        <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay tweets en el lote</p>
                        <p className="text-xs mt-1">
                          Agrega algunos tweets arriba para comenzar
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reply" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="h-5 w-5 text-green-600" />
                      <Label className="text-lg font-semibold text-green-900 dark:text-green-100">
                        Responder Tweet
                      </Label>
                    </div>
                    <div className="space-y-3">
                      <Input
                        placeholder="https://twitter.com/usuario/status/123..."
                        value={replyTweetUrl}
                        onChange={(e) => setReplyTweetUrl(e.target.value)}
                        className="border-2 focus:border-green-500 transition-colors duration-200"
                      />
                      <Textarea
                        placeholder="Tu respuesta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        className="resize-none border-2 focus:border-green-500 transition-colors duration-200"
                        maxLength={280}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {replyText.length}/280 caracteres
                      </div>
                      <Button
                        onClick={handleReply}
                        disabled={
                          loading || !replyText.trim() || !replyTweetUrl.trim()
                        }
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 hover:scale-105"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Responder
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="like" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-5 w-5 text-red-600" />
                      <Label className="text-lg font-semibold text-red-900 dark:text-red-100">
                        Dar Like
                      </Label>
                    </div>
                    <Input
                      placeholder="https://twitter.com/usuario/status/123..."
                      value={likeTweetUrl}
                      onChange={(e) => setLikeTweetUrl(e.target.value)}
                      className="border-2 focus:border-red-500 transition-colors duration-200"
                    />
                    <Button
                      onClick={handleLike}
                      disabled={loading || !likeTweetUrl.trim()}
                      className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Heart className="h-4 w-4 mr-2" />
                      )}
                      Dar Me Gusta
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="retweet"
                className="space-y-6 animate-fade-in"
              >
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-cyan-200 dark:border-cyan-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Repeat className="h-5 w-5 text-cyan-600" />
                      <Label className="text-lg font-semibold text-cyan-900 dark:text-cyan-100">
                        Retweet
                      </Label>
                    </div>
                    <Input
                      placeholder="https://twitter.com/usuario/status/123..."
                      value={retweetUrl}
                      onChange={(e) => setRetweetUrl(e.target.value)}
                      className="border-2 focus:border-cyan-500 transition-colors duration-200"
                    />
                    <Button
                      onClick={handleRetweet}
                      disabled={loading || !retweetUrl.trim()}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Repeat className="h-4 w-4 mr-2" />
                      )}
                      Retweet
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="follow" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserPlus className="h-5 w-5 text-purple-600" />
                      <Label className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                        Seguir Usuario
                      </Label>
                    </div>
                    <Input
                      placeholder="@usuario o URL del perfil"
                      value={followUser}
                      onChange={(e) => setFollowUser(e.target.value)}
                      className="border-2 focus:border-purple-500 transition-colors duration-200"
                    />
                    <Button
                      onClick={handleFollow}
                      disabled={loading || !followUser.trim()}
                      className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Seguir Usuario
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="unfollow"
                className="space-y-6 animate-fade-in"
              >
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserMinus className="h-5 w-5 text-orange-600" />
                      <Label className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                        Dejar de Seguir
                      </Label>
                    </div>
                    <Input
                      placeholder="@usuario o URL del perfil"
                      value={unfollowUser}
                      onChange={(e) => setUnfollowUser(e.target.value)}
                      className="border-2 focus:border-orange-500 transition-colors duration-200"
                    />
                    <Button
                      onClick={handleUnfollow}
                      disabled={loading || !unfollowUser.trim()}
                      className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4 mr-2" />
                      )}
                      Dejar de Seguir
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Progress mejorado */}
        {loading && (
          <Card className="shadow-xl border-0 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 animate-slide-up">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-lg">
                  <Activity className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-xl">Ejecutando Acciones</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Procesando cuentas seleccionadas...
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Progress
                    value={(progress.current / progress.total) * 100}
                    className="h-3 progress-bar-shimmer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {progress.current} de {progress.total} cuentas procesadas
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Ejecutando acciones con delays de seguridad...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultados mejorados */}
        {actionResults.length > 0 && (
          <Card className="shadow-xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 animate-slide-up">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    Resultados de Ejecución
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Estado de cada cuenta procesada
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {actionResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-300 hover:shadow-md ${
                      result.success
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                    }`}
                    style={{
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          result.success
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {result.success ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium">@{result.account}</span>
                        <p className="text-sm text-muted-foreground">
                          {result.message}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={result.success ? "default" : "destructive"}
                      className="transition-all duration-200 hover:scale-105"
                    >
                      {result.success ? "Éxito" : "Error"}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span>Total procesado: {actionResults.length}</span>
                  <div className="flex gap-4">
                    <span className="text-green-600">
                      ✓ {actionResults.filter((r) => r.success).length} exitosos
                    </span>
                    <span className="text-red-600">
                      ✗ {actionResults.filter((r) => !r.success).length} errores
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
