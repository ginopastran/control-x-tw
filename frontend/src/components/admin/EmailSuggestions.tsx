"use client";

import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";

interface EmailSuggestion {
  email: string;
  category: string;
  color: "primary" | "secondary" | "success" | "warning" | "danger";
}

interface EmailSuggestionsProps {
  onSelectEmail: (email: string) => void;
}

export default function EmailSuggestions({
  onSelectEmail,
}: EmailSuggestionsProps) {
  const suggestions: EmailSuggestion[] = [
    {
      email: "admin@empresa.com",
      category: "Administración",
      color: "primary",
    },
    {
      email: "marketing@empresa.com",
      category: "Marketing",
      color: "secondary",
    },
    { email: "soporte@empresa.com", category: "Soporte", color: "success" },
    { email: "ventas@empresa.com", category: "Ventas", color: "warning" },
    {
      email: "desarrollo@empresa.com",
      category: "Desarrollo",
      color: "danger",
    },
    { email: "equipo@empresa.com", category: "Equipo", color: "primary" },
    { email: "manager@empresa.com", category: "Gestión", color: "secondary" },
    {
      email: "social@empresa.com",
      category: "Redes Sociales",
      color: "success",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="text-lg font-semibold">Sugerencias de Emails</h3>
          <p className="text-small text-default-500">
            Haz clic en cualquier email para agregarlo rápidamente
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 border border-default-200 rounded-lg hover:bg-default-50 transition-colors cursor-pointer"
              onClick={() => onSelectEmail(suggestion.email)}
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm">{suggestion.email}</span>
                <Chip size="sm" color={suggestion.color} variant="flat">
                  {suggestion.category}
                </Chip>
              </div>
              <Button
                size="sm"
                variant="light"
                color="primary"
                onPress={() => onSelectEmail(suggestion.email)}
              >
                Usar
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-small text-blue-700">
            💡 <strong>Tip:</strong> Puedes personalizar estos emails cambiando
            "empresa.com" por el dominio de tu organización antes de agregarlos.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
