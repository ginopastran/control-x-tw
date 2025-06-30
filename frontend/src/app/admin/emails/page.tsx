"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle, Check, X, Plus, Trash2 } from "lucide-react";
import { buildApiUrl, API_CONFIG } from "@/config/api";

interface AuthorizedEmail {
  _id: string;
  email: string;
  addedBy: string;
  addedAt: string;
  isActive: boolean;
}

interface EmailSuggestion {
  email: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  accounts: string[];
}

export default function EmailsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>(
    []
  );
  const [emailSuggestions, setEmailSuggestions] = useState<EmailSuggestion[]>(
    []
  );
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adding, setAdding] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [clearingTweetsQueue, setClearingTweetsQueue] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [authResponse /*, suggResponse*/] = await Promise.all([
        fetch("/api/authorized-emails"),
        // fetch("/api/admin/email-suggestions"), // FIXME: This endpoint does not exist.
      ]);

      if (authResponse.ok) {
        const authData = await authResponse.json();
        setAuthorizedEmails(authData.emails || []);
      }

      // if (suggResponse.ok) {
      //   const suggData = await suggResponse.json();
      //   setEmailSuggestions(suggData.suggestions || []);
      // }
    } catch (err) {
      setError("Error al cargar los datos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;

    try {
      setAdding(true);
      setError("");

      const response = await fetch("/api/authorized-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al agregar email");
      }

      setSuccess("Email agregado exitosamente");
      setNewEmail("");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const removeEmail = async (emailId: string) => {
    if (!confirm("¿Estás seguro que deseas eliminar este email?")) return;

    try {
      const response = await fetch(`/api/authorized-emails/${emailId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar email");
      }

      setSuccess("Email eliminado exitosamente");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClearQueue = async () => {
    if (
      !window.confirm(
        "¿Estás seguro que deseas eliminar TODAS las acciones en cola y programadas? Esta acción es irreversible."
      )
    )
      return;

    const confirmation = prompt(
      'Para confirmar, escribe "LIMPIAR COLA" en mayúsculas.'
    );
    if (confirmation !== "LIMPIAR COLA") {
      setError("Confirmación incorrecta. Operación cancelada.");
      return;
    }

    try {
      setClearingQueue(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        buildApiUrl(API_CONFIG.ENDPOINTS.QUEUE.CLEAR_ALL),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al limpiar la cola");
      }

      setSuccess("La cola de acciones ha sido limpiada exitosamente.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClearingQueue(false);
    }
  };

  const handleClearTweetsQueue = async () => {
    if (
      !window.confirm(
        "¿Estás seguro que deseas eliminar SOLO las acciones de tweet y retweet en cola?"
      )
    )
      return;

    try {
      setClearingTweetsQueue(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        buildApiUrl("/api/queue/filtered", { actionTypes: "tweet,retweet" }),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al limpiar tweets/retweets");
      }

      const data = await response.json();
      setSuccess(data.message || "Acciones de tweets/retweets eliminadas.");
      // Opcional: refrescar datos de cola si los mostraras
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClearingTweetsQueue(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Gestión de Emails</h1>
        <p className="text-muted-foreground mt-2">
          Administra los emails autorizados para el registro
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {/* Agregar nuevo email */}
        <Card>
          <CardHeader>
            <CardTitle>Agregar Email Autorizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="email@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addEmail()}
                className="flex-1"
              />
              <Button onClick={addEmail} disabled={adding || !newEmail.trim()}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Emails autorizados */}
        <Card>
          <CardHeader>
            <CardTitle>
              Emails Autorizados ({authorizedEmails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {authorizedEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay emails autorizados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Agregado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authorizedEmails.map((email) => (
                    <TableRow key={email._id}>
                      <TableCell className="font-medium">
                        {email.email}
                      </TableCell>
                      <TableCell>{email.addedBy}</TableCell>
                      <TableCell>
                        {new Date(email.addedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={email.isActive ? "default" : "secondary"}
                        >
                          {email.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeEmail(email._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sugerencias de emails */}
        <Card>
          <CardHeader>
            <CardTitle>
              Sugerencias de Emails ({emailSuggestions.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Emails encontrados en las cuentas pero no autorizados
            </p>
          </CardHeader>
          <CardContent>
            {emailSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidad de sugerencias no disponible temporalmente.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Primera vez</TableHead>
                    <TableHead>Última vez</TableHead>
                    <TableHead>Cuentas</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailSuggestions.map((suggestion, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {suggestion.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{suggestion.count}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(suggestion.firstSeen).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(suggestion.lastSeen).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {suggestion.accounts.length} cuentas
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            setNewEmail(suggestion.email);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Zona de Peligro */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Limpiar Cola de Acciones</p>
                <p className="text-sm text-muted-foreground">
                  Elimina permanentemente todas las acciones en cola y
                  programadas.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="destructive"
                  onClick={handleClearQueue}
                  disabled={clearingQueue}
                >
                  {clearingQueue ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" /> Limpiar Cola
                    </>
                  )}
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleClearTweetsQueue}
                  disabled={clearingTweetsQueue}
                >
                  {clearingTweetsQueue ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Limpiando Tuits...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" /> Limpiar Tweets/RT
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
