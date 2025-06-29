"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Loader2,
  Users,
  Heart,
  Repeat,
  UserPlus,
  UserMinus,
  Settings,
  Filter,
  ChevronDown,
  Plus,
  X,
  List,
  Grid,
  Edit,
  Calendar as CalendarIcon,
  CalendarDays,
  Trash2,
  Check,
  CheckCircle,
  Clock,
  AlertCircle,
  Activity,
  Zap,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { API_CONFIG, buildApiUrl } from "@/config/api";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface XAccount {
  _id: string; // ✅ Ahora requerido después de normalización
  id?: string;
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

// Agregar nuevas interfaces para los otros tipos de lotes
interface BatchFollow {
  id: string;
  username: string;
  profileUrl: string;
  assignedAccounts: string[];
}

interface BatchRetweet {
  id: string;
  tweetUrl: string;
  tweetId: string;
  assignedAccounts: string[];
}

// Filtros predefinidos basados en las etiquetas reales de las cuentas
const LABEL_FILTERS = {
  genero: ["varón", "mujer"],
  edad: ["14-18", "18-25", "25-65", "65+"],
  clase: ["baja", "media", "media-baja", "alta"],
  ideologia: ["kukardo", "peroncho-tradicional", "anti-todo pero afín"],
  situacion: [
    "estudia y trabaja",
    "estudiante secundaria",
    "solo estudia",
    "solo trabaja",
    "trabaja",
    "jubilado",
  ],
  profesion: ["-", "estudiante", "trabajador", "profesional", "jubilado"],
};

export default function TweetsPage() {
  const [accounts, setAccounts] = useState<XAccount[]>([]);
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
    genero: string[];
    edad: string[];
    clase: string[];
    ideologia: string[];
    situacion: string[];
    profesion: string[];
  }>({
    genero: [],
    edad: [],
    clase: [],
    ideologia: [],
    situacion: [],
    profesion: [],
  });

  // Estados para modo batch de tweets
  const [batchMode, setBatchMode] = useState(false);
  const [batchTweets, setBatchTweets] = useState<BatchTweet[]>([]);
  const [batchTweetText, setBatchTweetText] = useState("");

  // Nuevos estados para lotes de follows y retweets
  const [batchFollows, setBatchFollows] = useState<BatchFollow[]>([]);
  const [batchFollowText, setBatchFollowText] = useState("");
  const [batchRetweets, setBatchRetweets] = useState<BatchRetweet[]>([]);
  const [batchRetweetText, setBatchRetweetText] = useState("");

  // Estado para el tipo de lote activo
  const [activeBatchType, setActiveBatchType] = useState<
    "tweets" | "follows" | "retweets"
  >("tweets");

  // Estados para el nuevo sistema de asignación masiva
  const [massAssignmentDialogOpen, setMassAssignmentDialogOpen] =
    useState(false);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [selectedItemsForCurrentAccount, setSelectedItemsForCurrentAccount] =
    useState<Set<string>>(new Set());

  // Mantener el dialog individual para compatibilidad
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedItemForAssignment, setSelectedItemForAssignment] = useState<
    string | null
  >(null);

  // Estados para vista
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Estados para programación
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledActions, setScheduledActions] = useState<any[]>([]);
  const [showScheduledActions, setShowScheduledActions] = useState(false);

  // Nuevos estados para distribución temporal aleatoria
  const [useRandomDistribution, setUseRandomDistribution] = useState(false);
  const [distributionValue, setDistributionValue] = useState(24);
  const [distributionUnit, setDistributionUnit] = useState<
    "minutes" | "hours" | "days"
  >("hours");

  // Mapa username -> acciones pendientes (en cola o programadas)
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    fetchAccounts();
    fetchScheduledActions();
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Error al cargar cuentas");
      const data = await response.json();

      // ✅ aseguramos que todas las cuentas tengan _id
      const normalized = data.map((acc: any) => ({
        ...acc,
        _id:
          acc._id ??
          acc.id ??
          `account-${Math.random().toString(36).substr(2, 9)}`,
      }));

      setAccounts(normalized);
    } catch (err) {
      toast.error("Error al cargar las cuentas");
    }
  };

  const fetchScheduledActions = async () => {
    try {
      // Realizar la petición al backend usando helper buildApiUrl
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.STATUS)
      );
      if (!response.ok) {
        console.log("Endpoint de queue no disponible, saltando...");
        return;
      }
      const data = await response.json();
      const scheduled = data.scheduled || data.scheduledActions || [];
      const queue = data.queue || [];
      const allPending = [...scheduled, ...queue];

      // Calcular conteo por username
      const counts: Record<string, number> = {};
      allPending.forEach((act: any) => {
        const username = act.accountUsername || act.username;
        if (!username) return;
        counts[username] = (counts[username] || 0) + 1;
      });

      setScheduledActions(scheduled);
      setPendingCounts(counts);
    } catch (err) {
      console.log("Queue endpoint no disponible:", err);
      // ✅ No mostrar error, simplemente no cargar acciones programadas
    }
  };

  const scheduleAction = async (actionType: string, actionData: any) => {
    if (!scheduledDate || !scheduledTime) {
      toast.error("Selecciona fecha y hora para programar");
      return false;
    }

    try {
      // Crear fecha local manteniendo la hora exacta que el usuario seleccionó
      const localDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);

      // Para Argentina, consideramos un margen más amplio para fechas "futuras"
      const now = new Date();
      const argentinaOffset = -3 * 60; // Argentina UTC-3 en minutos
      const nowInArgentina = new Date(now.getTime() + argentinaOffset * 60000);

      // Verificar que la fecha sea al menos 1 minuto en el futuro
      const minimumTime = new Date(nowInArgentina.getTime() + 1 * 60000); // +1 minuto

      if (localDateTime < minimumTime) {
        toast.error(
          "La fecha programada debe ser al menos 1 minuto en el futuro"
        );
        return false;
      }

      console.log("🕒 Fechas de programación:", {
        inputDate: scheduledDate,
        inputTime: scheduledTime,
        localDateTime: localDateTime.toString(),
        localISOString: localDateTime.toISOString(),
        nowInArgentina: nowInArgentina.toString(),
        minimumTime: minimumTime.toString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      let scheduleData: any;

      if (useRandomDistribution) {
        const randomTimes = generateRandomDistributionTimes(
          selectedAccounts.length
        );

        scheduleData = {
          action: actionType,
          accountIds: selectedAccounts,
          useRandomDistribution: true,
          distributionTimes: randomTimes,
          distributionConfig: {
            value: distributionValue,
            unit: distributionUnit,
            maxTimeMs: convertToMilliseconds(
              distributionValue,
              distributionUnit
            ),
          },
          // La hora programada del conjunto se usa como límite máximo, pero cada acción tiene su propio distributionTime
          scheduledTime: localDateTime.toISOString(),
          ...actionData,
        };
      } else {
        scheduleData = {
          action: actionType,
          accountIds: selectedAccounts,
          scheduledTime: localDateTime.toISOString(),
          baseDelay: baseDelay * 1000,
          randomDelay: randomDelay * 1000,
          useRandomDistribution: false,
          ...actionData,
        };
      }

      console.log(
        "[FRONTEND][SCHEDULE_ACTION] Enviando scheduleData:",
        scheduleData
      );

      // Usar la ruta del backend que ya existe
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.ADD),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(scheduleData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al programar acción");
      }

      const result = await response.json();
      toast.success(
        `Acción programada exitosamente para ${localDateTime.toLocaleString(
          "es-ES"
        )}`
      );
      await fetchScheduledActions();
      return true;
    } catch (err: any) {
      console.error("Error al programar acción:", err);
      toast.error(err.message || "Error al programar acción");
      return false;
    }
  };

  const cancelScheduledAction = async (actionId: string) => {
    try {
      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.CANCEL(actionId)),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cancelar acción");
      }

      const result = await response.json();
      toast.success("Acción cancelada exitosamente");
      await fetchScheduledActions();
    } catch (err: any) {
      console.error("Error al cancelar acción:", err);
      toast.error(err.message || "Error al cancelar acción");
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

    // Filtro por etiquetas - formato real: "categoría:valor"
    const matchesFilters = Object.entries(selectedFilters).every(
      ([category, values]) => {
        if (values.length === 0) return true;

        // Para cada filtro seleccionado, debe haber al menos una coincidencia
        return values.some((filterValue) =>
          account.labels.some((label) => {
            const normalizedLabel = label.toLowerCase().trim();
            const normalizedFilter = filterValue.toLowerCase().trim();

            // Buscar etiquetas con formato "categoría:valor"
            if (normalizedLabel.includes(":")) {
              const [labelCategory, labelValue] = normalizedLabel
                .split(":")
                .map((s) => s.trim());

              // Verificar si la categoría coincide
              if (labelCategory === category.toLowerCase()) {
                // Coincidencia exacta del valor
                if (labelValue === normalizedFilter) {
                  return true;
                }

                // Coincidencia parcial del valor
                if (
                  labelValue.includes(normalizedFilter) ||
                  normalizedFilter.includes(labelValue)
                ) {
                  return true;
                }

                // Manejo especial para ideología (variaciones de kukardo, lukardo, etc.)
                if (category === "ideologia") {
                  const similarity = calculateSimilarity(
                    labelValue,
                    normalizedFilter
                  );
                  if (similarity >= 0.8) {
                    return true;
                  }
                }
              }
            }

            // También buscar coincidencias directas (para compatibilidad con etiquetas sin formato)
            return (
              normalizedLabel.includes(normalizedFilter) ||
              areStringsSimilar(normalizedLabel, normalizedFilter, 0.8)
            );
          })
        );
      }
    );

    return matchesSearch && matchesFilters;
  });

  // Función para obtener todas las cuentas que ya tienen tweets asignados
  const getAccountsWithAssignments = () => {
    const accountsWithAssignments = new Map<string, number>();

    const items =
      activeBatchType === "tweets"
        ? batchTweets
        : activeBatchType === "follows"
        ? batchFollows
        : batchRetweets;

    items.forEach((item) => {
      item.assignedAccounts.forEach((accountId) => {
        accountsWithAssignments.set(
          accountId,
          (accountsWithAssignments.get(accountId) || 0) + 1
        );
      });
    });

    return accountsWithAssignments;
  };

  // Función para abrir el dialog de asignación individual (mantener compatibilidad)
  const openAssignmentDialog = (itemId: string) => {
    setSelectedItemForAssignment(itemId);
    setAssignmentDialogOpen(true);
  };

  // Funciones para el nuevo sistema de asignación masiva
  const openMassAssignmentDialog = () => {
    setCurrentAccountIndex(0);
    setSelectedItemsForCurrentAccount(new Set());
    setMassAssignmentDialogOpen(true);

    // Cargar asignaciones existentes para la primera cuenta
    setTimeout(() => {
      loadAccountAssignments(0);
    }, 100);
  };

  const getCurrentAccount = () => {
    const availableAccounts =
      selectedAccounts.length > 0
        ? accounts.filter((acc) => selectedAccounts.includes(acc._id))
        : filteredAccounts;
    return availableAccounts[currentAccountIndex] || null;
  };

  const getAvailableAccounts = () => {
    return selectedAccounts.length > 0
      ? accounts.filter((acc) => selectedAccounts.includes(acc._id))
      : filteredAccounts;
  };

  const goToNextAccount = () => {
    // Guardar asignaciones de la cuenta actual
    saveCurrentAccountAssignments();

    // Ir a la siguiente cuenta
    const availableAccounts = getAvailableAccounts();
    const nextIndex = (currentAccountIndex + 1) % availableAccounts.length;
    setCurrentAccountIndex(nextIndex);

    // Limpiar selección para la nueva cuenta
    setSelectedItemsForCurrentAccount(new Set());

    // Cargar asignaciones existentes de la nueva cuenta
    loadAccountAssignments(nextIndex);
  };

  const goToPreviousAccount = () => {
    // Guardar asignaciones de la cuenta actual
    saveCurrentAccountAssignments();

    // Ir a la cuenta anterior
    const availableAccounts = getAvailableAccounts();
    const prevIndex =
      currentAccountIndex === 0
        ? availableAccounts.length - 1
        : currentAccountIndex - 1;
    setCurrentAccountIndex(prevIndex);

    // Limpiar selección para la nueva cuenta
    setSelectedItemsForCurrentAccount(new Set());

    // Cargar asignaciones existentes de la nueva cuenta
    loadAccountAssignments(prevIndex);
  };

  const saveCurrentAccountAssignments = () => {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;

    const currentBatch =
      activeBatchType === "tweets"
        ? batchTweets
        : activeBatchType === "follows"
        ? batchFollows
        : batchRetweets;

    // Guardar las asignaciones actuales
    const updatedBatch = currentBatch.map((item) => {
      if (selectedItemsForCurrentAccount.has(item.id)) {
        // Agregar la cuenta actual a este item si no está ya
        if (!item.assignedAccounts.includes(currentAccount._id)) {
          return {
            ...item,
            assignedAccounts: [...item.assignedAccounts, currentAccount._id],
          };
        }
      } else {
        // Remover la cuenta actual de este item si está
        return {
          ...item,
          assignedAccounts: item.assignedAccounts.filter(
            (id) => id !== currentAccount._id
          ),
        };
      }
      return item;
    });

    // Actualizar el estado correspondiente
    if (activeBatchType === "tweets") {
      setBatchTweets(updatedBatch);
    } else if (activeBatchType === "follows") {
      setBatchFollows(updatedBatch);
    } else {
      setBatchRetweets(updatedBatch);
    }
  };

  const loadAccountAssignments = (accountIndex: number) => {
    const availableAccounts = getAvailableAccounts();
    const account = availableAccounts[accountIndex];
    if (!account) return;

    const currentBatch =
      activeBatchType === "tweets"
        ? batchTweets
        : activeBatchType === "follows"
        ? batchFollows
        : batchRetweets;

    // Encontrar items que ya tienen esta cuenta asignada
    const assignedItems = new Set<string>();
    currentBatch.forEach((item) => {
      if (item.assignedAccounts.includes(account._id)) {
        assignedItems.add(item.id);
      }
    });

    setSelectedItemsForCurrentAccount(assignedItems);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItemsForCurrentAccount);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItemsForCurrentAccount(newSelection);
  };

  const selectAllItemsForCurrentAccount = () => {
    const currentBatch =
      activeBatchType === "tweets"
        ? batchTweets
        : activeBatchType === "follows"
        ? batchFollows
        : batchRetweets;
    const allIds = new Set(currentBatch.map((item) => item.id));
    setSelectedItemsForCurrentAccount(allIds);
  };

  const clearAllItemsForCurrentAccount = () => {
    setSelectedItemsForCurrentAccount(new Set());
  };

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
  const handleAssignAccountsToItem = (itemId: string, accountIds: string[]) => {
    if (activeBatchType === "tweets") {
      setBatchTweets((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, assignedAccounts: accountIds } : item
        )
      );
    } else if (activeBatchType === "follows") {
      setBatchFollows((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, assignedAccounts: accountIds } : item
        )
      );
    } else if (activeBatchType === "retweets") {
      setBatchRetweets((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, assignedAccounts: accountIds } : item
        )
      );
    }
  };

  // Función para shuffle de array nativo (sin dependencias externas)
  const shuffleArray = (array: any[]): any[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Función para auto-asignar tweets a cuentas filtradas aleatoriamente (1:1, sin repetir cuentas)
  const handleAutoAssignTweets = () => {
    if (batchTweets.length === 0) {
      toast.error("No hay tweets en el lote para asignar");
      return;
    }

    if (filteredAccounts.length === 0) {
      toast.error("No hay cuentas filtradas disponibles");
      return;
    }

    // Crear una copia de los tweets para modificar
    const updatedTweets = [...batchTweets];

    // Primero: limpiar todas las asignaciones existentes
    updatedTweets.forEach((tweet, index) => {
      updatedTweets[index] = {
        ...tweet,
        assignedAccounts: [],
      };
    });

    // Mezclar ALEATORIAMENTE tanto los tweets como las cuentas
    const shuffledTweets = shuffleArray([...updatedTweets]);
    const shuffledAccounts = shuffleArray([...filteredAccounts]);

    // Determinar cuántos tweets se pueden asignar (máximo = número de cuentas)
    const maxAssignments = Math.min(
      shuffledTweets.length,
      shuffledAccounts.length
    );

    // Asignar solo la cantidad que se pueda sin repetir cuentas
    for (let i = 0; i < maxAssignments; i++) {
      const tweetToAssign = shuffledTweets[i];
      const accountToAssign = shuffledAccounts[i];

      // Encontrar el índice original del tweet en el array principal
      const originalIndex = updatedTweets.findIndex(
        (t) => t.id === tweetToAssign.id
      );

      // Asignar UNA cuenta al tweet seleccionado aleatoriamente
      updatedTweets[originalIndex] = {
        ...tweetToAssign,
        assignedAccounts: [accountToAssign._id],
      };
    }

    setBatchTweets(updatedTweets);

    // Estadísticas precisas
    const totalAssigned = maxAssignments;
    const unassignedTweets = updatedTweets.length - totalAssigned;
    const unassignedAccounts = filteredAccounts.length - totalAssigned;

    let message = `🎲 Auto-asignación ALEATORIA 1:1 completada: ${totalAssigned} tweets asignados`;

    if (unassignedTweets > 0) {
      message += `, ${unassignedTweets} tweets sin asignar`;
    }

    if (unassignedAccounts > 0) {
      message += `, ${unassignedAccounts} cuentas sin usar`;
    }

    message += ` (sin repetir cuentas)`;

    toast.success(message);
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
          // 📋 Construir payload con soporte de distribución aleatoria
          let actionData: any;

          if (useRandomDistribution) {
            const randomTimes = generateRandomDistributionTimes(
              tweet.assignedAccounts.length
            );

            actionData = {
              action: "tweet",
              accountIds: tweet.assignedAccounts,
              text: tweet.text,
              useRandomDistribution: true,
              distributionTimes: randomTimes,
              distributionConfig: {
                value: distributionValue,
                unit: distributionUnit,
                maxTimeMs: convertToMilliseconds(
                  distributionValue,
                  distributionUnit
                ),
              },
            };
          } else {
            actionData = {
              action: "tweet",
              accountIds: tweet.assignedAccounts,
              text: tweet.text,
              baseDelay: baseDelay * 1000, // ms
              randomDelay: randomDelay * 1000, // ms
              useRandomDistribution: false,
            };
          }

          // 🛠️ LOG DETALLADO
          console.log(
            "[FRONTEND][BATCH_TWEET] Enviando actionData:",
            actionData
          );

          // Enviar al sistema de colas usando el endpoint correcto
          const response = await fetch(
            buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.ADD),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(actionData),
            }
          );

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

  // Función para convertir unidades a milisegundos
  const convertToMilliseconds = (value: number, unit: string) => {
    const multipliers = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit as keyof typeof multipliers];
  };

  // Función para generar tiempos aleatorios distribuidos con delay mínimo
  const generateRandomDistributionTimes = (count: number) => {
    if (!useRandomDistribution) return [];

    const maxTimeMs = convertToMilliseconds(
      distributionValue,
      distributionUnit
    );
    const now = Date.now();
    const minDelayMs = 16 * 60 * 1000; // 16 minutos

    // -----------------------------------------------
    // 1) Calculamos la ventana "extra" disponible una
    //    vez restados los delays mínimos obligatorios
    // -----------------------------------------------
    const requiredWindow = (count - 1) * minDelayMs;
    const extraWindow = Math.max(0, maxTimeMs - requiredWindow);

    // 2) Generamos (count-1) números aleatorios y los
    //    normalizamos para repartir el extraWindow de
    //    forma proporcional → brechas variables.
    const randomParts = Array.from({ length: count - 1 }, () => Math.random());
    const randomSum = randomParts.reduce((sum, v) => sum + v, 0) || 1;

    const gaps: number[] = randomParts.map(
      (part) => minDelayMs + (part / randomSum) * extraWindow
    );

    // 3) Construimos los tiempos acumulando las brechas
    const times: Date[] = [new Date(now + gaps[0])];
    for (let i = 1; i < count; i++) {
      const prev = times[i - 1].getTime();
      times.push(new Date(prev + gaps[i]));
    }

    // 4) Devolver ISO strings
    return times.map((t) => t.toISOString());
  };

  // Modificar executeAction para incluir distribución aleatoria
  const executeAction = async (actionType: string, data: any) => {
    if (selectedAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }

    setLoading(true);
    setActionResults([]);

    try {
      let actionData;

      if (useRandomDistribution) {
        // Generar tiempos aleatorios para cada cuenta
        const randomTimes = generateRandomDistributionTimes(
          selectedAccounts.length
        );

        actionData = {
          action: actionType,
          accountIds: selectedAccounts,
          useRandomDistribution: true,
          distributionTimes: randomTimes,
          distributionConfig: {
            value: distributionValue,
            unit: distributionUnit,
            maxTimeMs: convertToMilliseconds(
              distributionValue,
              distributionUnit
            ),
          },
          ...data,
        };
      } else {
        // Usar delays normales
        actionData = {
          action: actionType,
          accountIds: selectedAccounts,
          baseDelay: baseDelay * 1000,
          randomDelay: randomDelay * 1000,
          useRandomDistribution: false,
          ...data,
        };
      }

      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.ADD),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(actionData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Acción ${actionType} añadida a la cola:`, result);

      if (useRandomDistribution) {
        setActionResults([
          {
            account: "Sistema",
            success: true,
            message: `${result.actions.length} acciones distribuidas aleatoriamente en ${distributionValue} ${distributionUnit}`,
            details: `Rango: ${new Date().toLocaleString()} - ${new Date(
              Date.now() +
                convertToMilliseconds(distributionValue, distributionUnit)
            ).toLocaleString()}`,
          },
        ]);

        toast.success(
          `Acciones distribuidas aleatoriamente en ${distributionValue} ${distributionUnit}: ${result.actions.length} acciones programadas`
        );
        await fetchScheduledActions();
      } else {
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
        await fetchScheduledActions();
      }

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

  const handleTweet = async () => {
    if (!tweetText.trim()) {
      toast.error("El texto del tweet es obligatorio");
      return;
    }

    if (isScheduled) {
      const success = await scheduleAction("tweet", { text: tweetText });
      if (success) {
        setTweetText("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("tweet", { text: tweetText });
    }
  };

  const handleReply = async () => {
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

    if (isScheduled) {
      const success = await scheduleAction("reply", {
        text: replyText,
        tweetId,
      });
      if (success) {
        setReplyText("");
        setReplyTweetUrl("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("reply", { text: replyText, tweetId });
    }
  };

  const handleLike = async () => {
    if (!likeTweetUrl.trim()) {
      toast.error("La URL del tweet es obligatoria");
      return;
    }

    const tweetId = extractTweetId(likeTweetUrl);
    if (!tweetId) {
      toast.error("URL de tweet inválida");
      return;
    }

    if (isScheduled) {
      const success = await scheduleAction("like", { tweetId });
      if (success) {
        setLikeTweetUrl("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("like", { tweetId });
    }
  };

  const handleRetweet = async () => {
    if (!retweetUrl.trim()) {
      toast.error("La URL del tweet es obligatoria");
      return;
    }

    const tweetId = extractTweetId(retweetUrl);
    if (!tweetId) {
      toast.error("URL de tweet inválida");
      return;
    }

    if (isScheduled) {
      const success = await scheduleAction("retweet", { tweetId });
      if (success) {
        setRetweetUrl("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("retweet", { tweetId });
    }
  };

  const handleFollow = async () => {
    if (!followUser.trim()) {
      toast.error("El usuario es obligatorio");
      return;
    }

    // Extraer username de URL si es necesario
    const targetUsername = extractUsernameFromUrl(followUser) || followUser;

    if (isScheduled) {
      const success = await scheduleAction("follow", {
        targetUsername: targetUsername,
      });
      if (success) {
        setFollowUser("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("follow", { targetUsername: targetUsername });
    }
  };

  const handleUnfollow = async () => {
    if (!unfollowUser.trim()) {
      toast.error("El usuario es obligatorio");
      return;
    }

    // Extraer username de URL si es necesario
    const targetUsername = extractUsernameFromUrl(unfollowUser) || unfollowUser;

    if (isScheduled) {
      const success = await scheduleAction("unfollow", {
        targetUsername: targetUsername,
      });
      if (success) {
        setUnfollowUser("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("unfollow", { targetUsername: targetUsername });
    }
  };

  const selectAllAccounts = () => {
    setSelectedAccounts(accounts.map((acc) => acc._id)); // ✅ Usar accounts en lugar de filteredAccounts
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
      genero: [],
      edad: [],
      clase: [],
      ideologia: [],
      situacion: [],
      profesion: [],
    });
    setSearchQuery("");
  };

  // Componente para el control de programación actualizado
  const ScheduleControl = () => (
    <div className="border-t mt-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={isScheduled}
            onCheckedChange={setIsScheduled}
            id="schedule-toggle"
          />
          <Label
            htmlFor="schedule-toggle"
            className="text-sm font-medium text-gray-700"
          >
            Programar para más tarde
          </Label>
        </div>
      </div>

      {isScheduled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Fecha</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="border-gray-300 focus:border-gray-500"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Hora</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="border-gray-300 focus:border-gray-500"
            />
          </div>
          {scheduledDate && scheduledTime && (
            <div className="flex items-center justify-center text-sm text-gray-700 bg-gray-100 rounded-lg p-3">
              <Clock className="h-4 w-4 mr-2" />
              <div className="text-center">
                <div className="font-medium">Se ejecutará:</div>
                <div className="text-xs">
                  {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString(
                    "es-ES",
                    {
                      dateStyle: "short",
                      timeStyle: "short",
                    }
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Función para extraer username de URL de perfil
  const extractUsernameFromUrl = (url: string): string | null => {
    const trimmedUrl = url.trim();
    try {
      const urlObj = new URL(trimmedUrl);
      if (urlObj.hostname === "twitter.com" || urlObj.hostname === "x.com") {
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          return pathParts[0].replace(/^@/, "");
        }
      }
      return trimmedUrl.replace(/^@+/, "");
    } catch {
      return trimmedUrl.replace(/^@+/, "");
    }
  };

  // Función para agregar follows en lote
  const handleBatchFollowAdd = () => {
    if (!batchFollowText.trim()) return;

    const lines = batchFollowText.split("\n").filter((line) => line.trim());
    const newFollows: BatchFollow[] = [];

    lines.forEach((line, index) => {
      const username = extractUsernameFromUrl(line);
      if (username) {
        newFollows.push({
          id: `batch-follow-${Date.now()}-${index}`,
          username,
          profileUrl: line.trim(),
          assignedAccounts: [],
        });
      }
    });

    setBatchFollows((prev) => [...prev, ...newFollows]);
    setBatchFollowText("");
    toast.success(`${newFollows.length} cuentas agregadas al lote de follows`);
  };

  // Función para agregar retweets en lote
  const handleBatchRetweetAdd = () => {
    if (!batchRetweetText.trim()) return;

    const lines = batchRetweetText.split("\n").filter((line) => line.trim());
    const newRetweets: BatchRetweet[] = [];

    lines.forEach((line, index) => {
      const tweetId = extractTweetId(line.trim());
      if (tweetId) {
        newRetweets.push({
          id: `batch-retweet-${Date.now()}-${index}`,
          tweetUrl: line.trim(),
          tweetId,
          assignedAccounts: [],
        });
      }
    });

    setBatchRetweets((prev) => [...prev, ...newRetweets]);
    setBatchRetweetText("");
    toast.success(`${newRetweets.length} retweets agregados al lote`);
  };

  // Función para auto-asignar follows
  const handleAutoAssignFollows = () => {
    if (batchFollows.length === 0) {
      toast.error("No hay follows en el lote para asignar");
      return;
    }

    if (filteredAccounts.length === 0) {
      toast.error("No hay cuentas filtradas disponibles");
      return;
    }

    const updatedFollows = [...batchFollows];
    updatedFollows.forEach((follow, index) => {
      updatedFollows[index] = { ...follow, assignedAccounts: [] };
    });

    const shuffledFollows = shuffleArray([...updatedFollows]);
    const shuffledAccounts = shuffleArray([...filteredAccounts]);
    const maxAssignments = Math.min(
      shuffledFollows.length,
      shuffledAccounts.length
    );

    for (let i = 0; i < maxAssignments; i++) {
      const followToAssign = shuffledFollows[i];
      const accountToAssign = shuffledAccounts[i];
      const originalIndex = updatedFollows.findIndex(
        (f) => f.id === followToAssign.id
      );
      updatedFollows[originalIndex] = {
        ...followToAssign,
        assignedAccounts: [accountToAssign._id],
      };
    }

    setBatchFollows(updatedFollows);

    const totalAssigned = maxAssignments;
    const unassignedFollows = updatedFollows.length - totalAssigned;

    let message = `🎲 Auto-asignación ALEATORIA 1:1 completada: ${totalAssigned} follows asignados`;
    if (unassignedFollows > 0) {
      message += `, ${unassignedFollows} follows sin asignar`;
    }

    toast.success(message);
  };

  // Función para auto-asignar retweets
  const handleAutoAssignRetweets = () => {
    if (batchRetweets.length === 0) {
      toast.error("No hay retweets en el lote para asignar");
      return;
    }

    if (filteredAccounts.length === 0) {
      toast.error("No hay cuentas filtradas disponibles");
      return;
    }

    const updatedRetweets = [...batchRetweets];
    updatedRetweets.forEach((retweet, index) => {
      updatedRetweets[index] = { ...retweet, assignedAccounts: [] };
    });

    const shuffledRetweets = shuffleArray([...updatedRetweets]);
    const shuffledAccounts = shuffleArray([...filteredAccounts]);
    const maxAssignments = Math.min(
      shuffledRetweets.length,
      shuffledAccounts.length
    );

    for (let i = 0; i < maxAssignments; i++) {
      const retweetToAssign = shuffledRetweets[i];
      const accountToAssign = shuffledAccounts[i];
      const originalIndex = updatedRetweets.findIndex(
        (r) => r.id === retweetToAssign.id
      );
      updatedRetweets[originalIndex] = {
        ...retweetToAssign,
        assignedAccounts: [accountToAssign._id],
      };
    }

    setBatchRetweets(updatedRetweets);

    const totalAssigned = maxAssignments;
    const unassignedRetweets = updatedRetweets.length - totalAssigned;

    let message = `🎲 Auto-asignación ALEATORIA 1:1 completada: ${totalAssigned} retweets asignados`;
    if (unassignedRetweets > 0) {
      message += `, ${unassignedRetweets} retweets sin asignar`;
    }

    toast.success(message);
  };

  // Función para ejecutar follows en lote
  const handleBatchFollowExecute = async () => {
    const followsToExecute = batchFollows.filter(
      (follow) => follow.assignedAccounts.length > 0
    );

    if (followsToExecute.length === 0) {
      toast.error("Asigna al menos una cuenta a cada follow");
      return;
    }

    setLoading(true);
    setActionResults([]);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const follow of followsToExecute) {
        try {
          // 📋 Construir payload con distribución aleatoria cuando corresponda
          let actionData: any;
          if (useRandomDistribution) {
            const randomTimes = generateRandomDistributionTimes(
              follow.assignedAccounts.length
            );

            actionData = {
              action: "follow",
              accountIds: follow.assignedAccounts,
              targetUsername: follow.username,
              useRandomDistribution: true,
              distributionTimes: randomTimes,
              distributionConfig: {
                value: distributionValue,
                unit: distributionUnit,
                maxTimeMs: convertToMilliseconds(
                  distributionValue,
                  distributionUnit
                ),
              },
            };
          } else {
            actionData = {
              action: "follow",
              accountIds: follow.assignedAccounts,
              targetUsername: follow.username,
              baseDelay: baseDelay * 1000,
              randomDelay: randomDelay * 1000,
              useRandomDistribution: false,
            };
          }

          console.log(
            "[FRONTEND][BATCH_FOLLOW] Enviando actionData:",
            actionData
          );

          const response = await fetch(
            buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.ADD),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(actionData),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
          }

          const result = await response.json();
          successCount++;

          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: true,
              message: `Follow a @${follow.username} enviado a ${follow.assignedAccounts.length} cuentas`,
            },
          ]);
        } catch (error: any) {
          errorCount++;
          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: false,
              message: `Error en follow a @${follow.username}: ${error.message}`,
            },
          ]);
        }

        if (followsToExecute.indexOf(follow) < followsToExecute.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} lotes de follows enviados exitosamente`);
        setBatchFollows([]);
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} lotes fallaron`);
      }
    } catch (error: any) {
      toast.error("Error ejecutando los lotes de follows");
    } finally {
      setLoading(false);
    }
  };

  // Función para ejecutar retweets en lote
  const handleBatchRetweetExecute = async () => {
    const retweetsToExecute = batchRetweets.filter(
      (retweet) => retweet.assignedAccounts.length > 0
    );

    if (retweetsToExecute.length === 0) {
      toast.error("Asigna al menos una cuenta a cada retweet");
      return;
    }

    setLoading(true);
    setActionResults([]);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const retweet of retweetsToExecute) {
        try {
          let actionData: any;
          if (useRandomDistribution) {
            const randomTimes = generateRandomDistributionTimes(
              retweet.assignedAccounts.length
            );

            actionData = {
              action: "retweet",
              accountIds: retweet.assignedAccounts,
              tweetId: retweet.tweetId,
              useRandomDistribution: true,
              distributionTimes: randomTimes,
              distributionConfig: {
                value: distributionValue,
                unit: distributionUnit,
                maxTimeMs: convertToMilliseconds(
                  distributionValue,
                  distributionUnit
                ),
              },
            };
          } else {
            actionData = {
              action: "retweet",
              accountIds: retweet.assignedAccounts,
              tweetId: retweet.tweetId,
              baseDelay: baseDelay * 1000,
              randomDelay: randomDelay * 1000,
              useRandomDistribution: false,
            };
          }

          console.log(
            "[FRONTEND][BATCH_RETWEET] Enviando actionData:",
            actionData
          );

          const response = await fetch(
            buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.ADD),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(actionData),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
          }

          const result = await response.json();
          successCount++;

          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: true,
              message: `Retweet enviado a ${retweet.assignedAccounts.length} cuentas`,
            },
          ]);
        } catch (error: any) {
          errorCount++;
          setActionResults((prev) => [
            ...prev,
            {
              account: "Sistema",
              success: false,
              message: `Error en retweet: ${error.message}`,
            },
          ]);
        }

        if (retweetsToExecute.indexOf(retweet) < retweetsToExecute.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} lotes de retweets enviados exitosamente`
        );
        setBatchRetweets([]);
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} lotes fallaron`);
      }
    } catch (error: any) {
      toast.error("Error ejecutando los lotes de retweets");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Hero Section - más limpio */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="bg-gray-100 p-3 rounded-full">
            <Zap className="h-8 w-8 text-gray-700" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Panel de Acciones de Twitter
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Gestiona todas las acciones de Twitter desde un solo lugar
        </p>
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Activity className="h-4 w-4 text-green-600" />
            <span>Tiempo real</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4 text-gray-700" />
            <span>{accounts.length} cuentas disponibles</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Selección de cuentas - tema light */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-gray-700" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900">
                    Seleccionar Cuentas para Acciones
                  </CardTitle>
                  <p className="text-sm text-gray-600">
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
                  className="border-gray-300 hover:bg-gray-50"
                >
                  {viewMode === "grid" ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <Grid className="h-4 w-4" />
                  )}
                </Button>
                <Badge
                  variant="outline"
                  className="border-gray-300 text-gray-700"
                >
                  {filteredAccounts.length} de {accounts.length}
                </Badge>
              </div>
            </div>

            {/* Barra de búsqueda */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o etiqueta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 border-gray-300 focus:border-gray-500"
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
                <Label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                  <Filter className="h-4 w-4" />
                  Filtrar por etiquetas
                </Label>
                {(Object.values(selectedFilters).flat().length > 0 ||
                  searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(LABEL_FILTERS).map(([category, options]) => (
                  <div
                    key={`filter-category-${category}`}
                    className="space-y-2"
                  >
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {category === "ideologia"
                        ? "Ideología"
                        : category === "profesion"
                        ? "Profesión"
                        : category === "situacion"
                        ? "Situación"
                        : category === "genero"
                        ? "Género"
                        : category}
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between text-sm border-gray-300 hover:bg-gray-50"
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
                            : `Seleccionar ${
                                category === "ideologia"
                                  ? "ideología"
                                  : category === "profesion"
                                  ? "profesión"
                                  : category === "situacion"
                                  ? "situación"
                                  : category === "genero"
                                  ? "género"
                                  : category
                              }`}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-white border-gray-200">
                        <DropdownMenuLabel className="text-gray-700">
                          Filtros de{" "}
                          {category === "ideologia"
                            ? "ideología"
                            : category === "profesion"
                            ? "profesión"
                            : category === "situacion"
                            ? "situación"
                            : category === "genero"
                            ? "género"
                            : category}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {options.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={`filter-option-${category}-${option}`}
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
                        key={`active-filter-${category}-${value}`}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors border-gray-300"
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
                  className="border-gray-300 hover:bg-gray-50"
                >
                  Seleccionar filtradas ({filteredAccounts.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedAccounts.length === 0}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  Limpiar selección
                </Button>
              </div>
              {selectedAccounts.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
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
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron cuentas con los filtros aplicados</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-2 text-gray-600 hover:text-gray-800"
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div
                className={`
                max-h-96 overflow-y-auto overflow-x-hidden
                ${
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                    : "space-y-2"
                }
              `}
              >
                {filteredAccounts.map((account, index) => (
                  <div
                    key={`account-${account._id}`}
                    className={`
                      flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer 
                      transition-all duration-300 hover:shadow-md group
                      ${
                        selectedAccounts.includes(account._id)
                          ? "border-gray-400 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }
                      ${viewMode === "list" ? "w-full max-w-full" : ""}
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                    onClick={() => {
                      if (selectedAccounts.includes(account._id)) {
                        setSelectedAccounts(
                          selectedAccounts.filter((id) => id !== account._id)
                        );
                      } else {
                        setSelectedAccounts([...selectedAccounts, account._id]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account._id)}
                      className="pointer-events-none"
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <Avatar className="w-8 h-8 border border-gray-200 flex-shrink-0">
                        <AvatarImage
                          src={`https://unavatar.io/twitter/${account.username}`}
                          alt={`@${account.username}`}
                        />
                        <AvatarFallback className="bg-gray-600 text-white text-sm font-semibold">
                          {account.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-gray-900 flex items-center gap-1">
                          @{account.username}
                          {pendingCounts[account.username] &&
                            pendingCounts[account.username] > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1 py-0 bg-yellow-500 text-white"
                              >
                                +{pendingCounts[account.username]}
                              </Badge>
                            )}
                        </p>
                        {viewMode === "list" && account.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-full overflow-hidden">
                            {account.labels.slice(0, 3).map((label, idx) => (
                              <Badge
                                key={`label-${account._id}-${idx}`}
                                variant="outline"
                                className="text-xs px-1 py-0 truncate max-w-24 border-gray-300 text-gray-600"
                              >
                                {label}
                              </Badge>
                            ))}
                            {account.labels.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1 py-0 flex-shrink-0 border-gray-300 text-gray-600"
                              >
                                +{account.labels.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen de selección */}
            {selectedAccounts.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-gray-700" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedAccounts.length} cuenta
                        {selectedAccounts.length > 1 ? "s" : ""} lista
                        {selectedAccounts.length > 1 ? "s" : ""} para acciones
                      </p>
                      <p className="text-xs text-gray-600">
                        Tiempo estimado:{" "}
                        {selectedAccounts.length *
                          (baseDelay + randomDelay / 2)}{" "}
                        segundos
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-gray-700 text-white">
                    Listas para usar
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración de delays */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900">
                  Control de Timing
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configura los delays entre acciones para mayor seguridad
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Switch para activar distribución aleatoria */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-blue-900">
                    🎲 Distribución Temporal Aleatoria
                  </Label>
                  <p className="text-xs text-blue-700 mt-1">
                    Distribuye las acciones aleatoriamente dentro del rango de
                    tiempo especificado
                  </p>
                </div>
              </div>
              <Switch
                checked={useRandomDistribution}
                onCheckedChange={setUseRandomDistribution}
                id="random-distribution-toggle"
              />
            </div>

            {useRandomDistribution ? (
              // Configuración de distribución aleatoria
              <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                  </div>
                  <Label className="text-sm font-semibold text-purple-900">
                    Configuración de Distribución Aleatoria
                  </Label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-purple-800">
                      Rango de Tiempo
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={distributionValue}
                        onChange={(e) =>
                          setDistributionValue(parseInt(e.target.value) || 1)
                        }
                        className="flex-1 border-purple-300 focus:border-purple-500"
                        placeholder="24"
                      />
                      <Select
                        value={distributionUnit}
                        onValueChange={(value: any) =>
                          setDistributionUnit(value)
                        }
                      >
                        <SelectTrigger className="w-32 border-purple-300 focus:border-purple-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutos</SelectItem>
                          <SelectItem value="hours">Horas</SelectItem>
                          <SelectItem value="days">Días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-purple-600">
                      Las acciones se ejecutarán en momentos aleatorios dentro
                      de {distributionValue} {distributionUnit}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-purple-800">
                      Vista Previa del Rango
                    </Label>
                    <div className="p-3 bg-white rounded-lg border border-purple-200">
                      <div className="text-xs text-purple-700">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>
                            Inicio:{" "}
                            {new Date().toLocaleString("es-ES", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span>
                            Fin:{" "}
                            {new Date(
                              Date.now() +
                                convertToMilliseconds(
                                  distributionValue,
                                  distributionUnit
                                )
                            ).toLocaleString("es-ES", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedAccounts.length > 0 && (
                      <div className="text-xs text-purple-600 bg-purple-100 p-2 rounded">
                        📊 {selectedAccounts.length} acciones se distribuirán
                        aleatoriamente en este rango
                      </div>
                    )}
                  </div>
                </div>

                {/* NUEVA INFORMACIÓN SOBRE DELAY MÍNIMO */}
                <div className="p-3 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg border border-orange-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-orange-800">
                      <p className="font-medium mb-1">
                        ⏰ Delay Mínimo de Seguridad:
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          <strong>16 minutos</strong> mínimo entre cada acción
                        </li>
                        <li>
                          Evita errores 429 (Too Many Requests) de Twitter
                        </li>
                        <li>Se aplica automáticamente a todas las acciones</li>
                        {selectedAccounts.length > 1 && (
                          <li>
                            Con {selectedAccounts.length} acciones: tiempo
                            mínimo total de{" "}
                            <strong>
                              {Math.ceil((selectedAccounts.length * 16) / 60)}{" "}
                              horas
                            </strong>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-purple-800">
                      <p className="font-medium mb-1">💡 Cómo funciona:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          Cada acción se programa para un momento aleatorio
                          dentro del rango
                        </li>
                        <li>
                          <strong>NUEVO:</strong> Respeta un mínimo de 16
                          minutos entre acciones
                        </li>
                        <li>
                          No hay delays secuenciales - todas son independientes
                        </li>
                        <li>Ideal para simular actividad natural y orgánica</li>
                        <li>
                          Evita patrones detectables y errores de rate limiting
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Configuración de delays normales (código existente)
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-gray-700">
                      Delay Base
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-gray-300 text-gray-700"
                    >
                      {baseDelay}s
                    </Badge>
                  </div>
                  <Input
                    type="range"
                    min="5"
                    max="120"
                    value={baseDelay}
                    onChange={(e) => setBaseDelay(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>5s</span>
                    <span>Rápido</span>
                    <span>Seguro</span>
                    <span>120s</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-gray-700">
                      Delay Aleatorio
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-gray-300 text-gray-700"
                    >
                      ±{randomDelay}s
                    </Badge>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="180"
                    value={randomDelay}
                    onChange={(e) => setRandomDelay(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0s</span>
                    <span>Predictible</span>
                    <span>Natural</span>
                    <span>180s</span>
                  </div>
                </div>
              </div>
            )}

            {!useRandomDistribution && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-gray-700" />
                  <span className="text-sm font-medium text-gray-900">
                    Tiempo estimado por cuenta
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {baseDelay} - {baseDelay + randomDelay} segundos entre
                  acciones
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones - tema light */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <Send className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900">
                  Acciones Disponibles
                </CardTitle>
                <p className="text-sm text-gray-600">
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="h-5 w-5 text-blue-600" />
                      <Label className="text-lg font-semibold text-blue-900">
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
                        disabled={
                          loading ||
                          !tweetText.trim() ||
                          (isScheduled && (!scheduledDate || !scheduledTime))
                        }
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : isScheduled ? (
                          <CalendarIcon className="h-4 w-4 mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {isScheduled ? "Programar Tweet" : "Publicar Tweet"}
                      </Button>
                    </div>
                    <ScheduleControl />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="batch" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <List className="h-5 w-5 text-purple-600" />
                        <Label className="text-lg font-semibold text-purple-900">
                          Acciones en Lote
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-purple-700 border-purple-300"
                        >
                          {activeBatchType === "tweets" &&
                            `${batchTweets.length} tweets`}
                          {activeBatchType === "follows" &&
                            `${batchFollows.length} follows`}
                          {activeBatchType === "retweets" &&
                            `${batchRetweets.length} retweets`}
                        </Badge>
                      </div>
                    </div>

                    {/* Subtabs para tipos de lote */}
                    <Tabs
                      value={activeBatchType}
                      onValueChange={(value) =>
                        setActiveBatchType(value as any)
                      }
                      className="space-y-4"
                    >
                      <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger
                          value="tweets"
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Tweets
                        </TabsTrigger>
                        <TabsTrigger
                          value="follows"
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Follows
                        </TabsTrigger>
                        <TabsTrigger
                          value="retweets"
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                          <Repeat className="h-4 w-4 mr-1" />
                          Retweets
                        </TabsTrigger>
                      </TabsList>

                      {/* Tab de Tweets (existente) */}
                      <TabsContent value="tweets" className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-purple-800">
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
                            <div className="text-xs text-purple-700">
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
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar al Lote
                            </Button>
                          </div>
                        </div>

                        {/* Botón para abrir asignación masiva */}
                        {batchTweets.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Tweets en el lote ({batchTweets.length})
                              </Label>
                              <div className="flex gap-2">
                                <Button
                                  onClick={openMassAssignmentDialog}
                                  variant="default"
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                >
                                  <Edit className="h-4 w-4 mr-1" />✨ Asignar
                                  Cuentas
                                </Button>
                                <Button
                                  onClick={handleAutoAssignTweets}
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    batchTweets.length === 0 ||
                                    filteredAccounts.length === 0
                                  }
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  🎲 Auto-asignar 1:1
                                </Button>
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
                            </div>

                            {/* Vista resumida del lote */}
                            <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-purple-100 p-2 rounded-lg">
                                    <Send className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-purple-900">
                                      {batchTweets.length} Tweets
                                    </p>
                                    <p className="text-xs text-purple-700">
                                      En el lote
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 p-2 rounded-lg">
                                    <Users className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-blue-900">
                                      {
                                        new Set(
                                          batchTweets.flatMap(
                                            (t) => t.assignedAccounts
                                          )
                                        ).size
                                      }{" "}
                                      Cuentas
                                    </p>
                                    <p className="text-xs text-blue-700">
                                      Utilizadas
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-green-100 p-2 rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-green-900">
                                      {
                                        batchTweets.filter(
                                          (t) => t.assignedAccounts.length > 0
                                        ).length
                                      }{" "}
                                      Listos
                                    </p>
                                    <p className="text-xs text-green-700">
                                      Para ejecutar
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 text-center">
                                <p className="text-xs text-purple-600">
                                  💡 Usa el botón "✨ Asignar Cuentas" para
                                  gestionar las asignaciones de forma eficiente
                                </p>
                              </div>
                            </div>

                            {/* Controles de programación para lote */}
                            <ScheduleControl />

                            {/* Botón para ejecutar lote */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                              <div className="text-sm text-gray-700">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <span className="font-medium text-green-700">
                                      {
                                        batchTweets.filter(
                                          (t) => t.assignedAccounts.length > 0
                                        ).length
                                      }
                                    </span>{" "}
                                    de {batchTweets.length} tweets listos
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-700">
                                      {
                                        new Set(
                                          batchTweets.flatMap(
                                            (t) => t.assignedAccounts
                                          )
                                        ).size
                                      }
                                    </span>{" "}
                                    cuentas utilizadas
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-800">
                                      {batchTweets.reduce(
                                        (sum, t) =>
                                          sum + t.assignedAccounts.length,
                                        0
                                      )}
                                    </span>{" "}
                                    asignaciones totales
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={async () => {
                                  if (isScheduled) {
                                    // Programar lote
                                    const tweetsToSchedule = batchTweets.filter(
                                      (tweet) =>
                                        tweet.assignedAccounts.length > 0
                                    );
                                    let successCount = 0;
                                    for (const tweet of tweetsToSchedule) {
                                      const success = await scheduleAction(
                                        "tweet",
                                        {
                                          text: tweet.text,
                                          accountIds: tweet.assignedAccounts,
                                        }
                                      );
                                      if (success) successCount++;
                                    }
                                    if (successCount > 0) {
                                      setBatchTweets([]);
                                      toast.success(
                                        `${successCount} tweets programados exitosamente`
                                      );
                                    }
                                  } else {
                                    // Ejecutar inmediatamente
                                    handleBatchTweetExecute();
                                  }
                                }}
                                disabled={
                                  loading ||
                                  batchTweets.filter(
                                    (t) => t.assignedAccounts.length > 0
                                  ).length === 0 ||
                                  (isScheduled &&
                                    (!scheduledDate || !scheduledTime))
                                }
                                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105 text-white cursor-pointer"
                              >
                                {loading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : isScheduled ? (
                                  <CalendarIcon className="h-4 w-4 mr-2" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                {isScheduled
                                  ? "Programar Lote"
                                  : "Ejecutar Lote"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {batchTweets.length === 0 && (
                          <div className="text-center py-8 text-purple-600 border-2 border-dashed border-purple-200 rounded-lg">
                            <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay tweets en el lote</p>
                            <p className="text-xs mt-1">
                              Agrega algunos tweets arriba para comenzar
                            </p>
                          </div>
                        )}

                        {/* Información sobre auto-asignación */}
                        {batchTweets.length > 0 &&
                          filteredAccounts.length > 0 && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                              <div className="flex items-start gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                                  <Zap className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                                    🎲 Auto-asignación 1:1 Aleatoria (Sin
                                    Repetir Cuentas)
                                  </h4>
                                  <div className="space-y-2 text-xs text-blue-800">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
                                      <span>
                                        🎲 Selecciona tweets y cuentas
                                        ALEATORIAMENTE
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
                                      <span>
                                        🚫 SIN REPETIR cuentas (1 cuenta = máx 1
                                        tweet)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
                                      <span>
                                        📊 {batchTweets.length} tweets
                                        disponibles, {filteredAccounts.length}{" "}
                                        cuentas → Solo se asignarán{" "}
                                        {Math.min(
                                          batchTweets.length,
                                          filteredAccounts.length
                                        )}{" "}
                                        tweets
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                      </TabsContent>

                      {/* Tab de Follows */}
                      <TabsContent value="follows" className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-purple-800">
                            Agregar cuentas a seguir (una cuenta por línea)
                          </Label>
                          <Textarea
                            placeholder={`https://twitter.com/usuario1
https://x.com/usuario2
@usuario3
usuario4

Puedes usar URLs completas o solo usernames`}
                            value={batchFollowText}
                            onChange={(e) => setBatchFollowText(e.target.value)}
                            rows={6}
                            className="resize-none border-2 focus:border-purple-500 transition-colors duration-200"
                          />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-purple-700">
                              {
                                batchFollowText
                                  .split("\n")
                                  .filter((line) => line.trim()).length
                              }{" "}
                              cuentas detectadas
                            </div>
                            <Button
                              onClick={handleBatchFollowAdd}
                              disabled={!batchFollowText.trim()}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar al Lote
                            </Button>
                          </div>
                        </div>

                        {/* Lista de follows */}
                        {batchFollows.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Cuentas a seguir en el lote (
                                {batchFollows.length})
                              </Label>
                              <div className="flex gap-2">
                                <Button
                                  onClick={openMassAssignmentDialog}
                                  variant="default"
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                >
                                  <Edit className="h-4 w-4 mr-1" />✨ Asignar
                                  Cuentas
                                </Button>
                                <Button
                                  onClick={handleAutoAssignFollows}
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    batchFollows.length === 0 ||
                                    filteredAccounts.length === 0
                                  }
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  🎲 Auto-asignar 1:1
                                </Button>
                                <Button
                                  onClick={() => setBatchFollows([])}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Limpiar lote
                                </Button>
                              </div>
                            </div>

                            {/* Vista resumida del lote de follows */}
                            <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-green-100 p-2 rounded-lg">
                                    <UserPlus className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-green-900">
                                      {batchFollows.length} Follows
                                    </p>
                                    <p className="text-xs text-green-700">
                                      En el lote
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 p-2 rounded-lg">
                                    <Users className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-blue-900">
                                      {
                                        new Set(
                                          batchFollows.flatMap(
                                            (f) => f.assignedAccounts
                                          )
                                        ).size
                                      }{" "}
                                      Cuentas
                                    </p>
                                    <p className="text-xs text-blue-700">
                                      Utilizadas
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-purple-100 p-2 rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-purple-900">
                                      {
                                        batchFollows.filter(
                                          (f) => f.assignedAccounts.length > 0
                                        ).length
                                      }{" "}
                                      Listos
                                    </p>
                                    <p className="text-xs text-purple-700">
                                      Para ejecutar
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 text-center">
                                <p className="text-xs text-green-600">
                                  💡 Usa el botón "✨ Asignar Cuentas" para
                                  gestionar las asignaciones de forma eficiente
                                </p>
                              </div>
                            </div>

                            <ScheduleControl />

                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                              <div className="text-sm text-gray-700">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <span className="font-medium text-green-700">
                                      {
                                        batchFollows.filter(
                                          (f) => f.assignedAccounts.length > 0
                                        ).length
                                      }
                                    </span>{" "}
                                    de {batchFollows.length} follows listos
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-700">
                                      {
                                        new Set(
                                          batchFollows.flatMap(
                                            (f) => f.assignedAccounts
                                          )
                                        ).size
                                      }
                                    </span>{" "}
                                    cuentas utilizadas
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={async () => {
                                  if (isScheduled) {
                                    const followsToSchedule =
                                      batchFollows.filter(
                                        (follow) =>
                                          follow.assignedAccounts.length > 0
                                      );
                                    let successCount = 0;
                                    for (const follow of followsToSchedule) {
                                      const success = await scheduleAction(
                                        "follow",
                                        {
                                          targetUsername: follow.username,
                                          accountIds: follow.assignedAccounts,
                                        }
                                      );
                                      if (success) successCount++;
                                    }
                                    if (successCount > 0) {
                                      setBatchFollows([]);
                                      toast.success(
                                        `${successCount} follows programados exitosamente`
                                      );
                                    }
                                  } else {
                                    handleBatchFollowExecute();
                                  }
                                }}
                                disabled={
                                  loading ||
                                  batchFollows.filter(
                                    (f) => f.assignedAccounts.length > 0
                                  ).length === 0 ||
                                  (isScheduled &&
                                    (!scheduledDate || !scheduledTime))
                                }
                                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105 text-white"
                              >
                                {loading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4 mr-2" />
                                )}
                                {isScheduled
                                  ? "Programar Follows"
                                  : "Ejecutar Follows"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {batchFollows.length === 0 && (
                          <div className="text-center py-8 text-purple-600 border-2 border-dashed border-purple-200 rounded-lg">
                            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay follows en el lote</p>
                            <p className="text-xs mt-1">
                              Agrega algunas cuentas arriba para comenzar
                            </p>
                          </div>
                        )}
                      </TabsContent>

                      {/* Tab de Retweets */}
                      <TabsContent value="retweets" className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-purple-800">
                            Agregar tweets para retweet (una URL por línea)
                          </Label>
                          <Textarea
                            placeholder={`https://twitter.com/usuario1/status/123456789
https://x.com/usuario2/status/987654321
https://twitter.com/usuario3/status/555666777

Pega las URLs de los tweets que quieres retwitear`}
                            value={batchRetweetText}
                            onChange={(e) =>
                              setBatchRetweetText(e.target.value)
                            }
                            rows={6}
                            className="resize-none border-2 focus:border-purple-500 transition-colors duration-200"
                          />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-purple-700">
                              {
                                batchRetweetText
                                  .split("\n")
                                  .filter((line) => extractTweetId(line.trim()))
                                  .length
                              }{" "}
                              tweets válidos detectados
                            </div>
                            <Button
                              onClick={handleBatchRetweetAdd}
                              disabled={!batchRetweetText.trim()}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar al Lote
                            </Button>
                          </div>
                        </div>

                        {/* Lista de retweets */}
                        {batchRetweets.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Retweets en el lote ({batchRetweets.length})
                              </Label>
                              <div className="flex gap-2">
                                <Button
                                  onClick={openMassAssignmentDialog}
                                  variant="default"
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                >
                                  <Edit className="h-4 w-4 mr-1" />✨ Asignar
                                  Cuentas
                                </Button>
                                <Button
                                  onClick={handleAutoAssignRetweets}
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    batchRetweets.length === 0 ||
                                    filteredAccounts.length === 0
                                  }
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  🎲 Auto-asignar 1:1
                                </Button>
                                <Button
                                  onClick={() => setBatchRetweets([])}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Limpiar lote
                                </Button>
                              </div>
                            </div>

                            {/* Vista resumida del lote de retweets */}
                            <div className="border rounded-lg p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-cyan-100 p-2 rounded-lg">
                                    <Repeat className="h-4 w-4 text-cyan-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-cyan-900">
                                      {batchRetweets.length} Retweets
                                    </p>
                                    <p className="text-xs text-cyan-700">
                                      En el lote
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 p-2 rounded-lg">
                                    <Users className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-blue-900">
                                      {
                                        new Set(
                                          batchRetweets.flatMap(
                                            (r) => r.assignedAccounts
                                          )
                                        ).size
                                      }{" "}
                                      Cuentas
                                    </p>
                                    <p className="text-xs text-blue-700">
                                      Utilizadas
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="bg-purple-100 p-2 rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-purple-900">
                                      {
                                        batchRetweets.filter(
                                          (r) => r.assignedAccounts.length > 0
                                        ).length
                                      }{" "}
                                      Listos
                                    </p>
                                    <p className="text-xs text-purple-700">
                                      Para ejecutar
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 text-center">
                                <p className="text-xs text-cyan-600">
                                  💡 Usa el botón "✨ Asignar Cuentas" para
                                  gestionar las asignaciones de forma eficiente
                                </p>
                              </div>
                            </div>

                            <ScheduleControl />

                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                              <div className="text-sm text-gray-700">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <span className="font-medium text-green-700">
                                      {
                                        batchRetweets.filter(
                                          (r) => r.assignedAccounts.length > 0
                                        ).length
                                      }
                                    </span>{" "}
                                    de {batchRetweets.length} retweets listos
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-700">
                                      {
                                        new Set(
                                          batchRetweets.flatMap(
                                            (r) => r.assignedAccounts
                                          )
                                        ).size
                                      }
                                    </span>{" "}
                                    cuentas utilizadas
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={async () => {
                                  if (isScheduled) {
                                    const retweetsToSchedule =
                                      batchRetweets.filter(
                                        (retweet) =>
                                          retweet.assignedAccounts.length > 0
                                      );
                                    let successCount = 0;
                                    for (const retweet of retweetsToSchedule) {
                                      const success = await scheduleAction(
                                        "retweet",
                                        {
                                          tweetId: retweet.tweetId,
                                          accountIds: retweet.assignedAccounts,
                                        }
                                      );
                                      if (success) successCount++;
                                    }
                                    if (successCount > 0) {
                                      setBatchRetweets([]);
                                      toast.success(
                                        `${successCount} retweets programados exitosamente`
                                      );
                                    }
                                  } else {
                                    handleBatchRetweetExecute();
                                  }
                                }}
                                disabled={
                                  loading ||
                                  batchRetweets.filter(
                                    (r) => r.assignedAccounts.length > 0
                                  ).length === 0 ||
                                  (isScheduled &&
                                    (!scheduledDate || !scheduledTime))
                                }
                                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105 text-white"
                              >
                                {loading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Repeat className="h-4 w-4 mr-2" />
                                )}
                                {isScheduled
                                  ? "Programar Retweets"
                                  : "Ejecutar Retweets"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {batchRetweets.length === 0 && (
                          <div className="text-center py-8 text-purple-600 border-2 border-dashed border-purple-200 rounded-lg">
                            <Repeat className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                              No hay retweets en el lote
                            </p>
                            <p className="text-xs mt-1">
                              Agrega algunas URLs de tweets arriba para comenzar
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reply" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="h-5 w-5 text-green-600" />
                      <Label className="text-lg font-semibold text-green-900">
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
                      <div className="text-sm text-green-700">
                        {replyText.length}/280 caracteres
                      </div>
                      <Button
                        onClick={handleReply}
                        disabled={
                          loading ||
                          !replyText.trim() ||
                          !replyTweetUrl.trim() ||
                          (isScheduled && (!scheduledDate || !scheduledTime))
                        }
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 hover:scale-105"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : isScheduled ? (
                          <CalendarIcon className="h-4 w-4 mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {isScheduled ? "Programar Respuesta" : "Responder"}
                      </Button>
                    </div>
                    <ScheduleControl />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="like" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-5 w-5 text-red-600" />
                      <Label className="text-lg font-semibold text-red-900">
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
                      disabled={
                        loading ||
                        !likeTweetUrl.trim() ||
                        (isScheduled && (!scheduledDate || !scheduledTime))
                      }
                      className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isScheduled ? (
                        <CalendarIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <Heart className="h-4 w-4 mr-2" />
                      )}
                      {isScheduled ? "Programar Like" : "Dar Me Gusta"}
                    </Button>
                    <ScheduleControl />
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="retweet"
                className="space-y-6 animate-fade-in"
              >
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Repeat className="h-5 w-5 text-cyan-600" />
                      <Label className="text-lg font-semibold text-cyan-900">
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
                      disabled={
                        loading ||
                        !retweetUrl.trim() ||
                        (isScheduled && (!scheduledDate || !scheduledTime))
                      }
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isScheduled ? (
                        <CalendarIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <Repeat className="h-4 w-4 mr-2" />
                      )}
                      {isScheduled ? "Programar Retweet" : "Retweet"}
                    </Button>
                    <ScheduleControl />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="follow" className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserPlus className="h-5 w-5 text-purple-600" />
                      <Label className="text-lg font-semibold text-purple-900">
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
                      disabled={
                        loading ||
                        !followUser.trim() ||
                        (isScheduled && (!scheduledDate || !scheduledTime))
                      }
                      className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isScheduled ? (
                        <CalendarIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      {isScheduled ? "Programar Follow" : "Seguir Usuario"}
                    </Button>
                    <ScheduleControl />
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="unfollow"
                className="space-y-6 animate-fade-in"
              >
                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserMinus className="h-5 w-5 text-orange-600" />
                      <Label className="text-lg font-semibold text-orange-900">
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
                      disabled={
                        loading ||
                        !unfollowUser.trim() ||
                        (isScheduled && (!scheduledDate || !scheduledTime))
                      }
                      className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200 hover:scale-105 w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isScheduled ? (
                        <CalendarIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <UserMinus className="h-4 w-4 mr-2" />
                      )}
                      {isScheduled ? "Programar Unfollow" : "Dejar de Seguir"}
                    </Button>
                    <ScheduleControl />
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
          <Card className="shadow-md border border-gray-200 bg-white animate-slide-up">
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
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-300 hover:shadow-sm ${
                      result.success
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
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

      {/* Lista de acciones programadas */}
      {showScheduledActions && scheduledActions.length > 0 && (
        <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    Acciones Programadas
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {scheduledActions.length} acciones esperando ejecución
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScheduledActions(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scheduledActions.map((action: any, index: number) => (
                <div
                  key={action.id || index}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-800 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {action.action === "tweet" && (
                        <Send className="h-4 w-4 text-blue-600" />
                      )}
                      {action.action === "reply" && (
                        <Send className="h-4 w-4 text-green-600" />
                      )}
                      {action.action === "like" && (
                        <Heart className="h-4 w-4 text-red-600" />
                      )}
                      {action.action === "retweet" && (
                        <Repeat className="h-4 w-4 text-cyan-600" />
                      )}
                      {action.action === "follow" && (
                        <UserPlus className="h-4 w-4 text-purple-600" />
                      )}
                      {action.action === "unfollow" && (
                        <UserMinus className="h-4 w-4 text-orange-600" />
                      )}
                      <Badge variant="outline" className="capitalize">
                        {action.action}
                      </Badge>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {action.accountIds?.length || 0} cuenta
                          {(action.accountIds?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(action.scheduledTime).toLocaleString(
                            "es-ES"
                          )}
                        </span>
                      </div>
                      {action.text && (
                        <p className="text-sm text-muted-foreground truncate">
                          {action.text.length > 50
                            ? `${action.text.substring(0, 50)}...`
                            : action.text}
                        </p>
                      )}
                      {(action.tweetId || action.targetUserId) && (
                        <p className="text-xs text-muted-foreground">
                          {action.tweetId && `Tweet ID: ${action.tweetId}`}
                          {action.targetUserId &&
                            `Usuario: ${action.targetUserId}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        action.status === "scheduled" ? "secondary" : "default"
                      }
                      className="text-xs"
                    >
                      {action.status === "scheduled"
                        ? "Programado"
                        : action.status}
                    </Badge>
                    {action.status === "scheduled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelScheduledAction(action.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {scheduledActions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay acciones programadas</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog para asignación de cuentas */}
      <Dialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
      >
        <DialogContent className="max-w-[95vw] max-h-[90vh] w-[90vw] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Edit className="h-5 w-5 text-purple-600" />
              Asignar Cuentas al{" "}
              {activeBatchType === "tweets"
                ? "Tweet"
                : activeBatchType === "follows"
                ? "Follow"
                : "Retweet"}
            </DialogTitle>
            <DialogDescription>
              {selectedItemForAssignment && (
                <>
                  <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-medium text-purple-900">
                      {activeBatchType === "tweets" &&
                        `Tweet: "${
                          batchTweets.find(
                            (t) => t.id === selectedItemForAssignment
                          )?.text
                        }"`}
                      {activeBatchType === "follows" &&
                        `Seguir a: @${
                          batchFollows.find(
                            (f) => f.id === selectedItemForAssignment
                          )?.username
                        }`}
                      {activeBatchType === "retweets" &&
                        `Retweet de: ${
                          batchRetweets.find(
                            (r) => r.id === selectedItemForAssignment
                          )?.tweetId
                        }`}
                    </p>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItemForAssignment && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-6">
              {/* Indicadores de cuentas ya asignadas */}
              <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900">
                      Resumen de Asignaciones del Lote
                    </h4>
                    <p className="text-xs text-blue-700">
                      Cuentas con tweets asignados en este lote
                    </p>
                  </div>
                </div>

                {(() => {
                  const accountsWithAssignments = getAccountsWithAssignments();
                  const totalAssignments = Array.from(
                    accountsWithAssignments.values()
                  ).reduce((sum, count) => sum + count, 0);

                  return accountsWithAssignments.size > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-blue-100 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-900">
                            {accountsWithAssignments.size} cuentas seleccionadas
                          </span>
                        </div>
                        <Badge
                          variant="default"
                          className="bg-blue-600 text-white"
                        >
                          {totalAssignments} asignaciones totales
                        </Badge>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {Array.from(accountsWithAssignments.entries()).map(
                          ([accountId, count]) => {
                            const account = accounts.find(
                              (a) => a._id === accountId
                            );
                            return (
                              <div
                                key={accountId}
                                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-200"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Avatar className="w-10 h-10 border border-gray-200">
                                    <AvatarImage
                                      src={`https://unavatar.io/twitter/${account?.username}`}
                                      alt={`@${account?.username}`}
                                    />
                                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-violet-600 text-white text-lg font-semibold">
                                      {account?.username[0].toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm text-gray-800 truncate">
                                    @{account?.username}
                                  </span>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 border-blue-300 flex-shrink-0 ml-2"
                                >
                                  {count} tweet{count > 1 ? "s" : ""}
                                </Badge>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-blue-700 text-sm">
                        Ninguna cuenta tiene tweets asignados aún
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Selecciona cuentas para los tweets en el lote
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Lista de cuentas disponibles */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Seleccionar cuentas
                    </h4>
                    {selectedAccounts.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-800"
                      >
                        Mostrando solo cuentas seleccionadas
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedItemForAssignment) {
                          handleAssignAccountsToItem(
                            selectedItemForAssignment,
                            selectedAccounts.length > 0
                              ? selectedAccounts
                              : filteredAccounts.map((a) => a._id)
                          );
                        }
                      }}
                      disabled={
                        selectedAccounts.length === 0 &&
                        filteredAccounts.length === 0
                      }
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {selectedAccounts.length > 0
                        ? `Asignar seleccionadas (${selectedAccounts.length})`
                        : `Asignar filtradas (${filteredAccounts.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedItemForAssignment) {
                          handleAssignAccountsToItem(
                            selectedItemForAssignment,
                            []
                          );
                        }
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Quitar todas
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-3 pr-2">
                    {/* Mostrar solo cuentas seleccionadas si hay alguna, sino mostrar todas */}
                    {(selectedAccounts.length > 0
                      ? accounts.filter((account) =>
                          selectedAccounts.includes(account._id)
                        )
                      : filteredAccounts
                    ).map((account) => {
                      const currentBatch =
                        activeBatchType === "tweets"
                          ? batchTweets
                          : activeBatchType === "follows"
                          ? batchFollows
                          : batchRetweets;

                      const isAssigned =
                        currentBatch
                          .find((item) => item.id === selectedItemForAssignment)
                          ?.assignedAccounts.includes(account._id) || false;
                      const assignmentCount =
                        getAccountsWithAssignments().get(account._id) || 0;

                      return (
                        <div
                          key={account._id}
                          className={`
                            relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md
                            ${
                              isAssigned
                                ? "border-purple-500 bg-purple-50"
                                : "border-gray-200 hover:border-purple-300 bg-white"
                            }
                          `}
                          onClick={() => {
                            if (selectedItemForAssignment) {
                              const currentItem = currentBatch.find(
                                (item) => item.id === selectedItemForAssignment
                              );
                              if (currentItem) {
                                const updatedAccounts = isAssigned
                                  ? currentItem.assignedAccounts.filter(
                                      (id) => id !== account._id
                                    )
                                  : [
                                      ...currentItem.assignedAccounts,
                                      account._id,
                                    ];
                                handleAssignAccountsToItem(
                                  selectedItemForAssignment,
                                  updatedAccounts
                                );
                              }
                            }
                          }}
                        >
                          {/* Indicador de múltiples asignaciones */}
                          {assignmentCount > 1 && (
                            <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                              {assignmentCount}
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <Checkbox
                                checked={isAssigned}
                                className="pointer-events-none"
                              />
                              <Avatar className="w-10 h-10 border border-gray-200">
                                <AvatarImage
                                  src={`https://unavatar.io/twitter/${account.username}`}
                                  alt={`@${account.username}`}
                                />
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-violet-600 text-white text-lg font-semibold">
                                  {account.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold text-base text-purple-900 flex items-center gap-1">
                                  @{account.username}
                                  {pendingCounts[account.username] &&
                                    pendingCounts[account.username] > 0 && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1 py-0 bg-yellow-500 text-white"
                                      >
                                        +{pendingCounts[account.username]}
                                      </Badge>
                                    )}
                                </p>
                                {isAssigned && (
                                  <Badge
                                    variant="default"
                                    className="bg-purple-600 text-white"
                                  >
                                    Asignada
                                  </Badge>
                                )}
                              </div>

                              {account.labels.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {account.labels.map((label, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-xs bg-white border-purple-200 text-purple-700"
                                    >
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {assignmentCount > 0 && (
                                <div className="mt-2 text-sm text-yellow-700 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" />
                                  <span>
                                    Ya tiene {assignmentCount} tweet
                                    {assignmentCount > 1 ? "s" : ""} asignado
                                    {assignmentCount > 1 ? "s" : ""} en este
                                    lote
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex-shrink-0">
                              {isAssigned ? (
                                <div className="flex items-center gap-1 text-green-700">
                                  <CheckCircle className="h-5 w-5" />
                                  <span className="text-sm font-medium">
                                    Seleccionada
                                  </span>
                                </div>
                              ) : (
                                <div className="text-gray-600">
                                  <span className="text-sm">
                                    Clic para seleccionar
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredAccounts.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No se encontraron cuentas con los filtros aplicados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-gray-700">
                {selectedItemForAssignment && (
                  <>
                    {
                      (
                        (activeBatchType === "tweets"
                          ? batchTweets
                          : activeBatchType === "follows"
                          ? batchFollows
                          : batchRetweets
                        ).find((item) => item.id === selectedItemForAssignment)
                          ?.assignedAccounts || []
                      ).length
                    }{" "}
                    cuenta(s) asignada(s)
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAssignmentDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setAssignmentDialogOpen(false)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Guardar Asignaciones
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuevo Dialog para Asignación Masiva */}
      <Dialog
        open={massAssignmentDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Guardar cambios antes de cerrar
            saveCurrentAccountAssignments();
          }
          setMassAssignmentDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-[98vw] max-h-[95vh] w-[98vw] h-[95vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-3 text-gray-900">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Edit className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  ✨ Asignación Masiva de{" "}
                  {activeBatchType === "tweets"
                    ? "Tweets"
                    : activeBatchType === "follows"
                    ? "Follows"
                    : "Retweets"}
                </h2>
                <p className="text-sm text-gray-600 font-normal">
                  Selecciona cuentas arriba y {activeBatchType} abajo para
                  asignar rápidamente
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Sección de Cuentas - Parte Superior */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">
                      Seleccionar Cuenta Activa
                    </h3>
                    <p className="text-sm text-blue-700">
                      {getAvailableAccounts().length} cuentas disponibles
                    </p>
                  </div>
                </div>

                {/* Controles de navegación entre cuentas */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={goToPreviousAccount}
                    variant="outline"
                    size="sm"
                    disabled={getAvailableAccounts().length <= 1}
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    ← Anterior
                  </Button>

                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">
                      {currentAccountIndex + 1} de{" "}
                      {getAvailableAccounts().length}
                    </span>
                  </div>

                  <Button
                    onClick={goToNextAccount}
                    variant="default"
                    size="sm"
                    disabled={getAvailableAccounts().length <= 1}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Siguiente →
                  </Button>
                </div>
              </div>

              {/* Cuenta actual */}
              {getCurrentAccount() && (
                <div className="bg-white rounded-lg border-2 border-blue-300 p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Check className="h-5 w-5 text-blue-600" />
                    </div>
                    <Avatar className="w-12 h-12 border-2 border-blue-300">
                      <AvatarImage
                        src={`https://unavatar.io/twitter/${
                          getCurrentAccount()?.username
                        }`}
                        alt={`@${getCurrentAccount()?.username}`}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold">
                        {getCurrentAccount()?.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-blue-900">
                        @{getCurrentAccount()?.username}
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getCurrentAccount()
                          ?.labels.slice(0, 4)
                          .map((label, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs border-blue-300 text-blue-700"
                            >
                              {label}
                            </Badge>
                          ))}
                        {(getCurrentAccount()?.labels.length || 0) > 4 && (
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-300 text-blue-700"
                          >
                            +{(getCurrentAccount()?.labels.length || 0) - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-900">
                        {selectedItemsForCurrentAccount.size} seleccionados
                      </p>
                      <p className="text-xs text-blue-700">
                        de{" "}
                        {activeBatchType === "tweets"
                          ? batchTweets.length
                          : activeBatchType === "follows"
                          ? batchFollows.length
                          : batchRetweets.length}{" "}
                        items
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!getCurrentAccount() && (
                <div className="text-center py-8 text-blue-600">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay cuentas disponibles</p>
                  <p className="text-xs mt-1">
                    Selecciona cuentas en la sección principal primero
                  </p>
                </div>
              )}
            </div>

            {/* Sección de Items - Parte Inferior */}
            <div className="flex-1 overflow-hidden flex flex-col bg-purple-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    {activeBatchType === "tweets" && (
                      <Send className="h-5 w-5 text-purple-600" />
                    )}
                    {activeBatchType === "follows" && (
                      <UserPlus className="h-5 w-5 text-purple-600" />
                    )}
                    {activeBatchType === "retweets" && (
                      <Repeat className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900">
                      {activeBatchType === "tweets"
                        ? "Tweets"
                        : activeBatchType === "follows"
                        ? "Cuentas a Seguir"
                        : "Retweets"}{" "}
                      del Lote
                    </h3>
                    <p className="text-sm text-purple-700">
                      Selecciona los items para asignar a @
                      {getCurrentAccount()?.username}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={selectAllItemsForCurrentAccount}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-600 hover:bg-purple-50"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Seleccionar Todos
                  </Button>
                  <Button
                    onClick={clearAllItemsForCurrentAccount}
                    variant="ghost"
                    size="sm"
                    className="text-purple-600 hover:bg-purple-50"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpiar
                  </Button>
                </div>
              </div>

              {/* Lista de items */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Tweets */}
                  {activeBatchType === "tweets" &&
                    batchTweets.map((tweet, index) => (
                      <div
                        key={tweet.id}
                        className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md
                        ${
                          selectedItemsForCurrentAccount.has(tweet.id)
                            ? "border-purple-500 bg-purple-100"
                            : "border-gray-200 hover:border-purple-300 bg-white"
                        }
                      `}
                        onClick={() => toggleItemSelection(tweet.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedItemsForCurrentAccount.has(
                              tweet.id
                            )}
                            className="pointer-events-none mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-purple-300 text-purple-700"
                              >
                                Tweet #{index + 1}
                              </Badge>
                              <span className="text-xs text-purple-600">
                                {tweet.text.length}/280
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">
                              {tweet.text}
                            </p>
                            <div className="mt-2 text-xs text-gray-600">
                              {tweet.assignedAccounts.length} cuenta(s) ya
                              asignada(s)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Follows */}
                  {activeBatchType === "follows" &&
                    batchFollows.map((follow, index) => (
                      <div
                        key={follow.id}
                        className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md
                        ${
                          selectedItemsForCurrentAccount.has(follow.id)
                            ? "border-purple-500 bg-purple-100"
                            : "border-gray-200 hover:border-purple-300 bg-white"
                        }
                      `}
                        onClick={() => toggleItemSelection(follow.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedItemsForCurrentAccount.has(
                              follow.id
                            )}
                            className="pointer-events-none mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-purple-300 text-purple-700"
                              >
                                Follow #{index + 1}
                              </Badge>
                              <UserPlus className="h-4 w-4 text-green-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-800">
                              @{follow.username}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {follow.profileUrl}
                            </p>
                            <div className="mt-2 text-xs text-gray-600">
                              {follow.assignedAccounts.length} cuenta(s) ya
                              asignada(s)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Retweets */}
                  {activeBatchType === "retweets" &&
                    batchRetweets.map((retweet, index) => (
                      <div
                        key={retweet.id}
                        className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md
                        ${
                          selectedItemsForCurrentAccount.has(retweet.id)
                            ? "border-purple-500 bg-purple-100"
                            : "border-gray-200 hover:border-purple-300 bg-white"
                        }
                      `}
                        onClick={() => toggleItemSelection(retweet.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedItemsForCurrentAccount.has(
                              retweet.id
                            )}
                            className="pointer-events-none mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-purple-300 text-purple-700"
                              >
                                Retweet #{index + 1}
                              </Badge>
                              <Repeat className="h-4 w-4 text-cyan-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-800">
                              Tweet ID: {retweet.tweetId}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {retweet.tweetUrl}
                            </p>
                            <div className="mt-2 text-xs text-gray-600">
                              {retweet.assignedAccounts.length} cuenta(s) ya
                              asignada(s)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Estado vacío */}
                {((activeBatchType === "tweets" && batchTweets.length === 0) ||
                  (activeBatchType === "follows" &&
                    batchFollows.length === 0) ||
                  (activeBatchType === "retweets" &&
                    batchRetweets.length === 0)) && (
                  <div className="text-center py-12 text-purple-600">
                    {activeBatchType === "tweets" && (
                      <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    )}
                    {activeBatchType === "follows" && (
                      <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    )}
                    {activeBatchType === "retweets" && (
                      <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    )}
                    <p className="text-lg font-medium">
                      No hay {activeBatchType} en el lote
                    </p>
                    <p className="text-sm mt-1">
                      Agrega algunos {activeBatchType} primero para poder
                      asignar cuentas
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer con estadísticas y botones */}
          <div className="flex-shrink-0 border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-sm text-gray-700">
                  <span className="font-medium text-purple-900">
                    {selectedItemsForCurrentAccount.size}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium">
                    {activeBatchType === "tweets"
                      ? batchTweets.length
                      : activeBatchType === "follows"
                      ? batchFollows.length
                      : batchRetweets.length}
                  </span>{" "}
                  seleccionados para @{getCurrentAccount()?.username}
                </div>

                <div className="text-sm text-gray-700">
                  Cuenta{" "}
                  <span className="font-medium text-blue-900">
                    {currentAccountIndex + 1}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium">
                    {getAvailableAccounts().length}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    saveCurrentAccountAssignments();
                    setMassAssignmentDialogOpen(false);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    saveCurrentAccountAssignments();
                    setMassAssignmentDialogOpen(false);
                    toast.success("Asignaciones guardadas correctamente");
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Guardar Asignaciones
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
