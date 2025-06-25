interface BackgroundGradientProps {
  children: React.ReactNode;
  className?: string;
}

export default function BackgroundGradient({
  children,
  className = "",
}: BackgroundGradientProps) {
  return (
    <div
      className={`relative min-h-screen bg-gradient-to-br from-[#101010] via-[#202020] to-[#303030] ${className}`}
    >
      {/* Efectos de resplandor animados */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Contenido */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
