import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export default function GlassCard({
  children,
  className = "",
  padding = "md",
}: GlassCardProps) {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`
      bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl
      ${paddingClasses[padding]}
      ${className}
    `}
    >
      {children}
    </div>
  );
}
