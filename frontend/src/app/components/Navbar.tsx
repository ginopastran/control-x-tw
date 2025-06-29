"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AuthStatus from "@/components/auth/AuthStatus";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X } from "lucide-react";
import React from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NavLink {
  path: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles?: string[];
}

interface NavbarProps {
  user: User | null;
  loading: boolean;
}

export default function NavbarComponent({ user, loading }: NavbarProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const getNavLinkClass = (path: string, isMobile: boolean = false) => {
    const baseClass = `relative group flex items-center px-3 py-2 text-sm font-medium transition-colors ${
      isMobile ? "text-lg w-full" : ""
    }`;
    const activeClass = "text-primary";
    const inactiveClass = "text-muted-foreground hover:text-foreground";

    return `${baseClass} ${isActive(path) ? activeClass : inactiveClass}`;
  };

  const navLinks: NavLink[] = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      allowedRoles: ["ADMIN", "SUPERADMIN"],
    },
    {
      path: "/accounts",
      label: "Cuentas",
      icon: (
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      allowedRoles: ["SUPERADMIN"],
    },
    {
      path: "/tweets",
      label: "Tweets",
      icon: (
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      ),
      allowedRoles: ["ADMIN", "SUPERADMIN"],
    },

    {
      path: "/historial",
      label: "Historial",
      icon: (
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      allowedRoles: ["ADMIN", "SUPERADMIN"],
    },
    {
      path: "/admin/emails",
      label: "Emails Autorizados",
      icon: (
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
          />
        </svg>
      ),
      allowedRoles: ["SUPERADMIN"],
    },
  ];

  const filteredNavLinks = navLinks.filter((link) => {
    if (!link.allowedRoles || !user?.role) return false;
    return link.allowedRoles.includes(user.role);
  });

  return (
    <>
      <style jsx global>{`
        .nav-indicator {
          position: absolute;
          height: 2px;
          bottom: -1px;
          left: 0;
          right: 0;
          background: linear-gradient(
            to right,
            hsl(var(--primary)),
            hsl(var(--secondary))
          );
          border-radius: 1px;
          transform-origin: left;
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .active .nav-indicator {
          transform: scaleX(1);
        }

        .group:hover .nav-indicator {
          transform: scaleX(1);
        }
      `}</style>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden mr-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Desktop Navigation - Centrado */}
          <div className="hidden sm:flex items-center justify-center flex-1">
            <div className="flex items-center space-x-8 text-sm font-medium">
              {loading ? (
                // Skeleton loading para los links
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center px-3 py-2">
                      <div className="w-5 h-5 mr-1 bg-muted rounded animate-pulse"></div>
                      <div className="w-16 h-4 bg-muted rounded animate-pulse"></div>
                    </div>
                  ))}
                </>
              ) : user ? (
                // Links normales cuando hay usuario
                <>
                  {filteredNavLinks.map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className={getNavLinkClass(link.path)}
                    >
                      {link.icon}
                      {link.label}
                      <span
                        className={`nav-indicator ${
                          isActive(link.path) ? "active" : ""
                        }`}
                      ></span>
                    </Link>
                  ))}
                </>
              ) : (
                // Mensaje cuando no hay usuario
                <div className="text-muted-foreground text-sm">
                  Inicia sesión para ver el menú
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center">
            {loading ? (
              // Skeleton para AuthStatus
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
                <div className="w-16 h-4 bg-muted rounded animate-pulse"></div>
              </div>
            ) : (
              <AuthStatus user={user} />
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="sm:hidden border-t bg-background">
            <div className="space-y-1 px-4 py-2">
              {loading ? (
                // Skeleton loading para menú móvil
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center py-2 w-full">
                      <div className="w-5 h-5 mr-1 bg-muted rounded animate-pulse"></div>
                      <div className="w-20 h-4 bg-muted rounded animate-pulse"></div>
                    </div>
                  ))}
                </>
              ) : user ? (
                // Links normales cuando hay usuario
                <>
                  {filteredNavLinks.map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className={getNavLinkClass(link.path, true)}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  ))}
                </>
              ) : (
                // Mensaje cuando no hay usuario
                <div className="text-muted-foreground text-sm py-2">
                  Inicia sesión para ver el menú
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
