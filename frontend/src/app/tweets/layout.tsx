"use client";

export default function TweetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen ">
      {/* Main content */}
      <div className="flex-grow">{children}</div>
    </div>
  );
}
