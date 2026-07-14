"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { X, Loader2, AlertCircle, LogIn } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Use internal API route to avoid Mixed Content (HTTPS -> HTTP) issues
      // The proxy at /api/login/access-token/ will handle the communication with the insecure backend
      const formData = new URLSearchParams();
      formData.append('grant_type', 'password');
      formData.append('username', email);
      formData.append('password', password);
      // Adding required fields for OAuth2 password flow
      formData.append('scope', '');
      formData.append('client_id', 'string');
      formData.append('client_secret', 'string');

      const response = await fetch('/api/login/access-token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        // Try to parse error message from backend
        let errorMsg = "Credenciales inválidas";
        try {
            const errorData = await response.json();
            const detail = errorData.detail || errorData.message;
            if (detail) {
                errorMsg = typeof detail === 'string' ? detail : JSON.stringify(detail);
                if (errorMsg === "Incorrect email or password") {
                    errorMsg = "Correo o contraseña incorrectos";
                }
            }
        } catch (e) {
            // If response is not JSON, use text or default message
            const text = await response.text().catch(() => null);
            if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // Fetch user details using the proxy route
      const userResponse = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'accept': 'application/json'
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        login(data.access_token, data.refresh_token, userData);
        onClose();
      } else {
        throw new Error("Error al obtener datos del usuario");
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 sm:p-8">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <LogIn size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Inicia Sesión</h2>
            <p className="text-gray-500 mt-2">Para calificar este producto necesitas estar autenticado.</p>
            <p className="text-sm text-gray-500 mt-1">
              ¿No tienes cuenta? <a href="/register" className="text-primary font-medium hover:underline">Regístrate gratis</a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Iniciando...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
