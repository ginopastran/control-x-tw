"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AuthStatus from "@/components/auth/AuthStatus";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/react";
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
}

export default function NavbarComponent() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const getNavLinkClass = (path: string, isMobile: boolean = false) => {
    const baseClass = `relative group flex items-center px-3 py-2 text-sm font-medium ${
      isMobile ? "text-lg w-full" : ""
    }`;
    const activeClass = "text-blue-600 dark:text-blue-400";
    const inactiveClass =
      "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400";

    return `${baseClass} ${isActive(path) ? activeClass : inactiveClass}`;
  };

  const navLinks: NavLink[] = [
    {
      path: "/admin",
      label: "Inicio",
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
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
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
    },
    {
      path: "/test-tweets",
      label: "Beta",
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
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      ),
    },
    {
      path: "/scheduler",
      label: "Programador",
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Error al obtener el usuario:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <>
      <style jsx global>{`
        .nav-indicator {
          position: absolute;
          height: 2px;
          bottom: -1px;
          left: 0;
          right: 0;
          background: linear-gradient(to right, #3b82f6, #10b981);
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
      <Navbar
        isBordered
        isBlurred
        onMenuOpenChange={setIsMenuOpen}
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-lg backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90"
      >
        <NavbarContent>
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            className="sm:hidden"
          />
          <NavbarBrand>
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-green-600">
                Control-X
              </span>
            </Link>
          </NavbarBrand>
        </NavbarContent>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem isActive={isActive("/admin")}>
            <Link href="/admin" className={getNavLinkClass("/admin")}>
              {navLinks[0].icon}
              {navLinks[0].label}
              <span
                className={`nav-indicator ${
                  isActive("/admin") ? "active" : ""
                }`}
              ></span>
            </Link>
          </NavbarItem>

          {user && (
            <>
              {navLinks.slice(1).map((link) => (
                <NavbarItem key={link.path} isActive={isActive(link.path)}>
                  <Link href={link.path} className={getNavLinkClass(link.path)}>
                    {link.icon}
                    {link.label}
                    <span
                      className={`nav-indicator ${
                        isActive(link.path) ? "active" : ""
                      }`}
                    ></span>
                  </Link>
                </NavbarItem>
              ))}
            </>
          )}
        </NavbarContent>

        <NavbarContent justify="end">
          {!loading && <AuthStatus user={user} />}
        </NavbarContent>

        <NavbarMenu>
          <NavbarMenuItem>
            <Link href="/admin" className={getNavLinkClass("/admin", true)}>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Inicio
            </Link>
          </NavbarMenuItem>

          {user && (
            <>
              {navLinks.slice(1).map((link) => (
                <NavbarMenuItem key={link.path}>
                  <Link
                    href={link.path}
                    className={getNavLinkClass(link.path, true)}
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={
                          link.path === "/accounts"
                            ? "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            : link.path === "/tweets"
                            ? "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            : link.path === "/test-tweets"
                            ? "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                            : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        }
                      />
                    </svg>
                    {link.label}
                  </Link>
                </NavbarMenuItem>
              ))}
            </>
          )}
        </NavbarMenu>
      </Navbar>
    </>
  );
}
