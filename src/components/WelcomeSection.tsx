"use client";

import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";

export function WelcomeSection() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="mb-6 bg-gradient-to-r from-orange-100 to-white p-6 rounded-2xl border border-orange-200">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
        ¡Hola, <span className="text-primary">{isAuthenticated ? user?.name : "Invitado"}</span>!
      </h1>
      <p className="text-muted-foreground mt-1">
        Bienvenido a SafeEasy. {isAuthenticated ? "Nos alegra verte de nuevo." : "Encuentra los mejores productos para tu negocio."}
      </p>
      {!isAuthenticated && (
        <div className="mt-4">
            <Link href="/login" className="inline-block px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors">
                Inicia Sesión
            </Link>
        </div>
      )}
    </div>
  );
}
