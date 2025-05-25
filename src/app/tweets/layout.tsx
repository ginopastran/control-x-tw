"use client";

export default function TweetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
} 