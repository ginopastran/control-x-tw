"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MessageSquare,
  Heart,
  Repeat,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";

interface Account {
  _id: string;
  username: string;
  labels: string[];
}

interface ScheduledAction {
  id: string;
  action: "tweet" | "reply" | "like" | "retweet" | "follow" | "unfollow";
  accountIds: string[];
  text?: string;
  tweetId?: string;
  targetUserId?: string;
  scheduledTime: string;
  baseDelay: number;
  randomDelay: number;
  status: "scheduled" | "executing" | "completed" | "error";
  createdAt: string;
}

export default function SchedulePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Estados del formulario
  const [actionType, setActionType] = useState<string>("");
  const [text, setText] = useState("");
  const [tweetId, setTweetId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [baseDelay, setBaseDelay] = useState(30);
  const [randomDelay, setRandomDelay] = useState(60);

  useEffect(() => {
    fetchAccounts();
    fetchScheduledActions();
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

  const fetchScheduledActions = async () => {
    try {
      const response = await fetch("/api/schedule");
      if (!response.ok) throw new Error("Error al cargar acciones programadas");
      const data = await response.json();
      setScheduledActions(data.scheduled || []);
    } catch (err) {
      console.error("Error al cargar acciones programadas:", err);
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

  const extractAndValidateUserId = (input: string): string | null => {
    if (!input?.trim()) return null;

    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }

    try {
      const url = new URL(input);
      if (
        url.hostname.includes("twitter.com") ||
        url.hostname.includes("x.com")
      ) {
        const pathParts = url.pathname.split("/").filter((part) => part);
        if (pathParts.length > 0) {
          const username = pathParts[0];
          if (/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
            return username;
          }
        }
      }
    } catch {}

    const cleanUsername = input.trim().replace(/^@/, "");
    if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername)) {
      return cleanUsername;
    }

    return null;
  };

  const scheduleAction = async () => {
    if (!actionType) {
      toast.error("Selecciona un tipo de acción");
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast.error("Selecciona fecha y hora");
      return;
    }

    // Validaciones específicas por tipo de acción
    if (["tweet", "reply"].includes(actionType) && !text.trim()) {
      toast.error("El texto es requerido para tweets y respuestas");
      return;
    }

    if (["like", "retweet", "reply"].includes(actionType)) {
      const validatedTweetId = extractTweetId(tweetId);
      if (!validatedTweetId) {
        toast.error("URL o ID de tweet inválido");
        return;
      }
    }

    if (["follow", "unfollow"].includes(actionType)) {
      const validatedUserId = extractAndValidateUserId(targetUserId);
      if (!validatedUserId) {
        toast.error("Usuario inválido");
        return;
      }
    }

    setIsScheduling(true);

    try {
      // Combinar fecha y hora
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

      const actionData = {
        action: actionType,
        accountIds: selectedAccounts,
        text: text.trim() || undefined,
        tweetId: extractTweetId(tweetId) || undefined,
        targetUserId: extractAndValidateUserId(targetUserId) || undefined,
        scheduledTime: scheduledDateTime.toISOString(),
        baseDelay,
        randomDelay,
      };

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(actionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al programar acción");
      }

      toast.success("Acción programada exitosamente");
      setIsDialogOpen(false);
      resetForm();
      await fetchScheduledActions();
    } catch (err: any) {
      toast.error(err.message || "Error al programar acción");
    } finally {
      setIsScheduling(false);
    }
  };

  const cancelScheduledAction = async (actionId: string) => {
    try {
      const response = await fetch(`/api/schedule/${actionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al cancelar acción");
      }

      toast.success("Acción cancelada");
      await fetchScheduledActions();
    } catch (err: any) {
      toast.error(err.message || "Error al cancelar acción");
    }
  };

  const resetForm = () => {
    setActionType("");
    setText("");
    setTweetId("");
    setTargetUserId("");
    setScheduledDate("");
    setScheduledTime("");
    setSelectedAccounts([]);
    setBaseDelay(30);
    setRandomDelay(60);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc._id === accountId);
    return account ? account.username : "Cuenta desconocida";
  };

  const formatScheduledTime = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleString();
    } catch {
      return timeString;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "tweet":
        return <MessageSquare className="h-4 w-4" />;
      case "reply":
        return <MessageSquare className="h-4 w-4" />;
      case "like":
        return <Heart className="h-4 w-4" />;
      case "retweet":
        return <Repeat className="h-4 w-4" />;
      case "follow":
        return <UserPlus className="h-4 w-4" />;
      case "unfollow":
        return <UserMinus className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "scheduled":
        return "secondary";
      case "executing":
        return "default";
      case "completed":
        return "default";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Programador de Acciones</h1>
          <p className="text-muted-foreground mt-2">
            Programa tweets, likes, retweets y más
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Acción
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Programar Nueva Acción</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Tipo de acción */}
              <div className="space-y-2">
                <Label>Tipo de Acción</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una acción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tweet">Publicar Tweet</SelectItem>
                    <SelectItem value="reply">Responder Tweet</SelectItem>
                    <SelectItem value="like">Dar Like</SelectItem>
                    <SelectItem value="retweet">Hacer Retweet</SelectItem>
                    <SelectItem value="follow">Seguir Usuario</SelectItem>
                    <SelectItem value="unfollow">Dejar de Seguir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selección de cuentas */}
              <div className="space-y-2">
                <Label>Cuentas</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {accounts.map((account) => (
                    <label
                      key={account._id}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAccounts([
                              ...selectedAccounts,
                              account._id,
                            ]);
                          } else {
                            setSelectedAccounts(
                              selectedAccounts.filter(
                                (id) => id !== account._id
                              )
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">@{account.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Texto (para tweets y respuestas) */}
              {["tweet", "reply"].includes(actionType) && (
                <div className="space-y-2">
                  <Label>Texto</Label>
                  <Textarea
                    placeholder="Escribe tu mensaje..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                  />
                </div>
              )}

              {/* Tweet ID (para likes, retweets, respuestas) */}
              {["like", "retweet", "reply"].includes(actionType) && (
                <div className="space-y-2">
                  <Label>URL o ID del Tweet</Label>
                  <Input
                    placeholder="https://twitter.com/usuario/status/123... o solo el ID"
                    value={tweetId}
                    onChange={(e) => setTweetId(e.target.value)}
                  />
                </div>
              )}

              {/* Usuario (para follow/unfollow) */}
              {["follow", "unfollow"].includes(actionType) && (
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input
                    placeholder="@usuario, ID numérico o URL de perfil"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                  />
                </div>
              )}

              {/* Fecha y hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Delays */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delay Base (segundos)</Label>
                  <Input
                    type="number"
                    value={baseDelay}
                    onChange={(e) =>
                      setBaseDelay(parseInt(e.target.value) || 0)
                    }
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delay Aleatorio (segundos)</Label>
                  <Input
                    type="number"
                    value={randomDelay}
                    onChange={(e) =>
                      setRandomDelay(parseInt(e.target.value) || 0)
                    }
                    min="0"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={scheduleAction} disabled={isScheduling}>
                  {isScheduling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Programando...
                    </>
                  ) : (
                    "Programar Acción"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de acciones programadas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Acciones Programadas ({scheduledActions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay acciones programadas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acción</TableHead>
                  <TableHead>Cuentas</TableHead>
                  <TableHead>Programado para</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledActions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getActionIcon(action.action)}
                        <span className="capitalize">{action.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {action.accountIds.map((accountId) => (
                          <Badge key={accountId} variant="outline">
                            @{getAccountName(accountId)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatScheduledTime(action.scheduledTime)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(action.status)}>
                        {action.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {action.status === "scheduled" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelScheduledAction(action.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
