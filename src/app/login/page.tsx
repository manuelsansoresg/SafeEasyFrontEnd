"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'password');
      formData.append('username', email);
      formData.append('password', password);
      // Adding empty scope, client_id, and client_secret to match the curl/swagger request
      formData.append('scope', '');
      formData.append('client_id', 'string');
      formData.append('client_secret', 'string'); // Using 'string' as placeholder since it's required but seemingly unused or default

      // Use internal API route to avoid CORS issues
      // The rewrite in next.config.ts maps /api/* to http://127.0.0.1:8000/*
      const response = await fetch('/api/login/access-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = {};
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            console.error('No se pudo parsear error JSON:', errorText);
            // Si no es JSON, crear un objeto con el texto crudo para mostrarlo si es necesario
            errorData = { message: errorText || `Error ${response.status}` };
        }
        
        if (response.status >= 500) {
            console.error('Error login response:', { status: response.status, data: errorData });
        } else {
            console.warn('Login failed:', { status: response.status, data: errorData });
        }

        if (response.status === 401 || response.status === 400) {
            // Manejar "Incorrect email or password" explícitamente si viene en 'detail'
            const serverMessage = (errorData as any)?.detail || (errorData as any)?.message;
            if (serverMessage) {
                 const msg = typeof serverMessage === 'object' ? JSON.stringify(serverMessage) : serverMessage;
                 // Traducir mensaje común del backend
                 if (msg === "Incorrect email or password") {
                     throw new Error('Correo o contraseña incorrectos.');
                 }
                 throw new Error(msg);
            }
            throw new Error('Correo o contraseña incorrectos. Por favor verifícalos.');
        }
        throw new Error(`Error en el servidor (${response.status}). Intenta más tarde.`);
      }

      const data = await response.json();
      
      // Fetch user data to get ID and role
      let userData = { id: 0, name: email.split('@')[0], email, role: 'user' };
      
      try {
        const meResponse = await fetch('/api/users/me', {
           method: 'GET',
           headers: {
             'Authorization': `Bearer ${data.access_token}`,
             'Content-Type': 'application/json'
           }
        });
        
        if (meResponse.ok) {
            const fetchedUser = await meResponse.json();
            userData = {
                id: fetchedUser.id || 0,
                name: fetchedUser.full_name || fetchedUser.name || email.split('@')[0],
                email: fetchedUser.email || email,
                role: fetchedUser.role || 'user'
            };
        }
      } catch (roleError) {
          console.error("Error obteniendo datos del usuario:", roleError);
      }

      // Login with full user data including ID
      console.log("Login successful. Data:", { ...data, access_token: '***', refresh_token: data.refresh_token ? '***' : 'undefined' });
      
      login(data.access_token, data.refresh_token || null, {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
      });
      
      if (userData.role === 'admin') {
          console.log("El usuario es admin, redirigiendo a panel...");
          router.push('/admin/dashboard');
          return;
      }

      router.push('/');
      
    } catch (err) {
      let errorMessage = 'Ocurrió un error al iniciar sesión';
      
      if (err instanceof Error) {
         if (err.message === 'Failed to fetch') {
             errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
         } else {
             errorMessage = err.message;
         }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Inicia sesión en tu cuenta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              Regístrate gratis
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="ejemplo@correo.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
