"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";

interface UserIdInfo {
  account: string;
  userId: string;
  username: string;
  verificationStatus: string;
}

export default function DebugUserIdsPage() {
  const [userIds, setUserIds] = useState<UserIdInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUserIds();
  }, []);

  const fetchUserIds = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/user-ids");
      if (!response.ok) {
        throw new Error("Error al cargar user IDs");
      }
      const data = await response.json();
      setUserIds(data.userIds || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold">Debug User IDs</h1>
        <p className="text-muted-foreground mt-2">
          Información de User IDs de todas las cuentas
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {userIds.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No hay User IDs para mostrar
              </p>
            </CardContent>
          </Card>
        ) : (
          userIds.map((info, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>@{info.username}</CardTitle>
                  <Badge
                    variant={
                      info.verificationStatus === "verified"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {info.verificationStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Account ID
                    </p>
                    <p className="font-mono text-sm">{info.account}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      User ID
                    </p>
                    <p className="font-mono text-sm">{info.userId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Username
                    </p>
                    <p className="font-mono text-sm">@{info.username}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-center mt-8">
        <Button onClick={fetchUserIds}>Actualizar</Button>
      </div>
    </div>
  );
}
