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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [authResponse, suggResponse] = await Promise.all([
        fetch("/api/admin/authorized-emails"),
        fetch("/api/admin/email-suggestions"),
      ]);

      if (authResponse.ok) {
        const authData = await authResponse.json();
        setAuthorizedEmails(authData.emails || []);
      }

      if (suggResponse.ok) {
        const suggData = await suggResponse.json();
        setEmailSuggestions(suggData.suggestions || []);
      }
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

      const response = await fetch("/api/admin/authorized-emails", {
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
      const response = await fetch(`/api/admin/authorized-emails/${emailId}`, {
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
                No hay sugerencias de emails
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
      </div>
    </div>
  );
}
