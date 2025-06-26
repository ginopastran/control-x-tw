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

  // Nuevo estado para el dialog de asignación
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedTweetForAssignment, setSelectedTweetForAssignment] = useState<
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

  useEffect(() => {
    fetchAccounts();
    // ✅ Comentar fetch problemático por ahora
    // fetchScheduledActions();
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
      // ✅ Verificar si el endpoint existe antes de hacer fetch
      const response = await fetch("/api/queue/status");
      if (!response.ok) {
        console.log("Endpoint de queue no disponible, saltando...");
        return;
      }
      const data = await response.json();
      const scheduled = data.scheduledActions || [];
      setScheduledActions(scheduled);
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

      const scheduleData = {
        action: actionType,
        accountIds: selectedAccounts,
        scheduledTime: localDateTime.toISOString(),
        baseDelay: baseDelay * 1000,
        randomDelay: randomDelay * 1000,
        ...actionData,
      };

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

  // Función para obtener todas las cuentas que ya tienen tweets asignados
  const getAccountsWithAssignments = () => {
    const accountsWithAssignments = new Map<string, number>();

    batchTweets.forEach((tweet) => {
      tweet.assignedAccounts.forEach((accountId) => {
        accountsWithAssignments.set(
          accountId,
          (accountsWithAssignments.get(accountId) || 0) + 1
        );
      });
    });

    return accountsWithAssignments;
  };

  // Función para abrir el dialog de asignación
  const openAssignmentDialog = (tweetId: string) => {
    setSelectedTweetForAssignment(tweetId);
    setAssignmentDialogOpen(true);
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
          // Preparar datos de la acción para el sistema de cola
          const actionData = {
            action: "tweet",
            accountIds: tweet.assignedAccounts,
            text: tweet.text,
            baseDelay: baseDelay * 1000, // Convertir a milliseconds
            randomDelay: randomDelay * 1000, // Convertir a milliseconds
          };

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

    if (isScheduled) {
      const success = await scheduleAction("follow", {
        targetUserId: followUser,
      });
      if (success) {
        setFollowUser("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("follow", { targetUserId: followUser });
    }
  };

  const handleUnfollow = async () => {
    if (!unfollowUser.trim()) {
      toast.error("El usuario es obligatorio");
      return;
    }

    if (isScheduled) {
      const success = await scheduleAction("unfollow", {
        targetUserId: unfollowUser,
      });
      if (success) {
        setUnfollowUser("");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("");
      }
    } else {
      executeAction("unfollow", { targetUserId: unfollowUser });
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
      edad: [],
      ideologia: [],
      situacion: [],
    });
    setSearchQuery("");
  };

  // Componente para el control de programación
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
        {/* ✅ Comentar temporalmente hasta que el endpoint funcione */}
        {/* {scheduledActions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScheduledActions(!showScheduledActions)}
            className="text-xs"
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Ver programadas ({scheduledActions.length})
          </Button>
        )} */}
      </div>

      {isScheduled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Fecha</Label>
            {/* ✅ Usar input simple en lugar del Calendar problemático por ahora */}
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
                    {" "}
                    {/* ✅ Key única */}
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {category}
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
                            : `Seleccionar ${category}`}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-white border-gray-200">
                        <DropdownMenuLabel className="text-gray-700">
                          Filtros de {category}
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
                    key={`account-${account._id}`} // ✅ Key única fija
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
                      // ✅ Manejar click directamente en el div
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
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {account.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-gray-900">
                          @{account.username}
                        </p>
                        {viewMode === "list" && account.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-full overflow-hidden">
                            {account.labels.slice(0, 3).map((label, idx) => (
                              <Badge
                                key={`label-${account._id}-${idx}`} // ✅ Key única
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
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-gray-700" />
                <span className="text-sm font-medium text-gray-900">
                  Tiempo estimado por cuenta
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {baseDelay} - {baseDelay + randomDelay} segundos entre acciones
              </p>
            </div>
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <List className="h-5 w-5 text-purple-600" />
                        <Label className="text-lg font-semibold text-purple-900">
                          Tweets en Lote
                        </Label>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-purple-700 border-purple-300"
                      >
                        {batchTweets.length} tweets preparados
                      </Badge>
                    </div>

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
                          className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
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
                          <div className="flex gap-2">
                            <Button
                              onClick={handleAutoAssignTweets}
                              variant="default"
                              size="sm"
                              disabled={
                                batchTweets.length === 0 ||
                                filteredAccounts.length === 0
                              }
                              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                              <Zap className="h-4 w-4 mr-1" />
                              🎲 Auto-asignar 1:1 Aleatorio
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

                        <div className="max-h-96 overflow-y-auto space-y-3 border rounded-lg p-3 bg-white">
                          {batchTweets.map((tweet, index) => (
                            <div
                              key={tweet.id}
                              className="border border-gray-200 bg-gray-50 rounded-lg p-3 space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-purple-300 text-purple-700"
                                    >
                                      Tweet #{index + 1}
                                    </Badge>
                                    <span className="text-xs text-purple-600">
                                      {tweet.text.length}/280 caracteres
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-800 line-clamp-2">
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

                              {/* Información de asignación y botón para dialog */}
                              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-800">
                                      {tweet.assignedAccounts.length} cuenta
                                      {tweet.assignedAccounts.length !== 1
                                        ? "s"
                                        : ""}{" "}
                                      asignada
                                      {tweet.assignedAccounts.length !== 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  </div>
                                  {tweet.assignedAccounts.length > 0 && (
                                    <div className="flex gap-1 max-w-48 overflow-hidden">
                                      {tweet.assignedAccounts
                                        .slice(0, 3)
                                        .map((accountId) => {
                                          const account = accounts.find(
                                            (a) => a._id === accountId
                                          );
                                          return (
                                            <Badge
                                              key={accountId}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              @{account?.username}
                                            </Badge>
                                          );
                                        })}
                                      {tweet.assignedAccounts.length > 3 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          +{tweet.assignedAccounts.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  onClick={() => openAssignmentDialog(tweet.id)}
                                  size="sm"
                                  variant="outline"
                                  className="hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Asignar cuentas
                                </Button>
                              </div>
                            </div>
                          ))}
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
                                    (sum, t) => sum + t.assignedAccounts.length,
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
                                  (tweet) => tweet.assignedAccounts.length > 0
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
                            {isScheduled ? "Programar Lote" : "Ejecutar Lote"}
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
                    {batchTweets.length > 0 && filteredAccounts.length > 0 && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                            <Zap className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">
                              🎲 Auto-asignación 1:1 Aleatoria (Sin Repetir
                              Cuentas)
                            </h4>
                            <div className="space-y-2 text-xs text-blue-800">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
                                <span>
                                  🎲 Selecciona tweets y cuentas ALEATORIAMENTE
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
                                  📊 {batchTweets.length} tweets disponibles,{" "}
                                  {filteredAccounts.length} cuentas → Solo se
                                  asignarán{" "}
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
              Asignar Cuentas al Tweet
            </DialogTitle>
            <DialogDescription>
              {selectedTweetForAssignment && (
                <>
                  <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-medium text-purple-900">
                      Tweet: "
                      {
                        batchTweets.find(
                          (t) => t.id === selectedTweetForAssignment
                        )?.text
                      }
                      "
                    </p>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedTweetForAssignment && (
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
                                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                    {account?.username[0].toUpperCase()}
                                  </div>
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
                        if (selectedTweetForAssignment) {
                          handleAssignAccountsToTweet(
                            selectedTweetForAssignment,
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
                        if (selectedTweetForAssignment) {
                          handleAssignAccountsToTweet(
                            selectedTweetForAssignment,
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
                      const isAssigned =
                        batchTweets
                          .find((t) => t.id === selectedTweetForAssignment)
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
                            if (selectedTweetForAssignment) {
                              const currentTweet = batchTweets.find(
                                (t) => t.id === selectedTweetForAssignment
                              );
                              if (currentTweet) {
                                const updatedAccounts = isAssigned
                                  ? currentTweet.assignedAccounts.filter(
                                      (id) => id !== account._id
                                    )
                                  : [
                                      ...currentTweet.assignedAccounts,
                                      account._id,
                                    ];
                                handleAssignAccountsToTweet(
                                  selectedTweetForAssignment,
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
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center text-white text-lg font-semibold">
                                {account.username[0].toUpperCase()}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold text-base text-purple-900">
                                  @{account.username}
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
                {selectedTweetForAssignment && (
                  <>
                    {batchTweets.find(
                      (t) => t.id === selectedTweetForAssignment
                    )?.assignedAccounts.length || 0}{" "}
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
    </div>
  );
}
