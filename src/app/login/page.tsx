"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2, AlertCircle, Eye, EyeOff, Facebook } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { jwtDecode } from "jwt-decode";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_CLIENT_ID = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID || "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleSocialLogin = async (payload: any) => {
    setIsLoading(true);
    setError(null);

    try {
      // 2. Enviar a tu Backend Seguro
      const response = await fetch('/api/login/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error en el login social');
      }

      const data = await response.json();
      
      // 3. ¡Éxito! Guardar el token de TU sistema
      console.log("Login exitoso, token recibido:", data.access_token);
      
      // Decodificar el token o usar los datos devueltos si incluyen info de usuario
      // Asumiendo que el backend devuelve access_token y tal vez user info o lo buscamos
      
      let userData = { id: 0, name: payload.name || "User", email: payload.email || "", role: 'user' };
      
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
                name: fetchedUser.full_name || fetchedUser.name || userData.name,
                email: fetchedUser.email || userData.email,
                role: fetchedUser.role || 'user'
            };
        }
      } catch (roleError) {
          console.error("Error obteniendo datos del usuario:", roleError);
      }

      login(data.access_token, data.refresh_token || null, {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
      });
      
      if (userData.role === 'admin' || userData.role === 'supplier') {
          router.push('/admin/dashboard');
          return;
      }

      router.push('/');

    } catch (error) {
      console.error("Error al iniciar sesión social:", error);
      setError("No se pudo iniciar sesión con la red social. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        const decoded: any = jwtDecode(credentialResponse.credential);
        const payload = {
            provider: "google",
            token: credentialResponse.credential,
            email: decoded.email,
            name: decoded.name,
            avatar: decoded.picture,
            social_id: decoded.sub
        };
        handleSocialLogin(payload);
      } catch (e) {
        console.error("Error decoding Google token", e);
        setError("Error al procesar la respuesta de Google");
      }
    }
  };

  const responseFacebook = (response: any) => {
    if (response.accessToken) {
      const payload = {
        provider: "facebook",
        token: response.accessToken,
        email: response.email,
        name: response.name,
        avatar: response.picture?.data?.url,
        social_id: response.userID
      };
      handleSocialLogin(payload);
    } else {
        // User cancelled or error
        if (response.status !== 'unknown') {
            console.error("Facebook login error", response);
            setError("Error al conectar con Facebook");
        }
    }
  };

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
      // formData.append('client_id', '');
      // formData.append('client_secret', '');

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
      
      if (userData.role === 'admin' || userData.role === 'supplier') {
          console.log("El usuario es admin o supplier, redirigiendo a panel...");
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
              <div className="relative">
                <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm pr-10"
                    placeholder="••••••••"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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

        <div className="mt-6">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                        O continúa con
                    </span>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <div className="w-full">
                         <GoogleLogin
                            onSuccess={onGoogleSuccess}
                            onError={() => {
                                console.error('Google Login Failed');
                                setError('Falló el inicio de sesión con Google');
                            }}
                            theme="outline"
                            width="300" 
                            text="signin_with"
                         />
                    </div>
                </GoogleOAuthProvider>

                <div>
                    <FacebookLogin
                        appId={FACEBOOK_CLIENT_ID}
                        autoLoad={false}
                        fields="name,email,picture"
                        callback={responseFacebook}
                        render={(renderProps: any) => (
                            <button
                                onClick={renderProps.onClick}
                                className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                            >
                                <Facebook className="h-5 w-5 text-[#1877F2] mr-2" />
                                <span className="hidden sm:inline">Facebook</span>
                                <span className="sm:hidden">FB</span>
                            </button>
                        )}
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
